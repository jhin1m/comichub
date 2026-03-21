import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../database/drizzle.provider.js';
import type { DrizzleDB } from '../database/drizzle.provider.js';
import { manga, chapters } from '../database/schema/index.js';

@Injectable()
export class CounterFlushJob {
  private readonly logger = new Logger(CounterFlushJob.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  /** Flush buffered Redis counters to DB every 5 minutes */
  @Cron('*/5 * * * *')
  async flush(): Promise<void> {
    try {
      await Promise.all([
        this.flushChapterViews(),
        this.flushMangaViews(),
        this.flushMangaDayViews(),
        this.flushMangaWeekViews(),
      ]);
      this.logger.log('Counter flush completed');
    } catch (err) {
      this.logger.error('Counter flush failed', err);
    }
  }

  private async flushChapterViews(): Promise<void> {
    const keys = await this.scanKeys('counter:chapter:*:views');
    for (const key of keys) {
      try {
        const value = await this.redis.getdel(key);
        if (!value || value === '0') continue;
        const id = this.extractId(key, 'chapter');
        if (!id) continue;
        await this.db.update(chapters)
          .set({ viewCount: sql`view_count + ${Number(value)}` })
          .where(eq(chapters.id, id));
      } catch (err) {
        this.logger.error(`Failed to flush ${key}`, err);
      }
    }
  }

  private async flushMangaViews(): Promise<void> {
    await this.flushMangaColumn('counter:manga:*:views', 'views');
  }

  private async flushMangaDayViews(): Promise<void> {
    await this.flushMangaColumn('counter:manga:*:views_day', 'views_day');
  }

  private async flushMangaWeekViews(): Promise<void> {
    await this.flushMangaColumn('counter:manga:*:views_week', 'views_week');
  }

  private async flushMangaColumn(pattern: string, dbColumn: string): Promise<void> {
    const keys = await this.scanKeys(pattern);
    for (const key of keys) {
      try {
        const value = await this.redis.getdel(key);
        if (!value || value === '0') continue;
        const id = this.extractId(key, 'manga');
        if (!id) continue;
        await this.db.update(manga)
          .set({ [dbColumn]: sql`${sql.identifier(dbColumn)} + ${Number(value)}` } as Record<string, unknown>)
          .where(eq(manga.id, id));
      } catch (err) {
        this.logger.error(`Failed to flush ${key}`, err);
      }
    }
  }

  /** SCAN for keys matching pattern (safe for production, unlike KEYS) */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  /** Extract numeric ID from key like counter:chapter:123:views */
  private extractId(key: string, entity: string): number | null {
    const match = key.match(new RegExp(`counter:${entity}:(\\d+):`));
    return match ? Number(match[1]) : null;
  }
}
