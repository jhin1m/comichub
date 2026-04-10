import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import { UserService } from '../services/user.service.js';
import { FollowService } from '../services/follow.service.js';
import { HistoryService } from '../services/history.service.js';
import { UpdateProfileDto } from '../dto/update-profile.dto.js';
import { BulkRemoveHistoryDto } from '../dto/bulk-remove-history.dto.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly followService: FollowService,
    private readonly historyService: HistoryService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my full profile' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.getMe(user.sub);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my profile' })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user.sub, dto);
  }

  @Post('me/avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload avatar (256x256 webp)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    return this.userService.uploadAvatar(user.sub, file);
  }

  @Get('me/follows')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List followed manga (paginated)' })
  getFollows(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    return this.followService.getFollows(user.sub, pagination);
  }

  @Get('me/follows/ids')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all followed manga IDs' })
  getFollowedIds(@CurrentUser() user: JwtPayload) {
    return this.followService.getFollowedIds(user.sub);
  }

  @Get('me/history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reading history (paginated, recent first)' })
  getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    return this.historyService.getHistory(user.sub, pagination);
  }

  @Delete('me/history/bulk')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove multiple manga from reading history' })
  @HttpCode(HttpStatus.OK)
  removeHistoryBulk(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkRemoveHistoryDto,
  ) {
    return this.historyService.removeMany(user.sub, dto.mangaIds);
  }

  @Get('me/history/:mangaId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get last-read chapter for a specific manga' })
  getHistoryEntry(
    @CurrentUser() user: JwtPayload,
    @Param('mangaId', ParseIntPipe) mangaId: number,
  ) {
    return this.historyService.getEntryByManga(user.sub, mangaId);
  }

  @Patch('me/history/:mangaId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove manga from reading history' })
  @HttpCode(HttpStatus.OK)
  removeHistory(
    @CurrentUser() user: JwtPayload,
    @Param('mangaId', ParseIntPipe) mangaId: number,
  ) {
    return this.historyService.removeEntry(user.sub, mangaId);
  }

  @Patch('me/history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all reading history' })
  @HttpCode(HttpStatus.OK)
  clearHistory(@CurrentUser() user: JwtPayload) {
    return this.historyService.clearAll(user.sub);
  }

  @Get(':uuid')
  @Public()
  @ApiOperation({ summary: 'Get public profile by UUID' })
  getPublicProfile(@Param('uuid') uuid: string) {
    return this.userService.getPublicProfile(uuid);
  }
}
