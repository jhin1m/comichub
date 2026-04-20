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
  DefaultValuePipe,
  UseGuards,
  UseInterceptors,
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
import { TaxonomyService } from '../services/taxonomy.service.js';
import { MangaService } from '../services/manga.service.js';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from '../dto/taxonomy.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CacheTTL } from '../../../common/decorators/cache-ttl.decorator.js';
import { RedisCacheInterceptor } from '../../../common/interceptors/redis-cache.interceptor.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@ApiTags('groups')
@Controller('groups')
@UseInterceptors(RedisCacheInterceptor)
@CacheTTL(600)
export class GroupController {
  constructor(
    private readonly taxonomyService: TaxonomyService,
    private readonly mangaService: MangaService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all translation groups' })
  @ApiResponse({ status: 200, description: 'Group list' })
  findAll() {
    return this.taxonomyService.findAll('groups');
  }

  @Public()
  @Get(':slug/manga')
  @ApiOperation({ summary: 'Get manga list for a translation group' })
  findManga(
    @Param('slug') slug: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.mangaService.findMangaByGroup(slug, page, limit);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get group by slug' })
  @ApiParam({ name: 'slug', example: 'viz-media' })
  @ApiResponse({ status: 200, description: 'Group detail' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findOne(@Param('slug') slug: string) {
    return this.taxonomyService.findBySlug('groups', slug);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create group (admin only)' })
  @ApiResponse({ status: 201, description: 'Group created' })
  create(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomyService.create('groups', dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update group (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Group updated' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxonomyDto,
  ) {
    return this.taxonomyService.update('groups', id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete group (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Group deleted' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.taxonomyService.remove('groups', id);
  }
}
