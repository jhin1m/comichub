import { Inject, Injectable } from '@nestjs/common';
import { sql, count, gte } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { manga, chapters } from '../../../database/schema/index.js';

export interface PlatformStats {
  totalManga: number;
  totalChapters: number;
  dailyUpdates: number;
  newThisWeek: number;
}

@Injectable()
export class StatsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [mangaCount, chapterCount, dailyCount, weeklyCount] =
      await Promise.all([
        this.db
          .select({ count: count() })
          .from(manga)
          .then((r) => r[0]?.count ?? 0),
        this.db
          .select({ count: count() })
          .from(chapters)
          .then((r) => r[0]?.count ?? 0),
        this.db
          .select({ count: count() })
          .from(manga)
          .where(gte(manga.updatedAt, oneDayAgo))
          .then((r) => r[0]?.count ?? 0),
        this.db
          .select({ count: count() })
          .from(manga)
          .where(gte(manga.createdAt, oneWeekAgo))
          .then((r) => r[0]?.count ?? 0),
      ]);

    return {
      totalManga: mangaCount,
      totalChapters: chapterCount,
      dailyUpdates: dailyCount,
      newThisWeek: weeklyCount,
    };
  }
}
