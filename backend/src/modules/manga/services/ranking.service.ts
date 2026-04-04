import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, desc, gte, and, isNull } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { manga, chapters } from '../../../database/schema/index.js';
import type { MangaListItem, PaginatedResult } from '../types/manga.types.js';

const RANKING_TTL = 900; // 15 minutes
const HOT_RANKED_TTL = 3600; // 1 hour

type RankingType = 'daily' | 'weekly' | 'alltime' | 'toprated';

@Injectable()
export class RankingService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async getRanking(type: RankingType): Promise<MangaListItem[]> {
    const cacheKey = `rankings:${type}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as MangaListItem[];

    const rows = await this.queryRanking(type);
    await this.redis.setex(cacheKey, RANKING_TTL, JSON.stringify(rows));
    return rows;
  }

  async getHotManga(
    page: number,
    limit: number,
  ): Promise<PaginatedResult<MangaListItem>> {
    const offset = (page - 1) * limit;
    const cacheKey = `rankings:hot:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PaginatedResult<MangaListItem>;

    const where = and(eq(manga.isHot, true), isNull(manga.deletedAt));
    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: manga.id,
          title: manga.title,
          slug: manga.slug,
          cover: manga.cover,
          status: manga.status,
          type: manga.type,
          views: manga.views,
          chaptersCount: manga.chaptersCount,
          latestChapterNumber: chapters.number,
          averageRating: manga.averageRating,
          updatedAt: manga.updatedAt,
          contentRating: manga.contentRating,
          isHot: manga.isHot,
        })
        .from(manga)
        .leftJoin(chapters, eq(manga.lastChapterId, chapters.id))
        .where(where)
        .orderBy(desc(manga.views))
        .limit(limit)
        .offset(offset),
      this.db.$count(manga, where),
    ]);

    const result: PaginatedResult<MangaListItem> = {
      data: rows as MangaListItem[],
      total,
      page,
      limit,
    };
    await this.redis.setex(cacheKey, HOT_RANKED_TTL, JSON.stringify(result));
    return result;
  }

  async toggleHot(id: number): Promise<{ id: number; isHot: boolean }> {
    const [existing] = await this.db
      .select({ id: manga.id, isHot: manga.isHot })
      .from(manga)
      .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Manga not found');
    }

    const newIsHot = !existing.isHot;
    await this.db
      .update(manga)
      .set({ isHot: newIsHot })
      .where(eq(manga.id, id));

    // Invalidate hot cache using SCAN (safe for production)
    const hotKeys = await this.scanKeys('rankings:hot:*');
    if (hotKeys.length) await this.redis.del(...hotKeys);

    return { id, isHot: newIsHot };
  }

  async invalidateRankingCaches(): Promise<void> {
    const keys = await this.scanKeys('rankings:*');
    if (keys.length) await this.redis.del(...keys);
  }

  /** SCAN for keys matching pattern (safe for production, unlike KEYS) */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  private async queryRanking(type: RankingType): Promise<MangaListItem[]> {
    const base = {
      id: manga.id,
      title: manga.title,
      slug: manga.slug,
      cover: manga.cover,
      status: manga.status,
      type: manga.type,
      views: manga.views,
      chaptersCount: manga.chaptersCount,
      latestChapterNumber: chapters.number,
      averageRating: manga.averageRating,
      updatedAt: manga.updatedAt,
      contentRating: manga.contentRating,
      isHot: manga.isHot,
    };
    const join = () =>
      this.db
        .select(base)
        .from(manga)
        .leftJoin(chapters, eq(manga.lastChapterId, chapters.id));

    switch (type) {
      case 'daily':
        return join()
          .where(isNull(manga.deletedAt))
          .orderBy(desc(manga.viewsDay))
          .limit(20) as Promise<MangaListItem[]>;

      case 'weekly':
        return join()
          .where(isNull(manga.deletedAt))
          .orderBy(desc(manga.viewsWeek))
          .limit(20) as Promise<MangaListItem[]>;

      case 'alltime':
        return join()
          .where(isNull(manga.deletedAt))
          .orderBy(desc(manga.views))
          .limit(20) as Promise<MangaListItem[]>;

      case 'toprated':
        return join()
          .where(and(isNull(manga.deletedAt), gte(manga.totalRatings, 10)))
          .orderBy(desc(manga.averageRating))
          .limit(20) as Promise<MangaListItem[]>;
    }
  }
}
