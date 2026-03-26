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
import { CommentReplyEvent } from '../../notification/events/comment-reply.event.js';
import { CommentLikeEvent } from '../../notification/events/comment-like.event.js';

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
  span: ['class'],
};

function sanitizeContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener nofollow',
      }),
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

@Injectable()
export class CommentService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
      .where(and(isNull(comments.parentId), isNull(comments.deletedAt)))
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
        .orderBy(sortClause)
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
  ) {
    const where = and(
      eq(comments.commentableType, CommentableType.MANGA),
      eq(comments.commentableId, mangaId),
      isNull(comments.parentId),
      isNull(comments.deletedAt),
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
  ) {
    const where = and(
      eq(comments.commentableType, CommentableType.CHAPTER),
      eq(comments.commentableId, chapterId),
      isNull(comments.parentId),
      isNull(comments.deletedAt),
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
  ) {
    const where = and(
      eq(comments.parentId, commentId),
      isNull(comments.deletedAt),
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

  async create(userId: number, dto: CreateCommentDto, userName?: string, userAvatar?: string | null) {
    if (dto.parentId) {
      await this.validateDepth(dto.parentId);
    }

    const cleanContent = sanitizeContent(dto.content);

    const [comment] = await this.db
      .insert(comments)
      .values({
        userId,
        commentableType: dto.commentableType,
        commentableId: dto.commentableId,
        parentId: dto.parentId ?? null,
        content: cleanContent,
      })
      .returning();

    if (dto.parentId) {
      const parent = await this.findOrFail(dto.parentId);
      if (parent.userId && parent.userId !== userId) {
        const event = new CommentReplyEvent();
        event.commentId = dto.parentId;
        event.replyAuthorName = userName ?? '';
        event.replyAuthorAvatar = userAvatar ?? null;
        event.replyContent = cleanContent.slice(0, 100);
        event.mangaId =
          dto.commentableType === CommentableType.MANGA
            ? dto.commentableId
            : null;
        if (dto.commentableType === CommentableType.MANGA && dto.commentableId) {
          const [m] = await this.db
            .select({ slug: manga.slug })
            .from(manga)
            .where(eq(manga.id, dto.commentableId))
            .limit(1);
          event.mangaSlug = m?.slug ?? null;
        } else if (dto.commentableType === CommentableType.CHAPTER && dto.commentableId) {
          const [ch] = await this.db
            .select({ mangaId: chapters.mangaId })
            .from(chapters)
            .where(eq(chapters.id, dto.commentableId))
            .limit(1);
          if (ch?.mangaId) {
            const [m] = await this.db.select({ slug: manga.slug }).from(manga).where(eq(manga.id, ch.mangaId)).limit(1);
            event.mangaSlug = m?.slug ?? null;
          } else {
            event.mangaSlug = null;
          }
        } else {
          event.mangaSlug = null;
        }
        event.commentOwnerId = parent.userId;
        this.eventEmitter.emit('comment.replied', event);
      }
    }

    return comment;
  }

  async update(commentId: number, userId: number, dto: UpdateCommentDto) {
    const comment = await this.findOrFail(commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException("Cannot edit another user's comment");
    }

    const [updated] = await this.db
      .update(comments)
      .set({ content: sanitizeContent(dto.content) })
      .where(eq(comments.id, commentId))
      .returning();

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

    const [existing] = await this.db
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
      await this.db
        .delete(commentLikes)
        .where(eq(commentLikes.id, existing.id));

      // Decrement the old counter
      if (existing.isDislike) {
        await this.db
          .update(comments)
          .set({
            dislikesCount: sql`GREATEST(${comments.dislikesCount} - 1, 0)`,
          })
          .where(eq(comments.id, commentId));
      } else {
        await this.db
          .update(comments)
          .set({ likesCount: sql`GREATEST(${comments.likesCount} - 1, 0)` })
          .where(eq(comments.id, commentId));
      }

      // If same type → just un-toggle, return
      if (existing.isDislike === isDislike) {
        const [c] = await this.db
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
        };
      }
    }

    // Insert new reaction
    await this.db.insert(commentLikes).values({ userId, commentId, isDislike });

    // Increment the new counter
    if (isDislike) {
      await this.db
        .update(comments)
        .set({ dislikesCount: sql`${comments.dislikesCount} + 1` })
        .where(eq(comments.id, commentId));
    } else {
      await this.db
        .update(comments)
        .set({ likesCount: sql`${comments.likesCount} + 1` })
        .where(eq(comments.id, commentId));

      // Emit like notification (only for likes, not dislikes)
      if (commentData.userId && commentData.userId !== userId) {
        const event = new CommentLikeEvent();
        event.commentId = commentId;
        event.likerName = userName ?? '';
        event.likerAvatar = userAvatar ?? null;
        event.commentOwnerId = commentData.userId;
        event.commentPreview = (commentData.content ?? '').slice(0, 100);
        if (commentData.commentableType === 'manga' && commentData.commentableId) {
          const [m] = await this.db
            .select({ slug: manga.slug })
            .from(manga)
            .where(eq(manga.id, commentData.commentableId))
            .limit(1);
          event.mangaSlug = m?.slug ?? null;
        } else if (commentData.commentableType === 'chapter' && commentData.commentableId) {
          const [ch] = await this.db
            .select({ mangaId: chapters.mangaId })
            .from(chapters)
            .where(eq(chapters.id, commentData.commentableId))
            .limit(1);
          if (ch?.mangaId) {
            const [m] = await this.db.select({ slug: manga.slug }).from(manga).where(eq(manga.id, ch.mangaId)).limit(1);
            event.mangaSlug = m?.slug ?? null;
          } else {
            event.mangaSlug = null;
          }
        } else {
          event.mangaSlug = null;
        }
        this.eventEmitter.emit('comment.liked', event);
      }
    }

    const [c] = await this.db
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
    };
  }

  /** Backward-compatible wrapper */
  async toggleLike(commentId: number, userId: number, likerName?: string, likerAvatar?: string | null) {
    return this.toggleReaction(commentId, userId, false, likerName, likerAvatar);
  }

  async toggleDislike(commentId: number, userId: number) {
    return this.toggleReaction(commentId, userId, true);
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
