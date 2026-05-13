import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  comments,
  commentReports,
} from '../../../database/schema/community.schema.js';
import { users } from '../../../database/schema/user.schema.js';
import {
  CreateCommentReportDto,
  CommentReportReason,
} from '../dto/create-comment-report.dto.js';
import {
  ResolveCommentReportDto,
  ResolveCommentReportAction,
} from '../dto/resolve-comment-report.dto.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';

const AUTO_FLAG_THRESHOLD = 3;

@Injectable()
export class CommentReportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * User submits a report. UNIQUE(commentId, reporterId) at DB level → re-report = 409.
   * Auto-flag at AUTO_FLAG_THRESHOLD pending reports: comment hidden from public.
   */
  async reportComment(
    commentId: number,
    reporterId: number,
    dto: CreateCommentReportDto,
  ) {
    const [target] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!target) throw new NotFoundException('Comment not found');
    if (target.userId === reporterId) {
      throw new BadRequestException('Cannot report your own comment');
    }

    try {
      await this.db.insert(commentReports).values({
        commentId,
        reporterId,
        reason: dto.reason,
        details: dto.details ?? null,
      });
    } catch (err) {
      // Postgres unique-violation SQLSTATE is 23505 — check the error code rather
      // than message string, which can vary across PG versions / locales.
      const pgCode = (err as { code?: string } | null)?.code;
      if (pgCode === '23505') {
        throw new ConflictException('You have already reported this comment');
      }
      throw err;
    }

    const [{ cnt }] = await this.db
      .select({ cnt: count() })
      .from(commentReports)
      .where(
        and(
          eq(commentReports.commentId, commentId),
          eq(commentReports.status, 'pending'),
        ),
      );

    if (cnt >= AUTO_FLAG_THRESHOLD) {
      // Atomic guard: only flip to 'flagged' if status is still benign. Returns
      // affected row when the transition actually happened — gates the event so
      // concurrent reports past threshold don't double-emit `auto_flagged`.
      const updated = await this.db
        .update(comments)
        .set({ moderationStatus: 'flagged' })
        .where(
          and(
            eq(comments.id, commentId),
            sql`${comments.moderationStatus} NOT IN ('flagged', 'rejected')`,
          ),
        )
        .returning({ id: comments.id });
      if (updated.length > 0) {
        this.eventEmitter.emit('comment.auto_flagged', {
          commentId,
          reportCount: cnt,
        });
      }
    }

    this.eventEmitter.emit('comment.reported', {
      commentId,
      reporterId,
      reason: dto.reason,
    });

    return { success: true, pendingCount: cnt };
  }

  /**
   * Admin queue listing. Joins reporter user and parent comment for preview.
   */
  async listReports(
    pagination: PaginationDto,
    status?: 'pending' | 'resolved' | 'dismissed',
  ) {
    const where = status ? eq(commentReports.status, status) : undefined;
    const [data, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: commentReports.id,
          commentId: commentReports.commentId,
          reason: commentReports.reason,
          details: commentReports.details,
          status: commentReports.status,
          createdAt: commentReports.createdAt,
          resolvedAt: commentReports.resolvedAt,
          reporterId: commentReports.reporterId,
          reporterName: users.name,
          reporterAvatar: users.avatar,
          commentContent: comments.content,
          commentAuthorId: comments.userId,
          commentDeletedAt: comments.deletedAt,
        })
        .from(commentReports)
        .leftJoin(users, eq(commentReports.reporterId, users.id))
        .leftJoin(comments, eq(commentReports.commentId, comments.id))
        .where(where)
        .orderBy(desc(commentReports.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(commentReports)
        .where(where),
    ]);

    return {
      data,
      total: totalRow?.total ?? 0,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  /**
   * Admin resolves a report. Three actions:
   *   - dismiss: mark dismissed, no side effect
   *   - delete_comment: soft-delete comment, mark resolved + notify author
   *   - warn_user: keep comment, mark resolved + notify author (warning notification)
   */
  async resolveReport(
    reportId: number,
    adminId: number,
    dto: ResolveCommentReportDto,
  ) {
    const [report] = await this.db
      .select()
      .from(commentReports)
      .where(eq(commentReports.id, reportId))
      .limit(1);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'pending') {
      throw new BadRequestException('Report already resolved');
    }

    const action = dto.action;
    if (action === ResolveCommentReportAction.DISMISS) {
      await this.db
        .update(commentReports)
        .set({
          status: 'dismissed',
          resolvedBy: adminId,
          resolvedAt: new Date(),
        })
        .where(eq(commentReports.id, reportId));
      return { success: true, action };
    }

    // Both DELETE_COMMENT and WARN_USER mark report resolved.
    if (action === ResolveCommentReportAction.DELETE_COMMENT) {
      await this.db
        .update(comments)
        .set({
          deletedAt: new Date(),
          moderationStatus: 'rejected',
        })
        .where(eq(comments.id, report.commentId));

      // Also mark ALL pending reports for this comment as resolved (no need to re-review).
      await this.db
        .update(commentReports)
        .set({
          status: 'resolved',
          resolvedBy: adminId,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(commentReports.commentId, report.commentId),
            eq(commentReports.status, 'pending'),
          ),
        );

      this.eventEmitter.emit('comment.removed_by_admin', {
        commentId: report.commentId,
        adminId,
        reason: report.reason,
        note: dto.resolutionNote,
      });
      return { success: true, action };
    }

    if (action === ResolveCommentReportAction.WARN_USER) {
      await this.db
        .update(commentReports)
        .set({
          status: 'resolved',
          resolvedBy: adminId,
          resolvedAt: new Date(),
        })
        .where(eq(commentReports.id, reportId));

      this.eventEmitter.emit('comment.warned', {
        commentId: report.commentId,
        adminId,
        reason: report.reason,
        note: dto.resolutionNote,
      });
      return { success: true, action };
    }

    throw new BadRequestException(`Unknown action: ${String(action)}`);
  }
}

export { CommentReportReason };
