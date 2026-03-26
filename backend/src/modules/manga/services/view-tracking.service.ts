import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { chapters } from '../../../database/schema/index.js';

const VIEW_TTL_SECONDS = 300;

@Injectable()
export class ViewTrackingService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  /** Buffer view in Redis (flushed to DB by CounterFlushJob every 5 min) */
  async trackChapterView(
    chapterId: number,
    userId?: number,
    ip?: string,
  ): Promise<void> {
    // Skip tracking if we can't uniquely identify the viewer
    if (!userId && !ip) return;

    const identifier = userId ? `user:${userId}` : `ip:${ip}`;
    const dedupKey = `view:${chapterId}:${identifier}`;

    const exists = await this.redis.get(dedupKey);
    if (exists) return;

    await this.redis.setex(dedupKey, VIEW_TTL_SECONDS, '1');

    // Buffer counters in Redis — flushed to DB by cron job
    await this.redis.incr(`counter:chapter:${chapterId}:views`);

    // Also increment manga-level counters
    const [chapter] = await this.db
      .select({ mangaId: chapters.mangaId })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (chapter) {
      await Promise.all([
        this.redis.incr(`counter:manga:${chapter.mangaId}:views_day`),
        this.redis.incr(`counter:manga:${chapter.mangaId}:views_week`),
        this.redis.incr(`counter:manga:${chapter.mangaId}:views`),
      ]);
    }
  }
}
