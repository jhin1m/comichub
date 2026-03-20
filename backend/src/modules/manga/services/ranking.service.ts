import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, gte, and, isNull } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { manga } from '../../../database/schema/index.js';
import type { MangaListItem, PaginatedResult } from '../types/manga.types.js';

const RANKING_TTL = 600; // 10 minutes
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

  async getHotManga(page: number, limit: number): Promise<PaginatedResult<MangaListItem>> {
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
          averageRating: manga.averageRating,
          updatedAt: manga.updatedAt,
        })
        .from(manga)
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
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Manga not found');
    }

    const newIsHot = !existing.isHot;
    await this.db.update(manga).set({ isHot: newIsHot }).where(eq(manga.id, id));

    // Invalidate hot cache
    const keys = await this.redis.keys('rankings:hot:*');
    if (keys.length) await this.redis.del(...keys);

    return { id, isHot: newIsHot };
  }

  async invalidateRankingCaches(): Promise<void> {
    const keys = await this.redis.keys('rankings:*');
    if (keys.length) await this.redis.del(...keys);
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
      averageRating: manga.averageRating,
      updatedAt: manga.updatedAt,
    };

    switch (type) {
      case 'daily':
        return this.db
          .select(base)
          .from(manga)
          .where(isNull(manga.deletedAt))
          .orderBy(desc(manga.viewsDay))
          .limit(20) as Promise<MangaListItem[]>;

      case 'weekly':
        return this.db
          .select(base)
          .from(manga)
          .where(isNull(manga.deletedAt))
          .orderBy(desc(manga.viewsWeek))
          .limit(20) as Promise<MangaListItem[]>;

      case 'alltime':
        return this.db
          .select(base)
          .from(manga)
          .where(isNull(manga.deletedAt))
          .orderBy(desc(manga.views))
          .limit(20) as Promise<MangaListItem[]>;

      case 'toprated':
        return this.db
          .select(base)
          .from(manga)
          .where(and(isNull(manga.deletedAt), gte(manga.totalRatings, 10)))
          .orderBy(desc(manga.averageRating))
          .limit(20) as Promise<MangaListItem[]>;
    }
  }
}
