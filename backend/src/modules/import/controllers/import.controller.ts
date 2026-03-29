import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { ImportService } from '../services/import.service.js';
import { ImportSearchDto } from '../dto/import-search.dto.js';
import { ImportMangaDto } from '../dto/import-manga.dto.js';

@ApiTags('import')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(RolesGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search external source for manga (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Search results from external source',
  })
  search(@Query() dto: ImportSearchDto) {
    return this.importService.searchManga(dto.source, dto.q);
  }

  @Post('manga')
  @ApiOperation({ summary: 'Import manga from external source (admin only)' })
  @ApiResponse({ status: 201, description: 'Manga imported successfully' })
  @ApiResponse({ status: 400, description: 'Import failed or bad request' })
  importManga(@Body() dto: ImportMangaDto) {
    return this.importService.importManga(dto.source, dto.externalId);
  }

  @Post('manga/:id/sync')
  @ApiOperation({
    summary: 'Re-sync manga metadata from external source (admin only)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Manga synced successfully' })
  @ApiResponse({
    status: 404,
    description: 'Manga or source mapping not found',
  })
  syncManga(@Param('id', ParseIntPipe) id: number) {
    return this.importService.syncManga(id);
  }

  @Post('manga/:id/chapters')
  @ApiOperation({ summary: 'Import chapters for a manga from external source (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Chapters imported' })
  @ApiResponse({ status: 404, description: 'Manga or source not found' })
  importChapters(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang?: string,
  ) {
    return this.importService.importChapters(id, lang);
  }

  @Get('sources/:mangaId')
  @ApiOperation({ summary: 'Get import sources for a manga (admin only)' })
  @ApiParam({ name: 'mangaId', type: Number })
  @ApiResponse({ status: 200, description: 'List of import sources' })
  getSources(@Param('mangaId', ParseIntPipe) mangaId: number) {
    return this.importService.getMangaSources(mangaId);
  }
}
