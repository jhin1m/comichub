import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and, isNull, desc, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { notifications, follows } from '../../database/schema/index.js';
import type { NotificationQueryDto } from './dto/notification-query.dto.js';
import type { NewChapterEvent } from './events/new-chapter.event.js';
import type { CommentReplyEvent } from './events/comment-reply.event.js';
import type { CommentLikeEvent } from './events/comment-like.event.js';
import { DiscordWebhookService } from './discord/discord-webhook.service.js';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly discord: DiscordWebhookService,
  ) {}

  // ─── Event Handlers ────────────────────────────────────────────────

  @OnEvent('chapter.created')
  async handleNewChapter(event: NewChapterEvent): Promise<void> {
    await this.createForFollowers(event);
    await this.discord.sendNewChapter(event);
  }

  @OnEvent('comment.replied')
  async handleCommentReply(event: CommentReplyEvent): Promise<void> {
    await this.createSingle(event.commentOwnerId, 'comment.replied', {
      commentId: event.commentId,
      replyAuthorName: event.replyAuthorName,
      mangaId: event.mangaId,
    });
  }

  @OnEvent('comment.liked')
  async handleCommentLike(event: CommentLikeEvent): Promise<void> {
    await this.createSingle(event.commentOwnerId, 'comment.liked', {
      commentId: event.commentId,
      likerName: event.likerName,
      commentPreview: event.commentPreview,
    });
  }

  // ─── Core Methods ───────────────────────────────────────────────────

  async createForFollowers(event: NewChapterEvent): Promise<void> {
    const followerRows = await this.db
      .select({ userId: follows.userId })
      .from(follows)
      .where(eq(follows.mangaId, event.mangaId));

    if (followerRows.length === 0) return;

    const payload = {
      mangaId: event.mangaId,
      mangaTitle: event.mangaTitle,
      chapterId: event.chapterId,
      chapterNumber: event.chapterNumber,
      mangaCover: event.mangaCover,
    };

    const records = followerRows.map((row) => ({
      notifiableType: 'user',
      notifiableId: row.userId,
      type: 'chapter.created',
      data: payload,
    }));

    // Batch insert in chunks of 100 to avoid param limits
    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      await this.db.insert(notifications).values(records.slice(i, i + chunkSize));
    }
  }

  async createSingle(
    userId: number,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(notifications).values({
      notifiableType: 'user',
      notifiableId: userId,
      type,
      data,
    });
  }

  async list(userId: number, query: NotificationQueryDto) {
    const { page, limit, type } = query;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(notifications.notifiableType, 'user'),
      eq(notifications.notifiableId, userId),
    ];
    if (type) {
      conditions.push(eq(notifications.type, type));
    }

    const where = and(...conditions);

    const [totalRow, rows] = await Promise.all([
      this.db.select({ cnt: count() }).from(notifications).where(where),
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow[0]?.cnt ?? 0;
    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: number): Promise<{ count: number }> {
    const [row] = await this.db
      .select({ cnt: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.notifiableType, 'user'),
          eq(notifications.notifiableId, userId),
          isNull(notifications.readAt),
        ),
      );

    return { count: row?.cnt ?? 0 };
  }

  async markRead(userId: number, id: string): Promise<{ message: string }> {
    const notification = await this.db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (
      notification.notifiableType !== 'user' ||
      notification.notifiableId !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    await this.db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(eq(notifications.id, id));

    return { message: 'Marked as read' };
  }

  async markAllRead(userId: number): Promise<{ message: string }> {
    await this.db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(notifications.notifiableType, 'user'),
          eq(notifications.notifiableId, userId),
          isNull(notifications.readAt),
        ),
      );

    return { message: 'All notifications marked as read' };
  }

  async delete(userId: number, id: string): Promise<{ message: string }> {
    const notification = await this.db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });

    if (!notification) throw new NotFoundException('Notification not found');
    if (
      notification.notifiableType !== 'user' ||
      notification.notifiableId !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    await this.db.delete(notifications).where(eq(notifications.id, id));

    return { message: 'Notification deleted' };
  }
}
