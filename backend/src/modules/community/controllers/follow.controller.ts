import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FollowService } from '../services/follow.service.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { User } from '../../../database/schema/index.js';

@ApiTags('follows')
@ApiBearerAuth()
@Controller('manga/:id')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post('follow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle follow/unfollow manga' })
  toggle(
    @Param('id', ParseIntPipe) mangaId: number,
    @CurrentUser() user: User,
  ) {
    return this.followService.toggle(mangaId, user.id);
  }

  @Get('follow')
  @ApiOperation({ summary: 'Check follow status' })
  isFollowing(
    @Param('id', ParseIntPipe) mangaId: number,
    @CurrentUser() user: User,
  ) {
    return this.followService.isFollowing(mangaId, user.id);
  }
}
