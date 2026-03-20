import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../database/drizzle.provider.js';
import type { DrizzleDB } from '../database/drizzle.provider.js';
import { manga } from '../database/schema/index.js';

@Injectable()
export class ViewCounterResetJob {
  private readonly logger = new Logger(ViewCounterResetJob.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  @Cron('0 0 * * *')
  async resetDailyViews(): Promise<void> {
    try {
      await this.db.update(manga).set({ viewsDay: sql`0` });
      await this.invalidateRankingCaches();
      this.logger.log('Daily view counters reset');
    } catch (err) {
      this.logger.error('Failed to reset daily views', err);
    }
  }

  @Cron('0 0 * * 1')
  async resetWeeklyViews(): Promise<void> {
    try {
      await this.db.update(manga).set({ viewsWeek: sql`0` });
      await this.invalidateRankingCaches();
      this.logger.log('Weekly view counters reset');
    } catch (err) {
      this.logger.error('Failed to reset weekly views', err);
    }
  }

  @Cron('*/5 * * * *')
  async flushViewCounters(): Promise<void> {
    try {
      await this.invalidateRankingCaches();
    } catch (err) {
      this.logger.error('Failed to flush view counter caches', err);
    }
  }

  private async invalidateRankingCaches(): Promise<void> {
    const keys = await this.redis.keys('rankings:*');
    if (keys.length) await this.redis.del(...keys);
  }
}
