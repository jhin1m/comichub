import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { chapters, manga } from '../../../database/schema/index.js';
import {
  REDIS_AVAILABLE,
  type RedisStatus,
} from '../../../common/providers/redis.provider.js';

const VIEW_TTL_SECONDS = 300;

@Injectable()
export class ViewTrackingService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
    @Inject(REDIS_AVAILABLE) private redisStatus: RedisStatus,
  ) {}

  /** Buffer view in Redis (flushed to DB by CounterFlushJob every 5 min) */
  async trackChapterView(
    chapterId: number,
    userId?: number,
    ip?: string,
  ): Promise<void> {
    if (!userId && !ip) return;

    const identifier = userId ? `user:${userId}` : `ip:${ip}`;

    // Dedup: only via Redis (skip dedup when Redis down — accept double-counts)
    if (this.redisStatus.available) {
      const dedupKey = `view:${chapterId}:${identifier}`;
      const exists = await this.redis.get(dedupKey);
      if (exists) return;
      await this.redis.setex(dedupKey, VIEW_TTL_SECONDS, '1');
    }

    // Get manga ID for manga-level counters
    const [chapter] = await this.db
      .select({ mangaId: chapters.mangaId })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (this.redisStatus.available) {
      // Buffer counters in Redis — flushed to DB by cron job
      await this.redis.incr(`counter:chapter:${chapterId}:views`);
      if (chapter) {
        await Promise.all([
          this.redis.incr(`counter:manga:${chapter.mangaId}:views_day`),
          this.redis.incr(`counter:manga:${chapter.mangaId}:views_week`),
          this.redis.incr(`counter:manga:${chapter.mangaId}:views`),
        ]);
      }
    } else {
      // Fallback: direct DB increment when Redis is unavailable
      await this.db
        .update(chapters)
        .set({ viewCount: sql`${chapters.viewCount} + 1` })
        .where(eq(chapters.id, chapterId));
      if (chapter) {
        await this.db
          .update(manga)
          .set({
            views: sql`${manga.views} + 1`,
            viewsDay: sql`${manga.viewsDay} + 1`,
            viewsWeek: sql`${manga.viewsWeek} + 1`,
          })
          .where(eq(manga.id, chapter.mangaId));
      }
    }
  }
}
