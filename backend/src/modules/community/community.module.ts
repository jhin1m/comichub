import { Module } from '@nestjs/common';
import { CommentController } from './controllers/comment.controller.js';
import { RatingController } from './controllers/rating.controller.js';
import { FollowController } from './controllers/follow.controller.js';
import { ReadingHistoryController } from './controllers/reading-history.controller.js';
import { ReportController } from './controllers/report.controller.js';
import { StickerController } from './controllers/sticker.controller.js';
import { CommentService } from './services/comment.service.js';
import { RatingService } from './services/rating.service.js';
import { FollowService } from './services/follow.service.js';
import { ReadingHistoryService } from './services/reading-history.service.js';
import { ReportService } from './services/report.service.js';
import { StickerService } from './services/sticker.service.js';

@Module({
  controllers: [
    CommentController,
    RatingController,
    FollowController,
    ReadingHistoryController,
    ReportController,
    StickerController,
  ],
  providers: [
    CommentService,
    RatingService,
    FollowService,
    ReadingHistoryService,
    ReportService,
    StickerService,
  ],
})
export class CommunityModule {}
