import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/types/jwt-payload.type.js';
import { ImportExportService } from '../services/import-export.service.js';
import {
  ImportBookmarkDto,
  ExportBookmarkDto,
  ImportFormat,
  ImportStrategy,
  ExportFormat,
} from '../dto/import-bookmark.dto.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import bookmarks from MAL XML or JSON file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  async importBookmarks(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportBookmarkDto,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const entries = this.parseFile(file, dto.format);
    const strategy = dto.strategy ?? ImportStrategy.SKIP;
    const result = await this.importExportService.importBookmarks(
      user.sub,
      entries,
      strategy,
    );

    return result;
  }

  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview import matches without writing to DB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  async previewImport(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportBookmarkDto,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const entries = this.parseFile(file, dto.format);
    const matches = await this.importExportService.matchTitles(entries);

    return {
      total: entries.length,
      matched: matches.filter((m) => m.matched !== null).length,
      notFound: matches.filter((m) => m.matched === null).length,
      entries: matches.map((m) => ({
        title: m.entry.title,
        status: m.entry.status,
        matched: m.matched,
        confidence: m.confidence,
      })),
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export bookmarks as JSON or MAL-compatible XML' })
  async exportBookmarks(
    @CurrentUser() user: JwtPayload,
    @Query() query: ExportBookmarkDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? ExportFormat.JSON;
    const folderId = query.folderId ? Number(query.folderId) : undefined;

    const content = await this.importExportService.exportBookmarks(
      user.sub,
      format,
      folderId,
    );

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === ExportFormat.XML) {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bookmarks-${timestamp}.xml"`,
      );
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bookmarks-${timestamp}.json"`,
      );
    }

    res.send(content);
  }

  private parseFile(file: Express.Multer.File, format: ImportFormat) {
    if (format === ImportFormat.MAL_XML) {
      return this.importExportService.parseMALXml(file.buffer);
    }

    if (format === ImportFormat.MAL_JSON) {
      try {
        const json = JSON.parse(file.buffer.toString('utf-8'));
        return this.importExportService.parseMALJson(json);
      } catch {
        throw new BadRequestException('Invalid JSON format');
      }
    }

    throw new BadRequestException('Unsupported format');
  }
}
