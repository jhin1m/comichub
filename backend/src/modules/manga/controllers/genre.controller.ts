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
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';

@ApiTags('genres')
@Controller('genres')
export class GenreController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all genres' })
  @ApiResponse({ status: 200, description: 'Genre list' })
  findAll() {
    return this.taxonomyService.findAll('genres');
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get genre by slug' })
  @ApiParam({ name: 'slug', example: 'action' })
  @ApiResponse({ status: 200, description: 'Genre detail' })
  @ApiResponse({ status: 404, description: 'Genre not found' })
  findOne(@Param('slug') slug: string) {
    return this.taxonomyService.findBySlug('genres', slug);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create genre (admin only)' })
  @ApiResponse({ status: 201, description: 'Genre created' })
  create(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomyService.create('genres', dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update genre (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Genre updated' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxonomyDto,
  ) {
    return this.taxonomyService.update('genres', id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete genre (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Genre deleted' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.taxonomyService.remove('genres', id);
  }
}
