import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { comments } from '../../../database/schema/community.schema.js';
import {
  ModerationService,
  type ModerationResult,
} from '../services/moderation.service.js';
import { CommentMentionEvent } from '../../notification/events/comment-mention.event.js';
import { CommentReplyEvent } from '../../notification/events/comment-reply.event.js';

export interface CommentCreatedPayload {
  commentId: number;
  authorId: number | null;
  content: string;
  commentableType: string;
  commentableId: number;
  // Enrichment carried through the moderation pipeline so notifications
  // can be emitted post-approval without a second DB lookup.
  userName?: string;
  userAvatar?: string | null;
  mangaSlug?: string | null;
  mangaId?: number | null;
  mentionedUserIds?: number[];
  parentCommentId?: number | null;
  replyTargetUserId?: number | null;
}

const PERSIST_MAX_ATTEMPTS = 3;
const PERSIST_RETRY_BASE_MS = 100;

/**
 * Listens for `comment.created` events and runs async OpenAI moderation
 * out-of-band. User is never blocked — initial insert sets status based
 * on whether moderation is enabled; this listener finalizes it.
 *
 * Critical invariants:
 *  - UPDATE is race-guarded with `moderation_status = 'pending'` so an
 *    auto-flag from `comment-reports.service` can't be silently clobbered.
 *  - DB persist retries 3x; final failure emits `comment.moderation_persist_failed`
 *    instead of black-holing the comment in `pending`.
 *  - SSE broadcast and mention/reply notifications fire ONLY after moderation
 *    approves — prevents rejected content from leaking to other users' feeds.
 */
@Injectable()
export class ModerationListener {
  private readonly logger = new Logger(ModerationListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly moderation: ModerationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('comment.created')
  async handle(payload: CommentCreatedPayload): Promise<void> {
    if (!this.moderation.isEnabled()) {
      // Comment inserted as 'approved'; safe to cascade immediately.
      this.cascadeApproved(payload);
      return;
    }

    const result = await this.moderation.moderate(payload.content);

    let persistOutcome: 'applied' | 'skipped';
    try {
      persistOutcome = await this.persistWithRetry(payload.commentId, result);
    } catch (err) {
      this.logger.error(
        `Moderation persist failed permanently for comment ${payload.commentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      this.eventEmitter.emit('comment.moderation_persist_failed', {
        commentId: payload.commentId,
        authorId: payload.authorId,
      });
      return;
    }

    if (persistOutcome === 'skipped') {
      // Another writer (e.g. reports auto-flag) already mutated status away
      // from 'pending'; don't overwrite and don't cascade.
      this.logger.log(
        `Moderation skipped for comment ${payload.commentId} — status changed externally`,
      );
      return;
    }

    if (result.status === 'rejected') {
      this.eventEmitter.emit('comment.moderation_rejected', {
        commentId: payload.commentId,
        authorId: payload.authorId,
      });
      return;
    }
    if (result.status === 'flagged') {
      this.eventEmitter.emit('comment.moderation_flagged', {
        commentId: payload.commentId,
        authorId: payload.authorId,
      });
      return;
    }
    this.cascadeApproved(payload);
  }

  private cascadeApproved(payload: CommentCreatedPayload): void {
    this.eventEmitter.emit('comment.created.public', {
      commentableType: payload.commentableType,
      commentableId: payload.commentableId,
      authorId: payload.authorId,
    });

    const preview = payload.content.slice(0, 100);

    if (payload.mentionedUserIds && payload.mentionedUserIds.length > 0) {
      for (const mentionedId of payload.mentionedUserIds) {
        const event = new CommentMentionEvent();
        event.commentId = payload.commentId;
        event.mentionedUserId = mentionedId;
        event.mentionerName = payload.userName ?? '';
        event.mentionerAvatar = payload.userAvatar ?? null;
        event.mentionPreview = preview;
        event.mangaSlug = payload.mangaSlug ?? null;
        this.eventEmitter.emit('comment.mentioned', event);
      }
    }

    if (
      payload.replyTargetUserId &&
      payload.replyTargetUserId !== payload.authorId &&
      payload.parentCommentId
    ) {
      const event = new CommentReplyEvent();
      event.commentId = payload.parentCommentId;
      event.replyAuthorName = payload.userName ?? '';
      event.replyAuthorAvatar = payload.userAvatar ?? null;
      event.replyContent = preview;
      event.mangaId = payload.mangaId ?? null;
      event.mangaSlug = payload.mangaSlug ?? null;
      event.commentOwnerId = payload.replyTargetUserId;
      this.eventEmitter.emit('comment.replied', event);
    }
  }

  private async persistWithRetry(
    commentId: number,
    result: ModerationResult,
  ): Promise<'applied' | 'skipped'> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= PERSIST_MAX_ATTEMPTS; attempt++) {
      try {
        const affected = await this.db
          .update(comments)
          .set({
            moderationStatus: result.status,
            moderationScore: result.score,
          })
          .where(
            and(
              eq(comments.id, commentId),
              eq(comments.moderationStatus, 'pending'),
            ),
          )
          .returning({ id: comments.id });
        return affected.length > 0 ? 'applied' : 'skipped';
      } catch (err) {
        lastError = err;
        if (attempt < PERSIST_MAX_ATTEMPTS) {
          await new Promise((r) =>
            setTimeout(r, PERSIST_RETRY_BASE_MS * attempt),
          );
        }
      }
    }
    throw lastError;
  }
}
