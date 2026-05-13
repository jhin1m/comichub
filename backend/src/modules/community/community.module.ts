import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module.js';
import { CommentController } from './controllers/comment.controller.js';
import { CommentReportsController } from './controllers/comment-reports.controller.js';
import { AdminCommentReportsController } from './controllers/admin-comment-reports.controller.js';
import { CommentStreamController } from './controllers/comment-stream.controller.js';
import { RatingController } from './controllers/rating.controller.js';
import { FollowController } from './controllers/follow.controller.js';
import { ReadingHistoryController } from './controllers/reading-history.controller.js';
import { ReportController } from './controllers/report.controller.js';
import { StickerController } from './controllers/sticker.controller.js';
import { CommentService } from './services/comment.service.js';
import { CommentMentionService } from './services/comment-mention.service.js';
import { CommentReportsService } from './services/comment-reports.service.js';
import { ModerationService } from './services/moderation.service.js';
import { ModerationListener } from './listeners/moderation.listener.js';
import { RatingService } from './services/rating.service.js';
import { FollowService } from './services/follow.service.js';
import { ReadingHistoryService } from './services/reading-history.service.js';
import { ReportService } from './services/report.service.js';
import { StickerService } from './services/sticker.service.js';

@Module({
  imports: [UserModule],
  controllers: [
    CommentController,
    CommentReportsController,
    AdminCommentReportsController,
    CommentStreamController,
    RatingController,
    FollowController,
    ReadingHistoryController,
    ReportController,
    StickerController,
  ],
  providers: [
    CommentService,
    CommentMentionService,
    CommentReportsService,
    ModerationService,
    ModerationListener,
    RatingService,
    FollowService,
    ReadingHistoryService,
    ReportService,
    StickerService,
  ],
})
export class CommunityModule {}
