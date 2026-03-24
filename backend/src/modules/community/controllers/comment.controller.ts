import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentService } from '../services/comment.service.js';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentQueryDto,
} from '../dto/create-comment.dto.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('comments')
@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get('comments/recent')
  @ApiOperation({ summary: 'Get recent comments across all manga/chapters' })
  getRecent(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.commentService.getRecent(Math.min(limit ?? 10, 50));
  }

  @Public()
  @Get('manga/:id/comments')
  @ApiOperation({ summary: 'List manga comments (paginated)' })
  listForManga(
    @Param('id', ParseIntPipe) mangaId: number,
    @Query() query: CommentQueryDto,
    @CurrentUser() user?: User,
  ) {
    return this.commentService.listForManga(mangaId, query, user?.id);
  }

  @Public()
  @Get('chapters/:id/comments')
  @ApiOperation({ summary: 'List chapter comments (paginated)' })
  listForChapter(
    @Param('id', ParseIntPipe) chapterId: number,
    @Query() query: CommentQueryDto,
    @CurrentUser() user?: User,
  ) {
    return this.commentService.listForChapter(chapterId, query, user?.id);
  }

  @Public()
  @Get('comments/:id/replies')
  @ApiOperation({ summary: 'Get replies to a comment' })
  getReplies(
    @Param('id', ParseIntPipe) commentId: number,
    @Query() pagination: PaginationDto,
    @CurrentUser() user?: User,
  ) {
    return this.commentService.getReplies(commentId, pagination, user?.id);
  }

  @Get('users/me/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List own comments' })
  getMyComments(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return this.commentService.getMyComments(user.id, pagination);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create comment' })
  create(@CurrentUser() user: User, @Body() dto: CreateCommentDto) {
    return this.commentService.create(user.id, dto, user.name);
  }

  @Patch('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit own comment' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(id, user.id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete comment (own or admin)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    await this.commentService.remove(id, user.id, user.role);
  }

  @Post('comments/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like on comment' })
  toggleLike(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.commentService.toggleLike(id, user.id, user.name);
  }

  @Post('comments/:id/dislike')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle dislike on comment' })
  toggleDislike(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.commentService.toggleDislike(id, user.id);
  }
}
