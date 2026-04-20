import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
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
import { CreateTaxonomyDto, UpdateTaxonomyDto } from '../dto/taxonomy.dto.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CacheTTL } from '../../../common/decorators/cache-ttl.decorator.js';
import { RedisCacheInterceptor } from '../../../common/interceptors/redis-cache.interceptor.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@ApiTags('authors')
@Controller('authors')
@UseInterceptors(RedisCacheInterceptor)
@CacheTTL(600)
export class AuthorController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List or search authors' })
  @ApiResponse({ status: 200, description: 'Author list' })
  findAll(@Query('q') q?: string) {
    if (q && q.trim().length >= 2) {
      return this.taxonomyService.search('authors', q.trim());
    }
    return this.taxonomyService.findAll('authors');
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get author by slug' })
  @ApiParam({ name: 'slug', example: 'oda-eiichiro' })
  @ApiResponse({ status: 200, description: 'Author detail' })
  @ApiResponse({ status: 404, description: 'Author not found' })
  findOne(@Param('slug') slug: string) {
    return this.taxonomyService.findBySlug('authors', slug);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create author (admin only)' })
  @ApiResponse({ status: 201, description: 'Author created' })
  create(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomyService.create('authors', dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update author (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Author updated' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxonomyDto,
  ) {
    return this.taxonomyService.update('authors', id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete author (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Author deleted' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.taxonomyService.remove('authors', id);
  }
}
