import { Injectable, Inject } from '@nestjs/common';
import { desc, and, isNull, inArray, ilike, or, eq, SQL } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { manga, genres, mangaGenres } from '../../database/schema/index.js';
import type { MangaListItem, PaginatedResult } from '../manga/types/manga.types.js';
import { SearchQueryDto, SearchSortField } from './dto/search-query.dto.js';

const SUGGEST_TTL = 300; // 5 minutes

export interface SuggestItem {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async search(query: SearchQueryDto): Promise<PaginatedResult<MangaListItem>> {
    const { page, limit, offset, q, genre, status, type, sort } = query;

    const conditions: SQL[] = [isNull(manga.deletedAt)];

    if (q) {
      conditions.push(
        or(ilike(manga.title, `%${q}%`), ilike(manga.titleAlt, `%${q}%`)) as SQL,
      );
    }

    if (status) conditions.push(eq(manga.status, status));
    if (type) conditions.push(eq(manga.type, type));

    if (genre && genre.length > 0) {
      const genreRows = await this.db
        .select({ id: genres.id })
        .from(genres)
        .where(inArray(genres.slug, genre));

      if (genreRows.length === 0) {
        return { data: [], total: 0, page, limit };
      }

      const genreIds = genreRows.map((g) => g.id);
      const mangaWithGenres = await this.db
        .select({ mangaId: mangaGenres.mangaId })
        .from(mangaGenres)
        .where(inArray(mangaGenres.genreId, genreIds));

      const mangaIds = [...new Set(mangaWithGenres.map((r) => r.mangaId))];
      if (mangaIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      conditions.push(inArray(manga.id, mangaIds));
    }

    const where = and(...conditions);

    let orderBy;
    switch (sort) {
      case SearchSortField.VIEWS:
        orderBy = desc(manga.views);
        break;
      case SearchSortField.CREATED_AT:
        orderBy = desc(manga.createdAt);
        break;
      case SearchSortField.RATING:
        orderBy = desc(manga.averageRating);
        break;
      default:
        orderBy = desc(manga.updatedAt);
    }

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
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.db.$count(manga, where),
    ]);

    return { data: rows as MangaListItem[], total, page, limit };
  }

  async suggest(q: string): Promise<SuggestItem[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const cacheKey = `suggest:${trimmed.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as SuggestItem[];

    const rows = await this.db
      .select({
        id: manga.id,
        title: manga.title,
        slug: manga.slug,
        cover: manga.cover,
      })
      .from(manga)
      .where(
        and(
          isNull(manga.deletedAt),
          or(
            ilike(manga.title, `%${trimmed}%`),
            ilike(manga.titleAlt, `%${trimmed}%`),
          ) as SQL,
        ),
      )
      .limit(5);

    const results = rows as SuggestItem[];
    await this.redis.setex(cacheKey, SUGGEST_TTL, JSON.stringify(results));
    return results;
  }
}
