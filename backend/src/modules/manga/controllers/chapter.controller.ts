import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ChapterService } from '../services/chapter.service.js';
import { ChapterImageService } from '../services/chapter-image.service.js';
import { ViewTrackingService } from '../services/view-tracking.service.js';
import { CreateChapterDto } from '../dto/create-chapter.dto.js';
import { UpdateChapterDto } from '../dto/update-chapter.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';

@ApiTags('chapters')
@Controller()
export class ChapterController {
  constructor(
    private readonly chapterService: ChapterService,
    private readonly chapterImageService: ChapterImageService,
    private readonly viewTrackingService: ViewTrackingService,
  ) {}

  @Public()
  @Get('manga/:mangaId/chapters')
  @ApiOperation({ summary: 'List chapters for a manga' })
  @ApiParam({ name: 'mangaId', type: Number })
  @ApiResponse({ status: 200, description: 'Chapter list' })
  findByManga(@Param('mangaId', ParseIntPipe) mangaId: number) {
    return this.chapterService.findByManga(mangaId);
  }

  @Public()
  @Get('chapters/:id')
  @ApiOperation({ summary: 'Get chapter with images (reader)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Chapter with images' })
  @ApiResponse({ status: 404, description: 'Chapter not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @CurrentUser() user?: JwtPayload,
  ) {
    const chapter = await this.chapterService.findOne(id);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip;
    await this.viewTrackingService.trackChapterView(id, user?.sub, ip);
    return chapter;
  }

  @Public()
  @Get('chapters/:id/navigation')
  @ApiOperation({ summary: 'Get prev/next chapter navigation' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Navigation info' })
  getNavigation(@Param('id', ParseIntPipe) id: number) {
    return this.chapterService.getNavigation(id);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Post('manga/:mangaId/chapters')
  @ApiOperation({ summary: 'Create chapter (admin only)' })
  @ApiParam({ name: 'mangaId', type: Number })
  @ApiResponse({ status: 201, description: 'Chapter created' })
  create(
    @Param('mangaId', ParseIntPipe) mangaId: number,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chapterService.create(mangaId, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Patch('chapters/:id')
  @ApiOperation({ summary: 'Update chapter (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Chapter updated' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChapterDto) {
    return this.chapterService.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Delete('chapters/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete chapter (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Chapter deleted' })
  async removeChapter(@Param('id', ParseIntPipe) id: number) {
    await this.chapterService.remove(id);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Post('chapters/:id/images')
  @UseInterceptors(
    FilesInterceptor('images', 200, { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
        mangaId: { type: 'integer' },
      },
      required: ['images', 'mangaId'],
    },
  })
  @ApiOperation({ summary: 'Upload chapter images to S3 (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Images uploaded' })
  uploadImages(
    @Param('id', ParseIntPipe) id: number,
    @Body('mangaId', ParseIntPipe) mangaId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.chapterImageService.uploadImages(id, mangaId, files);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Delete('chapters/:id/images')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all chapter images (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Images cleared' })
  async clearImages(
    @Param('id', ParseIntPipe) id: number,
    @Body('mangaId', ParseIntPipe) mangaId: number,
  ) {
    await this.chapterImageService.clearImages(id, mangaId);
  }
}
