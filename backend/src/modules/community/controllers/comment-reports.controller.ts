import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommentReportsService } from '../services/comment-reports.service.js';
import { CreateCommentReportDto } from '../dto/create-comment-report.dto.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('comment-reports')
@Controller('comments')
export class CommentReportsController {
  constructor(private readonly service: CommentReportsService) {}

  @Post(':id/report')
  // 3 reports per hour per user — dedicated limiter prevents brigading abuse.
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a comment for abuse' })
  report(
    @Param('id', ParseIntPipe) commentId: number,
    @CurrentUser() user: User,
    @Body() dto: CreateCommentReportDto,
  ) {
    return this.service.reportComment(commentId, user.id, dto);
  }
}
