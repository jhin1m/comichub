import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatsService } from '../services/stats.service.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CacheTTL } from '../../../common/decorators/cache-ttl.decorator.js';
import { RedisCacheInterceptor } from '../../../common/interceptors/redis-cache.interceptor.js';

@ApiTags('stats')
@Controller('stats')
@UseInterceptors(RedisCacheInterceptor)
@CacheTTL(3600) // Cache 1 hour
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Get('overview')
  @ApiOperation({ summary: 'Get platform overview stats' })
  @ApiResponse({ status: 200, description: 'Platform stats' })
  getOverview() {
    return this.statsService.getPlatformStats();
  }
}
