import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  comments,
  commentLikes,
  commentRevisions,
} from '../../../database/schema/community.schema.js';
import { users } from '../../../database/schema/user.schema.js';
import { manga, chapters } from '../../../database/schema/manga.schema.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentableType,
  CommentSort,
  type CommentQueryDto,
} from '../dto/create-comment.dto.js';
import { CommentLikeEvent } from '../../notification/events/comment-like.event.js';
import { CommentMentionService } from './comment-mention.service.js';
import { ModerationService } from './moderation.service.js';

const ALLOWED_TAGS = [
  'b',
  'i',
  'em',
  'strong',
  'blockquote',
  'p',
  'br',
  'img',
  'a',
  'span',
];
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt'],
  // data-type/data-id/data-label needed for TipTap Mention extension nodes.
  span: ['class', 'data-type', 'data-id', 'data-label'],
};

const ALLOWED_IMG_SRC_PATTERN = /^https:\/\//i;

// C4: explicit class whitelist — free-form class attr lets attackers inject
// Tailwind utilities (e.g. `fixed inset-0 z-[9999]`) to hijack reader UI.
const SPAN_CLASS_WHITELIST = new Set(['spoiler', 'highlight', 'mention']);

// Mention data attrs: strict validation prevents inject of foreign markup.
// data-id must be a positive integer (our serial PK); data-label alphanumeric + underscore/dash.
const MENTION_ID_PATTERN = /^[1-9]\d*$/;
const MENTION_LABEL_PATTERN = /^[A-Za-z0-9_.-]{1,50}$/;

function sanitizeContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['https'],
    allowedSchemesAppliedToAttributes: ['src', 'href'],
    transformTags: {
      // C4: add `noreferrer` → blocks Referer leak of current manga/chapter URL.
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener nofollow noreferrer',
      }),
      img: (tagName, attribs) => {
        const src = attribs.src ?? '';
        if (!ALLOWED_IMG_SRC_PATTERN.test(src)) {
          return { tagName: 'span', attribs: {} };
        }
        return { tagName, attribs };
      },
      span: (tagName, attribs) => {
        const kept = (attribs.class ?? '')
          .split(/\s+/)
          .filter((c) => SPAN_CLASS_WHITELIST.has(c));
        const newAttribs: Record<string, string> = {};
        if (kept.length) newAttribs.class = kept.join(' ');

        // Preserve mention markup only if class includes 'mention' AND data-* shape valid.
        if (kept.includes('mention')) {
          const dataType = attribs['data-type'];
          const dataId = attribs['data-id'];
          const dataLabel = attribs['data-label'];
          if (
            dataType === 'mention' &&
            typeof dataId === 'string' &&
            MENTION_ID_PATTERN.test(dataId) &&
            typeof dataLabel === 'string' &&
            MENTION_LABEL_PATTERN.test(dataLabel)
          ) {
            newAttribs['data-type'] = 'mention';
            newAttribs['data-id'] = dataId;
            newAttribs['data-label'] = dataLabel;
          }
        }
        return { tagName, attribs: newAttribs };
      },
    },
  });
}

function buildSortClause(sort?: CommentSort) {
  switch (sort) {
    case CommentSort.OLDEST:
      return asc(comments.createdAt);
    case CommentSort.BEST:
      return desc(comments.likesCount);
    case CommentSort.NEWEST:
    default:
      return desc(comments.createdAt);
  }
}

const COMMENT_USER_SELECT = {
  id: comments.id,
  userId: comments.userId,
  content: comments.content,
  likesCount: comments.likesCount,
  dislikesCount: comments.dislikesCount,
  parentId: comments.parentId,
  isPinned: comments.isPinned,
  pinnedAt: comments.pinnedAt,
  editedAt: comments.editedAt,
  mentionedUserIds: comments.mentionedUserIds,
  moderationStatus: comments.moderationStatus,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  userName: users.name,
  userAvatar: users.avatar,
  userRole: users.role,
  repliesCount:
    sql<number>`(SELECT count(*)::int FROM comments c2 WHERE c2.parent_id = ${comments.id} AND c2.deleted_at IS NULL)`.as(
      'replies_count',
    ),
};

const MAX_DEPTH = 3;
const MAX_PINS_PER_THREAD = 3;
const MAX_REVISIONS_PER_COMMENT = 10;

@Injectable()
export class CommentService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly eventEmitter: EventEmitter2,
    private readonly mentionService: CommentMentionService,
    private readonly moderationService: ModerationService,
  ) {}

  /**
   * Resolve manga slug for an event payload — used by mention/reply/like emitters
   * to give the FE a deep link without an extra round-trip.
   */
  private async resolveMangaSlug(
    commentableType: string,
    commentableId: number | null,
  ): Promise<string | null> {
    if (!commentableId) return null;
    if (commentableType === 'manga') {
      const [m] = await this.db
        .select({ slug: manga.slug })
        .from(manga)
        .where(eq(manga.id, commentableId))
        .limit(1);
      return m?.slug ?? null;
    }
    if (commentableType === 'chapter') {
      const [ch] = await this.db
        .select({ mangaId: chapters.mangaId })
        .from(chapters)
        .where(eq(chapters.id, commentableId))
        .limit(1);
      if (!ch?.mangaId) return null;
      const [m] = await this.db
        .select({ slug: manga.slug })
        .from(manga)
        .where(eq(manga.id, ch.mangaId))
        .limit(1);
      return m?.slug ?? null;
    }
    return null;
  }

  /** Attach isLiked/isDisliked to each comment for the given user */
  private async attachReactions<T extends { id: number }>(
    data: T[],
    currentUserId?: number,
  ): Promise<(T & { isLiked: boolean; isDisliked: boolean })[]> {
    if (!currentUserId || data.length === 0) {
      return data.map((d) => ({ ...d, isLiked: false, isDisliked: false }));
    }
    const commentIds = data.map((d) => d.id);
    const reactions = await this.db
      .select({
        commentId: commentLikes.commentId,
        isDislike: commentLikes.isDislike,
      })
      .from(commentLikes)
      .where(
        and(
          eq(commentLikes.userId, currentUserId),
          inArray(commentLikes.commentId, commentIds),
        ),
      );
    const likedSet = new Set(
      reactions.filter((r) => !r.isDislike).map((r) => r.commentId),
    );
    const dislikedSet = new Set(
      reactions.filter((r) => r.isDislike).map((r) => r.commentId),
    );
    return data.map((d) => ({
      ...d,
      isLiked: likedSet.has(d.id),
      isDisliked: dislikedSet.has(d.id),
    }));
  }

  async getRecent(limit = 10) {
    const rows = await this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        commentableType: comments.commentableType,
        commentableId: comments.commentableId,
        userName: users.name,
        userAvatar: users.avatar,
        mangaTitle: manga.title,
        mangaSlug: manga.slug,
        mangaCover: manga.cover,
        chapterNumber: chapters.number,
        chapterMangaId: chapters.mangaId,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .leftJoin(
        manga,
        sql`CASE WHEN ${comments.commentableType} = 'manga' THEN ${comments.commentableId} = ${manga.id} ELSE NULL END`,
      )
      .leftJoin(
        chapters,
        sql`CASE WHEN ${comments.commentableType} = 'chapter' THEN ${comments.commentableId} = ${chapters.id} ELSE NULL END`,
      )
      .where(
        and(
          isNull(comments.parentId),
          isNull(comments.deletedAt),
          eq(comments.moderationStatus, 'approved'),
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(limit);

    const chapterMangaIds = rows
      .filter((r) => r.commentableType === 'chapter' && r.chapterMangaId)
      .map((r) => r.chapterMangaId as number);

    let mangaMap = new Map<
      number,
      { title: string; slug: string; cover: string | null }
    >();
    if (chapterMangaIds.length > 0) {
      const uniqueIds = [...new Set(chapterMangaIds)];
      const mangaRows = await this.db
        .select({
          id: manga.id,
          title: manga.title,
          slug: manga.slug,
          cover: manga.cover,
        })
        .from(manga)
        .where(
          sql`${manga.id} IN (${sql.join(
            uniqueIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      mangaMap = new Map(mangaRows.map((m) => [m.id, m]));
    }

    return rows.map((row) => {
      const isChapter = row.commentableType === 'chapter';
      const resolvedManga =
        isChapter && row.chapterMangaId
          ? mangaMap.get(row.chapterMangaId)
          : null;

      return {
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        userName: row.userName ?? 'Anonymous',
        userAvatar: row.userAvatar,
        mangaTitle: isChapter ? (resolvedManga?.title ?? null) : row.mangaTitle,
        mangaSlug: isChapter ? (resolvedManga?.slug ?? null) : row.mangaSlug,
        mangaCover: isChapter ? (resolvedManga?.cover ?? null) : row.mangaCover,
        chapterNumber: isChapter ? row.chapterNumber : null,
      };
    });
  }

  /**
   * Build visibility predicate combining soft-delete + moderation rules:
   *   public sees only `approved`; author sees their own at any status; admin sees all.
   */
  private buildVisibilityWhere(currentUserId?: number, isAdmin = false) {
    if (isAdmin) {
      return isNull(comments.deletedAt);
    }
    if (currentUserId) {
      return and(
        isNull(comments.deletedAt),
        sql`(${comments.moderationStatus} = 'approved' OR ${comments.userId} = ${currentUserId})`,
      );
    }
    return and(
      isNull(comments.deletedAt),
      eq(comments.moderationStatus, 'approved'),
    );
  }

  private async listComments(
    where: ReturnType<typeof and>,
    query: CommentQueryDto | PaginationDto,
    sortClause: ReturnType<typeof buildSortClause>,
    currentUserId?: number,
  ) {
    const [data, [{ total }]] = await Promise.all([
      this.db
        .select(COMMENT_USER_SELECT)
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(where)
        // Pinned items always lead — preserves admin-curated highlights across sort modes.
        .orderBy(desc(comments.isPinned), sortClause)
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(comments)
        .where(where),
    ]);

    const withReactions = await this.attachReactions(data, currentUserId);
    return { data: withReactions, total, page: query.page, limit: query.limit };
  }

  async listForManga(
    mangaId: number,
    query: CommentQueryDto,
    currentUserId?: number,
    isAdmin = false,
  ) {
    const where = and(
      eq(comments.commentableType, CommentableType.MANGA),
      eq(comments.commentableId, mangaId),
      isNull(comments.parentId),
      this.buildVisibilityWhere(currentUserId, isAdmin),
    );
    return this.listComments(
      where,
      query,
      buildSortClause(query.sort),
      currentUserId,
    );
  }

  async listForChapter(
    chapterId: number,
    query: CommentQueryDto,
    currentUserId?: number,
    isAdmin = false,
  ) {
    const where = and(
      eq(comments.commentableType, CommentableType.CHAPTER),
      eq(comments.commentableId, chapterId),
      isNull(comments.parentId),
      this.buildVisibilityWhere(currentUserId, isAdmin),
    );
    return this.listComments(
      where,
      query,
      buildSortClause(query.sort),
      currentUserId,
    );
  }

  async getReplies(
    commentId: number,
    pagination: PaginationDto,
    currentUserId?: number,
    isAdmin = false,
  ) {
    const where = and(
      eq(comments.parentId, commentId),
      this.buildVisibilityWhere(currentUserId, isAdmin),
    );
    return this.listComments(
      where,
      pagination,
      asc(comments.createdAt),
      currentUserId,
    );
  }

  async getMyComments(userId: number, pagination: PaginationDto) {
    return this.db
      .select()
      .from(comments)
      .where(and(eq(comments.userId, userId), isNull(comments.deletedAt)))
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(comments.createdAt);
  }

  async create(
    userId: number,
    dto: CreateCommentDto,
    userName?: string,
    userAvatar?: string | null,
  ) {
    if (dto.parentId) {
      await this.validateDepth(dto.parentId);
    }

    const cleanContent = sanitizeContent(dto.content);
    const mentionedUserIds = await this.mentionService.parseAndValidate(
      cleanContent,
      userId,
    );

    // Initial moderation status:
    //  - moderation disabled → 'approved' (legacy fast path)
    //  - moderation enabled  → 'pending' (listener finalizes async)
    const initialStatus = this.moderationService.isEnabled()
      ? 'pending'
      : 'approved';

    // Resolve enrichment BEFORE insert so the moderation listener can emit
    // mention/reply notifications post-approval without a second DB lookup.
    // Skip resolution when nothing downstream needs it — avoids a DB round-trip
    // for the common case of a top-level comment with no mentions.
    const needsEnrichment = mentionedUserIds.length > 0 || !!dto.parentId;
    const [mangaSlug, replyTargetUserId] = needsEnrichment
      ? await Promise.all([
          this.resolveMangaSlug(dto.commentableType, dto.commentableId),
          dto.parentId
            ? this.findOrFail(dto.parentId).then((p) =>
                p.userId && p.userId !== userId ? p.userId : null,
              )
            : Promise.resolve(null),
        ])
      : [null, null];

    const [comment] = await this.db
      .insert(comments)
      .values({
        userId,
        commentableType: dto.commentableType,
        commentableId: dto.commentableId,
        parentId: dto.parentId ?? null,
        content: cleanContent,
        mentionedUserIds,
        moderationStatus: initialStatus,
      })
      .returning();

    // Moderation listener gates SSE broadcast + mention/reply notifications
    // on approval — emitting those inline would leak rejected content.
    this.eventEmitter.emit('comment.created', {
      commentId: comment.id,
      authorId: comment.userId,
      content: cleanContent,
      commentableType: comment.commentableType,
      commentableId: comment.commentableId,
      userName,
      userAvatar,
      mangaSlug,
      mangaId:
        dto.commentableType === CommentableType.MANGA
          ? dto.commentableId
          : null,
      mentionedUserIds,
      parentCommentId: dto.parentId ?? null,
      replyTargetUserId,
    });

    return comment;
  }

  async update(
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
    userName?: string,
    userAvatar?: string | null,
  ) {
    const comment = await this.findOrFail(commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException("Cannot edit another user's comment");
    }

    const cleanContent = sanitizeContent(dto.content);
    const newMentionIds = await this.mentionService.parseAndValidate(
      cleanContent,
      userId,
    );
    const oldMentionIds = new Set(comment.mentionedUserIds ?? []);
    const freshlyMentioned = newMentionIds.filter(
      (id) => !oldMentionIds.has(id),
    );

    // When moderation is enabled, reset status to 'pending' so the edited content
    // re-runs the classifier. Prevents the "post benign, edit to abusive" bypass.
    const moderationReset = this.moderationService.isEnabled();

    const updated = await this.db.transaction(async (tx) => {
      // Phase 4: record snapshot of OLD content before update (cap 10, prune oldest FIFO).
      // Order by `id` instead of `editedAt` for deterministic prune when timestamps tie.
      await tx.insert(commentRevisions).values({
        commentId,
        content: comment.content,
        editedAt: comment.editedAt ?? comment.createdAt,
        editorId: comment.userId,
      });
      const allRevs = await tx
        .select({ id: commentRevisions.id })
        .from(commentRevisions)
        .where(eq(commentRevisions.commentId, commentId))
        .orderBy(asc(commentRevisions.id));
      if (allRevs.length > MAX_REVISIONS_PER_COMMENT) {
        const toDelete = allRevs
          .slice(0, allRevs.length - MAX_REVISIONS_PER_COMMENT)
          .map((r) => r.id);
        await tx
          .delete(commentRevisions)
          .where(inArray(commentRevisions.id, toDelete));
      }

      const [row] = await tx
        .update(comments)
        .set({
          content: cleanContent,
          editedAt: new Date(),
          mentionedUserIds: newMentionIds,
          ...(moderationReset
            ? { moderationStatus: 'pending' as const, moderationScore: null }
            : {}),
        })
        .where(eq(comments.id, commentId))
        .returning();
      return row;
    });

    // Emit comment.created so the moderation listener can:
    //   1. Re-moderate edited content (if enabled) before re-broadcast.
    //   2. Fire CommentMentionEvent for FRESH mentions post-approval.
    // Skip emission when moderation disabled AND no fresh mentions — nothing
    // for the listener to do, and we don't want to spam SSE on every minor edit.
    if (freshlyMentioned.length > 0 || moderationReset) {
      const mangaSlug = await this.resolveMangaSlug(
        comment.commentableType,
        comment.commentableId,
      );
      this.eventEmitter.emit('comment.created', {
        commentId: updated.id,
        authorId: updated.userId,
        content: cleanContent,
        commentableType: updated.commentableType,
        commentableId: updated.commentableId,
        userName,
        userAvatar,
        mangaSlug,
        mangaId:
          (comment.commentableType as CommentableType) === CommentableType.MANGA
            ? comment.commentableId
            : null,
        mentionedUserIds: freshlyMentioned,
        parentCommentId: null,
        replyTargetUserId: null,
      });
    }

    return updated;
  }

  async remove(commentId: number, userId: number, userRole: string) {
    const comment = await this.findOrFail(commentId);
    if (comment.userId !== userId && userRole !== 'admin') {
      throw new ForbiddenException('Cannot delete this comment');
    }

    await this.db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, commentId));
  }

  async toggleReaction(
    commentId: number,
    userId: number,
    isDislike: boolean,
    userName?: string,
    userAvatar?: string | null,
  ) {
    const commentData = await this.findOrFail(commentId);

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(commentLikes)
        .where(
          and(
            eq(commentLikes.userId, userId),
            eq(commentLikes.commentId, commentId),
          ),
        )
        .limit(1);

      // If existing reaction: remove it (and if it's the opposite type, we'll insert the new one)
      if (existing) {
        await tx.delete(commentLikes).where(eq(commentLikes.id, existing.id));

        // Decrement the old counter
        if (existing.isDislike) {
          await tx
            .update(comments)
            .set({
              dislikesCount: sql`GREATEST(${comments.dislikesCount} - 1, 0)`,
            })
            .where(eq(comments.id, commentId));
        } else {
          await tx
            .update(comments)
            .set({ likesCount: sql`GREATEST(${comments.likesCount} - 1, 0)` })
            .where(eq(comments.id, commentId));
        }

        // If same type → just un-toggle, return
        if (existing.isDislike === isDislike) {
          const [c] = await tx
            .select({
              likesCount: comments.likesCount,
              dislikesCount: comments.dislikesCount,
            })
            .from(comments)
            .where(eq(comments.id, commentId));
          return {
            liked: false,
            disliked: false,
            likesCount: c?.likesCount ?? 0,
            dislikesCount: c?.dislikesCount ?? 0,
            emitLike: false,
          };
        }
      }

      // Insert new reaction
      await tx.insert(commentLikes).values({ userId, commentId, isDislike });

      // Increment the new counter
      if (isDislike) {
        await tx
          .update(comments)
          .set({ dislikesCount: sql`${comments.dislikesCount} + 1` })
          .where(eq(comments.id, commentId));
      } else {
        await tx
          .update(comments)
          .set({ likesCount: sql`${comments.likesCount} + 1` })
          .where(eq(comments.id, commentId));
      }

      const [c] = await tx
        .select({
          likesCount: comments.likesCount,
          dislikesCount: comments.dislikesCount,
        })
        .from(comments)
        .where(eq(comments.id, commentId));
      return {
        liked: !isDislike,
        disliked: isDislike,
        likesCount: c?.likesCount ?? 0,
        dislikesCount: c?.dislikesCount ?? 0,
        emitLike:
          !isDislike && !!(commentData.userId && commentData.userId !== userId),
      };
    });

    // Emit like notification outside transaction (only for likes, not dislikes)
    if (result.emitLike) {
      const event = new CommentLikeEvent();
      event.commentId = commentId;
      event.likerName = userName ?? '';
      event.likerAvatar = userAvatar ?? null;
      event.commentOwnerId = commentData.userId!;
      event.commentPreview = (commentData.content ?? '').slice(0, 100);
      if (
        commentData.commentableType === 'manga' &&
        commentData.commentableId
      ) {
        const [m] = await this.db
          .select({ slug: manga.slug })
          .from(manga)
          .where(eq(manga.id, commentData.commentableId))
          .limit(1);
        event.mangaSlug = m?.slug ?? null;
      } else if (
        commentData.commentableType === 'chapter' &&
        commentData.commentableId
      ) {
        const [ch] = await this.db
          .select({ mangaId: chapters.mangaId })
          .from(chapters)
          .where(eq(chapters.id, commentData.commentableId))
          .limit(1);
        if (ch?.mangaId) {
          const [m] = await this.db
            .select({ slug: manga.slug })
            .from(manga)
            .where(eq(manga.id, ch.mangaId))
            .limit(1);
          event.mangaSlug = m?.slug ?? null;
        } else {
          event.mangaSlug = null;
        }
      } else {
        event.mangaSlug = null;
      }
      this.eventEmitter.emit('comment.liked', event);
    }

    const { emitLike: _emitLike, ...response } = result;
    return response;
  }

  /** Backward-compatible wrapper */
  async toggleLike(
    commentId: number,
    userId: number,
    likerName?: string,
    likerAvatar?: string | null,
  ) {
    return this.toggleReaction(
      commentId,
      userId,
      false,
      likerName,
      likerAvatar,
    );
  }

  async toggleDislike(commentId: number, userId: number) {
    return this.toggleReaction(commentId, userId, true);
  }

  /**
   * Pin a comment. FIFO: if thread already has MAX_PINS_PER_THREAD pinned,
   * the oldest pin is auto-released to keep slot count bounded.
   *
   * Advisory xact lock keyed by (commentableType, commentableId) serializes
   * concurrent admin pins so the FIFO cap is never violated.
   */
  async pinComment(commentId: number, adminId: number) {
    const target = await this.findOrFail(commentId);
    return this.db.transaction(async (tx) => {
      // Two-key advisory lock: scope key (type+id hash) + isolation namespace constant.
      const lockKey = sql`hashtextextended(${target.commentableType} || ':' || ${target.commentableId}::text, 0)`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      // Fetch currently pinned set for same commentable scope, oldest first.
      const pinned = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(
          and(
            eq(comments.commentableType, target.commentableType),
            eq(comments.commentableId, target.commentableId),
            eq(comments.isPinned, true),
            isNull(comments.deletedAt),
          ),
        )
        .orderBy(asc(comments.pinnedAt));

      // If already pinned: no-op (idempotent).
      if (pinned.some((p) => p.id === commentId)) {
        return target;
      }

      if (pinned.length >= MAX_PINS_PER_THREAD) {
        await tx
          .update(comments)
          .set({ isPinned: false, pinnedAt: null, pinnedBy: null })
          .where(eq(comments.id, pinned[0].id));
      }

      const [row] = await tx
        .update(comments)
        .set({ isPinned: true, pinnedAt: new Date(), pinnedBy: adminId })
        .where(eq(comments.id, commentId))
        .returning();
      return row;
    });
  }

  async unpinComment(commentId: number) {
    await this.findOrFail(commentId);
    const [row] = await this.db
      .update(comments)
      .set({ isPinned: false, pinnedAt: null, pinnedBy: null })
      .where(eq(comments.id, commentId))
      .returning();
    return row;
  }

  /**
   * Public edit history (capped at MAX_REVISIONS_PER_COMMENT, oldest pruned at insert time).
   * Returns reverse-chronological list with editor display info.
   *
   * Visibility mirrors list endpoints: admin sees all, author sees own at any
   * moderation status, public sees only `approved`. Without this gate a
   * rejected comment's original abusive content would leak via revisions.
   */
  async getRevisions(
    commentId: number,
    currentUserId?: number,
    isAdmin = false,
  ) {
    const comment = await this.findOrFail(commentId);
    if (!isAdmin) {
      const isAuthor =
        currentUserId != null && comment.userId === currentUserId;
      if (!isAuthor && comment.moderationStatus !== 'approved') {
        throw new NotFoundException('Comment not found');
      }
    }
    return this.db
      .select({
        id: commentRevisions.id,
        content: commentRevisions.content,
        editedAt: commentRevisions.editedAt,
        editorId: commentRevisions.editorId,
        editorName: users.name,
        editorAvatar: users.avatar,
      })
      .from(commentRevisions)
      .leftJoin(users, eq(commentRevisions.editorId, users.id))
      .where(eq(commentRevisions.commentId, commentId))
      .orderBy(desc(commentRevisions.editedAt))
      .limit(MAX_REVISIONS_PER_COMMENT);
  }

  private async findOrFail(id: number) {
    const [comment] = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
      .limit(1);

    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async validateDepth(parentId: number) {
    const result = await this.db.execute<{ depth: number }>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id, 1 AS depth
        FROM comments WHERE id = ${parentId}
        UNION ALL
        SELECT c.id, c.parent_id, a.depth + 1
        FROM comments c
        JOIN ancestors a ON a.parent_id = c.id
        WHERE a.depth <= ${MAX_DEPTH}
      )
      SELECT MAX(depth) AS depth FROM ancestors
    `);

    const depth = (result[0] as { depth: number } | undefined)?.depth ?? 1;
    if (depth >= MAX_DEPTH) {
      throw new BadRequestException(
        `Max comment depth of ${MAX_DEPTH} exceeded`,
      );
    }
  }
}
