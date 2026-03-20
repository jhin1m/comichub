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
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MangaService } from '../services/manga.service.js';
import { CreateMangaDto } from '../dto/create-manga.dto.js';
import { UpdateMangaDto } from '../dto/update-manga.dto.js';
import { MangaQueryDto } from '../dto/manga-query.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';

@ApiTags('manga')
@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List manga with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated manga list' })
  findAll(@Query() query: MangaQueryDto) {
    return this.mangaService.findAll(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get manga detail by slug' })
  @ApiParam({ name: 'slug', example: 'one-piece' })
  @ApiResponse({ status: 200, description: 'Manga detail with chapters' })
  @ApiResponse({ status: 404, description: 'Manga not found' })
  findOne(@Param('slug') slug: string) {
    return this.mangaService.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create manga (admin only)' })
  @ApiResponse({ status: 201, description: 'Manga created' })
  create(@Body() dto: CreateMangaDto) {
    return this.mangaService.create(dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update manga (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Manga updated' })
  @ApiResponse({ status: 404, description: 'Manga not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMangaDto) {
    return this.mangaService.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete manga (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Manga deleted' })
  @ApiResponse({ status: 404, description: 'Manga not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.mangaService.remove(id);
  }
}
