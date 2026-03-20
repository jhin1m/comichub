import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { chapters } from '../../../database/schema/index.js';

const VIEW_TTL_SECONDS = 5;

@Injectable()
export class ViewTrackingService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async trackChapterView(chapterId: number, userId?: number, ip?: string): Promise<void> {
    const identifier = userId ? `user:${userId}` : `ip:${ip ?? 'unknown'}`;
    const key = `view:${chapterId}:${identifier}`;

    const exists = await this.redis.get(key);
    if (exists) return;

    await this.redis.setex(key, VIEW_TTL_SECONDS, '1');
    await this.db
      .update(chapters)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(chapters.id, chapterId));
  }
}
