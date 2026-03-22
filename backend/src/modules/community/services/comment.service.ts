import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
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
} from '../dto/create-comment.dto.js';
import { CommentReplyEvent } from '../../notification/events/comment-reply.event.js';
import { CommentLikeEvent } from '../../notification/events/comment-like.event.js';

const MAX_DEPTH = 3;

@Injectable()
export class CommentService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    // For chapter comments, resolve the manga info
    const chapterMangaIds = rows
      .filter((r) => r.commentableType === 'chapter' && r.chapterMangaId)
      .map((r) => r.chapterMangaId as number);

    let mangaMap = new Map<number, { title: string; slug: string; cover: string | null }>();
    if (chapterMangaIds.length > 0) {
      const uniqueIds = [...new Set(chapterMangaIds)];
      const mangaRows = await this.db
        .select({ id: manga.id, title: manga.title, slug: manga.slug, cover: manga.cover })
        .from(manga)
        .where(sql`${manga.id} IN (${sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)})`);
      mangaMap = new Map(mangaRows.map((m) => [m.id, m]));
    }

    return rows.map((row) => {
      const isChapter = row.commentableType === 'chapter';
      const resolvedManga = isChapter && row.chapterMangaId
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

  async listForManga(mangaId: number, pagination: PaginationDto) {
    return this.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.commentableType, CommentableType.MANGA),
          eq(comments.commentableId, mangaId),
          isNull(comments.parentId),
          isNull(comments.deletedAt),
        ),
      )
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(comments.createdAt);
  }

  async listForChapter(chapterId: number, pagination: PaginationDto) {
    return this.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.commentableType, CommentableType.CHAPTER),
          eq(comments.commentableId, chapterId),
          isNull(comments.parentId),
          isNull(comments.deletedAt),
        ),
      )
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(comments.createdAt);
  }

  async getReplies(commentId: number, pagination: PaginationDto) {
    return this.db
      .select()
      .from(comments)
      .where(and(eq(comments.parentId, commentId), isNull(comments.deletedAt)))
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy(comments.createdAt);
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

  async create(userId: number, dto: CreateCommentDto, userName?: string) {
    if (dto.parentId) {
      await this.validateDepth(dto.parentId);
    }

    const [comment] = await this.db
      .insert(comments)
      .values({
        userId,
        commentableType: dto.commentableType,
        commentableId: dto.commentableId,
        parentId: dto.parentId ?? null,
        content: dto.content,
      })
      .returning();

    // Emit reply notification if this is a reply to another comment
    if (dto.parentId) {
      const parent = await this.findOrFail(dto.parentId);
      if (parent.userId && parent.userId !== userId) {
        const event = new CommentReplyEvent();
        event.commentId = dto.parentId;
        event.replyAuthorName = userName ?? '';
        event.mangaId =
          dto.commentableType === CommentableType.MANGA
            ? dto.commentableId
            : null;
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
      .set({ content: dto.content })
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

  async toggleLike(commentId: number, userId: number, likerName?: string) {
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

    if (existing) {
      await this.db
        .delete(commentLikes)
        .where(eq(commentLikes.id, existing.id));

      const [updated] = await this.db
        .update(comments)
        .set({ likesCount: sql`${comments.likesCount} - 1` })
        .where(eq(comments.id, commentId))
        .returning({ likesCount: comments.likesCount });

      return { liked: false, likesCount: updated?.likesCount ?? 0 };
    }

    await this.db.insert(commentLikes).values({ userId, commentId });

    const [updated] = await this.db
      .update(comments)
      .set({ likesCount: sql`${comments.likesCount} + 1` })
      .where(eq(comments.id, commentId))
      .returning({ likesCount: comments.likesCount });

    // Emit like notification (don't notify self)
    if (commentData.userId && commentData.userId !== userId) {
      const event = new CommentLikeEvent();
      event.commentId = commentId;
      event.likerName = likerName ?? '';
      event.commentOwnerId = commentData.userId;
      event.commentPreview = (commentData.content ?? '').slice(0, 100);
      this.eventEmitter.emit('comment.liked', event);
    }

    return { liked: true, likesCount: updated?.likesCount ?? 0 };
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
    let depth = 1;
    let currentId: number | null = parentId;

    while (currentId !== null && depth <= MAX_DEPTH) {
      const [parent] = await this.db
        .select({ parentId: comments.parentId })
        .from(comments)
        .where(eq(comments.id, currentId))
        .limit(1);

      if (!parent) break;
      currentId = parent.parentId;
      depth++;
    }

    if (depth > MAX_DEPTH) {
      throw new BadRequestException(
        `Max comment depth of ${MAX_DEPTH} exceeded`,
      );
    }
  }
}
