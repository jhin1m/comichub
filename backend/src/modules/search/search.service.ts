import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  desc,
  and,
  isNull,
  inArray,
  notInArray,
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

// DB now fast enough (pg_trgm GIN) to trade a shorter staleness window for freshness.
const SUGGEST_TTL = 90; // 90s (was 300s pre-pg_trgm)

// Threshold below which short queries skip %> and fall back to ILIKE — trigram
// similarity is unreliable for 1-3 char inputs (too few n-grams).
const SHORT_QUERY_LEN = 3;

const DEFAULT_WORD_SIM_THRESHOLD = 0.25;
const MIN_WORD_SIM_THRESHOLD = 0.1;
const MAX_WORD_SIM_THRESHOLD = 1.0;

function resolveWordSimThreshold(logger: Logger): number {
  const raw = process.env.SEARCH_WORD_SIM_THRESHOLD;
  if (!raw) return DEFAULT_WORD_SIM_THRESHOLD;
  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_WORD_SIM_THRESHOLD ||
    parsed > MAX_WORD_SIM_THRESHOLD
  ) {
    logger.warn(
      `Invalid SEARCH_WORD_SIM_THRESHOLD="${raw}" — falling back to ${DEFAULT_WORD_SIM_THRESHOLD}`,
    );
    return DEFAULT_WORD_SIM_THRESHOLD;
  }
  return parsed;
}

export interface SuggestItem {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly wordSimThreshold: number;

  // Pre-built SQL fragment for SET LOCAL — `SET` commands cannot use bound
  // parameters ($1), so we inline the pre-validated numeric literal via sql.raw.
  // Safe: threshold is parsed through Number() + clamped to [0.1, 1.0] in resolver.
  private readonly setThresholdSql: SQL;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {
    this.wordSimThreshold = resolveWordSimThreshold(this.logger);
    const literal = this.wordSimThreshold.toFixed(3);
    this.setThresholdSql = sql.raw(
      `SET LOCAL pg_trgm.word_similarity_threshold = ${literal}`,
    );
  }

  // Node-side mirror of Postgres normalize_title — must stay byte-aligned with
  // the DB-stored form, otherwise %> trigram comparison finds zero overlap.
  //
  // DB runs lower(unaccent(...)). The `unaccent` extension:
  //   - strips Latin/Greek combining accents ("é" → "e", "Ō" → "O")
  //   - maps stroke/slash letters via dict ("Đ" → "D", "Ø" → "O", "Ł" → "L")
  //   - leaves CJK alone — Hangul syllables, kanji, and kana voicing marks
  //     (dakuten/handakuten: "が", "ぱ") all pass through unchanged.
  //
  // Our Node mirror needs to match BOTH traits:
  //   1. NFD decomposes precomposed Latin into base + combining marks, but
  //      also decomposes Hangul ("전" → jamo parts). We strip ONLY the
  //      U+0300-U+036F Combining Diacritical Marks block (Latin/Greek),
  //      leaving U+3099/U+309A (kana voicing) intact, then NFC re-composes
  //      Hangul back into syllables.
  //   2. Stroke letters aren't combining-mark decompositions — NFD leaves
  //      them whole. A small static map covers the common cases unaccent
  //      handles via dictionary lookup.
  private static readonly STROKE_LETTER_MAP: Record<string, string> = {
    Đ: 'D', đ: 'd',
    Ø: 'O', ø: 'o',
    Ł: 'L', ł: 'l',
    Æ: 'AE', æ: 'ae',
    Œ: 'OE', œ: 'oe',
    Ð: 'D', ð: 'd',
    Þ: 'Th', þ: 'th',
    ß: 'ss',
  };
  private static readonly STROKE_LETTER_RE = new RegExp(
    `[${Object.keys(SearchService.STROKE_LETTER_MAP).join('')}]`,
    'g',
  );

  private normalize(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')
      .normalize('NFC')
      .replace(
        SearchService.STROKE_LETTER_RE,
        (ch) => SearchService.STROKE_LETTER_MAP[ch] ?? ch,
      )
      .toLowerCase();
  }

  // Build the q-specific WHERE clause. Short queries (≤ 3 chars) use ILIKE on
  // the normalized columns — trigram GIN still accelerates substring match, but
  // %> word_similarity is noisy at this length.
  private buildQueryCondition(q: string): { where: SQL; fuzzy: boolean } {
    const trimmed = q.trim();
    const qNorm = this.normalize(trimmed);
    if (trimmed.length <= SHORT_QUERY_LEN) {
      const pattern = `%${escapeLike(qNorm)}%`;
      return {
        where: or(
          sql`${manga.searchTitle} ILIKE ${pattern}`,
          sql`${manga.searchAlt} ILIKE ${pattern}`,
        ) as SQL,
        fuzzy: false,
      };
    }
    return {
      where: sql`(${manga.searchTitle} %> ${qNorm} OR ${manga.searchAlt} %> ${qNorm})`,
      fuzzy: true,
    };
  }

  // Blended ranking: similarity dominates, views + freshness tiebreak.
  private buildFuzzyOrderBy(q: string): SQL {
    const qNorm = this.normalize(q.trim());
    return sql`(
      word_similarity(${qNorm}, ${manga.searchTitle}) * 2
      + word_similarity(${qNorm}, ${manga.searchAlt}) * 1.5
      + ln(1 + ${manga.views}) * 0.1
      + (CASE WHEN ${manga.updatedAt} > NOW() - INTERVAL '30 days' THEN 0.2 ELSE 0 END)
    ) DESC`;
  }

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
    const trimmedQ = q?.trim();
    let fuzzy = false;

    if (trimmedQ) {
      const qc = this.buildQueryCondition(trimmedQ);
      conditions.push(qc.where);
      fuzzy = qc.fuzzy;
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

    // When q present → relevance wins over user-selected sort (UX: typing
    // a query implies intent for best match, not freshness).
    // Empty-q path is byte-identical to pre-change behavior.
    const orderBy = trimmedQ
      ? this.buildFuzzyOrderBy(trimmedQ)
      : (() => {
          switch (sort) {
            case SearchSortField.VIEWS:
              return desc(manga.views);
            case SearchSortField.CREATED_AT:
              return desc(manga.createdAt);
            case SearchSortField.RATING:
              return desc(manga.averageRating);
            default:
              return desc(manga.updatedAt);
          }
        })();

    const runPage = () =>
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
        .offset(offset);

    // SET LOCAL only affects the current transaction — wrap fuzzy query path.
    // Non-fuzzy paths (short-q fallback, no-q) skip tx to preserve existing behavior.
    const [rows, total] = fuzzy
      ? await this.db.transaction(async (tx) => {
          await tx.execute(this.setThresholdSql);
          const pageRows = await tx
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
            .offset(offset);
          const count = await tx.$count(manga, where);
          return [pageRows, count] as const;
        })
      : await Promise.all([runPage(), this.db.$count(manga, where)]);

    return { data: rows as MangaListItem[], total, page, limit };
  }

  async suggest(q: string): Promise<SuggestItem[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];

    const cacheKey = `suggest:${trimmed.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as SuggestItem[];

    const qc = this.buildQueryCondition(trimmed);
    const where = and(isNull(manga.deletedAt), qc.where);

    const runQuery = (tx: DrizzleDB) =>
      tx
        .select({
          id: manga.id,
          title: manga.title,
          slug: manga.slug,
          cover: manga.cover,
        })
        .from(manga)
        .where(where)
        .orderBy(qc.fuzzy ? this.buildFuzzyOrderBy(trimmed) : desc(manga.views))
        .limit(5);

    const rows = qc.fuzzy
      ? await this.db.transaction(async (tx) => {
          await tx.execute(this.setThresholdSql);
          return runQuery(tx as unknown as DrizzleDB);
        })
      : await runQuery(this.db);

    const results = rows as SuggestItem[];
    await this.redis.setex(cacheKey, SUGGEST_TTL, JSON.stringify(results));
    return results;
  }
}
