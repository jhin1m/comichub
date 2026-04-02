import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get()
  @Public()
  async check() {
    const checks: Record<string, 'up' | 'down'> = {};

    // DB check
    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    // Redis check
    try {
      await this.redis.ping();
      checks.redis = 'up';
    } catch {
      checks.redis = 'down';
    }

    const allUp = Object.values(checks).every((v) => v === 'up');
    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
