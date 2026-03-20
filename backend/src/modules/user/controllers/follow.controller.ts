import {
  Controller,
  Post,
  Get,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { FollowService } from '../services/follow.service.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';

@ApiTags('manga-follows')
@Controller('manga')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':id/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle follow/unfollow manga' })
  @HttpCode(HttpStatus.OK)
  toggleFollow(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) mangaId: number,
  ) {
    return this.followService.toggleFollow(user.sub, mangaId);
  }

  @Get(':id/is-followed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user follows this manga' })
  isFollowed(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) mangaId: number,
  ) {
    return this.followService.isFollowed(user.sub, mangaId);
  }
}
