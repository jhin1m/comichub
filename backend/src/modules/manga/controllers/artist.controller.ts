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

@ApiTags('artists')
@Controller('artists')
export class ArtistController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List or search artists' })
  @ApiResponse({ status: 200, description: 'Artist list' })
  findAll(@Query('q') q?: string) {
    if (q && q.trim().length >= 2) {
      return this.taxonomyService.search('artists', q.trim());
    }
    return this.taxonomyService.findAll('artists');
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get artist by slug' })
  @ApiParam({ name: 'slug', example: 'oda-eiichiro' })
  @ApiResponse({ status: 200, description: 'Artist detail' })
  @ApiResponse({ status: 404, description: 'Artist not found' })
  findOne(@Param('slug') slug: string) {
    return this.taxonomyService.findBySlug('artists', slug);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create artist (admin only)' })
  @ApiResponse({ status: 201, description: 'Artist created' })
  create(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomyService.create('artists', dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update artist (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Artist updated' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxonomyDto,
  ) {
    return this.taxonomyService.update('artists', id, dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete artist (admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Artist deleted' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.taxonomyService.remove('artists', id);
  }
}
