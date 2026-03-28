import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { BookmarkService } from '../services/bookmark.service.js';
import { AddBookmarkDto } from '../dto/add-bookmark.dto.js';
import { ChangeFolderDto } from '../dto/change-folder.dto.js';
import { BookmarkQueryDto } from '../dto/bookmark-query.dto.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Get()
  @ApiOperation({ summary: 'List bookmarks with filters' })
  getBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: BookmarkQueryDto,
  ) {
    return this.bookmarkService.getBookmarks(user.sub, query);
  }

  @Get('status/:mangaId')
  @ApiOperation({ summary: 'Get bookmark status for a manga' })
  getStatus(
    @CurrentUser() user: JwtPayload,
    @Param('mangaId', ParseIntPipe) mangaId: number,
  ) {
    return this.bookmarkService.getStatus(user.sub, mangaId);
  }

  @Post(':mangaId')
  @ApiOperation({ summary: 'Add bookmark' })
  @HttpCode(HttpStatus.OK)
  addBookmark(
    @CurrentUser() user: JwtPayload,
    @Param('mangaId', ParseIntPipe) mangaId: number,
    @Body() dto: AddBookmarkDto,
  ) {
    return this.bookmarkService.addBookmark(user.sub, mangaId, dto.folderId);
  }

  @Patch(':mangaId')
  @ApiOperation({ summary: 'Change bookmark folder' })
  changeFolder(
    @CurrentUser() user: JwtPayload,
    @Param('mangaId', ParseIntPipe) mangaId: number,
    @Body() dto: ChangeFolderDto,
  ) {
    return this.bookmarkService.changeFolder(user.sub, mangaId, dto.folderId);
  }

  @Delete(':mangaId')
  @ApiOperation({ summary: 'Remove bookmark' })
  @HttpCode(HttpStatus.OK)
  removeBookmark(
    @CurrentUser() user: JwtPayload,
    @Param('mangaId', ParseIntPipe) mangaId: number,
  ) {
    return this.bookmarkService.removeBookmark(user.sub, mangaId);
  }
}
