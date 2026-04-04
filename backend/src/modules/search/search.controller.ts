import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CacheTTL } from '../../common/decorators/cache-ttl.decorator.js';
import { RedisCacheInterceptor } from '../../common/interceptors/redis-cache.interceptor.js';

class SuggestQueryDto {
  @ApiPropertyOptional({ description: 'Autocomplete query', minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  q!: string;
}

@ApiTags('search')
@Controller('search')
@UseInterceptors(RedisCacheInterceptor)
@CacheTTL(120)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Full-text search manga with filters' })
  @ApiResponse({ status: 200, description: 'Paginated search results' })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Public()
  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete suggestions (top 5)' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Partial title to autocomplete',
  })
  @ApiResponse({ status: 200, description: 'List of matching manga titles' })
  suggest(@Query() query: SuggestQueryDto) {
    return this.searchService.suggest(query.q ?? '');
  }
}
