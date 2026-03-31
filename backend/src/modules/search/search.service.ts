import { Injectable, Inject } from '@nestjs/common';
import {
  desc,
  and,
  isNull,
  inArray,
  notInArray,
  ilike,
  or,
  eq,
  sql,
  SQL,
} from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { manga, genres, mangaGenres, chapters } from '../../database/schema/index.js';
import type {
  MangaListItem,
  PaginatedResult,
} from '../manga/types/manga.types.js';
import { SearchQueryDto, SearchSortField } from './dto/search-query.dto.js';
import { MangaType } from '../manga/dto/create-manga.dto.js';
import { escapeLike } from '../../common/utils/escape-like.util.js';

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
    const {
      page,
      limit,
      offset,
      q,
      genre,
      status,
      type,
      sort,
      excludeGenres,
      excludeTypes,
      excludeDemographics,
    } = query;

    const conditions: SQL[] = [isNull(manga.deletedAt)];

    if (q) {
      const escaped = escapeLike(q);
      conditions.push(
        or(
          ilike(manga.title, `%${escaped}%`),
          sql`${manga.altTitles}::text ILIKE ${`%${escaped}%`}`,
        ) as SQL,
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

    if (excludeGenres) {
      const slugs = excludeGenres
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (slugs.length) {
        const genreRows = await this.db
          .select({ id: genres.id })
          .from(genres)
          .where(inArray(genres.slug, slugs));
        const genreIds = genreRows.map((g) => g.id);
        if (genreIds.length) {
          const placeholders = genreIds.map((id) => sql`${id}`);
          conditions.push(
            sql`${manga.id} NOT IN (
              SELECT ${mangaGenres.mangaId} FROM ${mangaGenres}
              WHERE ${mangaGenres.genreId} IN (${sql.join(placeholders, sql`, `)})
            )`,
          );
        }
      }
    }

    if (excludeTypes) {
      const types = excludeTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as MangaType[];
      if (types.length) conditions.push(notInArray(manga.type, types));
    }

    if (excludeDemographics) {
      const demos = excludeDemographics
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (demos.length) conditions.push(notInArray(manga.demographic, demos));
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
          latestChapterNumber: chapters.number,
          averageRating: manga.averageRating,
          updatedAt: manga.updatedAt,
          contentRating: manga.contentRating,
          isHot: manga.isHot,
        })
        .from(manga)
        .leftJoin(chapters, eq(manga.lastChapterId, chapters.id))
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
            ilike(manga.title, `%${escapeLike(trimmed)}%`),
            sql`${manga.altTitles}::text ILIKE ${`%${escapeLike(trimmed)}%`}`,
          ) as SQL,
        ),
      )
      .limit(5);

    const results = rows as SuggestItem[];
    await this.redis.setex(cacheKey, SUGGEST_TTL, JSON.stringify(results));
    return results;
  }
}
