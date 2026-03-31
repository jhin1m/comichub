import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  eq,
  isNull,
  and,
  desc,
  asc,
  inArray,
  notInArray,
  gte,
  lte,
  ilike,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  manga,
  genres,
  artists,
  authors,
  groups,
  mangaGenres,
  mangaArtists,
  mangaAuthors,
  mangaGroups,
  chapters,
  chapterGroups,
} from '../../../database/schema/index.js';
import { slugify } from '../../../common/utils/slug.util.js';
import { NSFW_RATINGS } from '../../../common/utils/content-rating.util.js';
import { CreateMangaDto, MangaType } from '../dto/create-manga.dto.js';
import { UpdateMangaDto } from '../dto/update-manga.dto.js';
import {
  MangaQueryDto,
  MangaSortField,
  SortOrder,
} from '../dto/manga-query.dto.js';
import type {
  MangaDetail,
  MangaListItem,
  PaginatedResult,
} from '../types/manga.types.js';

@Injectable()
export class MangaService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query: MangaQueryDto): Promise<PaginatedResult<MangaListItem>> {
    const {
      page,
      limit,
      offset,
      search,
      status,
      type,
      genre,
      artist,
      author,
      language,
      year,
      nsfw,
      sort,
      order,
      includeGenres,
      excludeGenres,
      demographic,
      yearFrom,
      yearTo,
      minChapter,
      minRating,
      excludeTypes,
      excludeDemographics,
    } = query;

    const conditions: SQL[] = [isNull(manga.deletedAt)];

    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&');
      conditions.push(
        or(
          ilike(manga.title, `%${escaped}%`),
          sql`${manga.altTitles}::text ILIKE ${`%${escaped}%`}`,
        )!,
      );
    }

    if (status) conditions.push(eq(manga.status, status));
    if (type) conditions.push(eq(manga.type, type));
    if (language) conditions.push(eq(manga.originalLanguage, language));
    if (year) conditions.push(eq(manga.year, year));
    // Default: hide NSFW (erotica/pornographic) unless explicitly requested
    if (nsfw !== true) {
      conditions.push(notInArray(manga.contentRating, NSFW_RATINGS));
    }

    // Genre filter via subquery on pivot
    if (genre) {
      const [genreRow] = await this.db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, genre))
        .limit(1);
      if (genreRow) {
        conditions.push(
          sql`${manga.id} IN (SELECT ${mangaGenres.mangaId} FROM ${mangaGenres} WHERE ${mangaGenres.genreId} = ${genreRow.id})`,
        );
      } else {
        return { data: [], total: 0, page, limit };
      }
    }

    if (artist) {
      conditions.push(
        sql`${manga.id} IN (SELECT ${mangaArtists.mangaId} FROM ${mangaArtists} WHERE ${mangaArtists.artistId} = ${artist})`,
      );
    }

    if (author) {
      conditions.push(
        sql`${manga.id} IN (SELECT ${mangaAuthors.mangaId} FROM ${mangaAuthors} WHERE ${mangaAuthors.authorId} = ${author})`,
      );
    }

    if (demographic) conditions.push(eq(manga.demographic, demographic));
    if (yearFrom !== undefined) conditions.push(gte(manga.year, yearFrom));
    if (yearTo !== undefined) conditions.push(lte(manga.year, yearTo));
    if (minChapter !== undefined)
      conditions.push(gte(manga.chaptersCount, minChapter));
    if (minRating !== undefined)
      conditions.push(sql`${manga.averageRating}::numeric >= ${minRating}`);

    if (includeGenres) {
      const slugs = includeGenres
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (slugs.length) {
        const genreRows = await this.db
          .select({ id: genres.id })
          .from(genres)
          .where(inArray(genres.slug, slugs));
        const genreIds = genreRows.map((r) => r.id);

        if (genreIds.length !== slugs.length) {
          return { data: [], total: 0, page, limit };
        }

        // AND logic: single aggregation query instead of N+1
        const placeholders = genreIds.map((id) => sql`${id}`);
        conditions.push(
          sql`${manga.id} IN (
            SELECT ${mangaGenres.mangaId} FROM ${mangaGenres}
            WHERE ${mangaGenres.genreId} IN (${sql.join(placeholders, sql`, `)})
            GROUP BY ${mangaGenres.mangaId}
            HAVING COUNT(DISTINCT ${mangaGenres.genreId}) = ${genreIds.length}
          )`,
        );
      }
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
        const genreIds = genreRows.map((r) => r.id);

        if (genreIds.length) {
          // Subquery instead of loading all IDs into memory
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
    const sortDir = order === SortOrder.ASC ? asc : desc;
    let orderBy;
    switch (sort) {
      case MangaSortField.VIEWS:
        orderBy = sortDir(manga.views);
        break;
      case MangaSortField.TRENDING:
        orderBy = sortDir(manga.viewsWeek);
        break;
      case MangaSortField.CREATED_AT:
        orderBy = sortDir(manga.createdAt);
        break;
      default:
        orderBy = sortDir(manga.updatedAt);
    }

    const [rows, countResult] = await Promise.all([
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

    return { data: rows as MangaListItem[], total: countResult, page, limit };
  }

  async findMangaByGroup(
    slug: string,
    page: number,
    limit: number,
  ): Promise<{
    group: { id: number; name: string; slug: string; titleCount: number; releaseCount: number };
    manga: PaginatedResult<MangaListItem>;
  }> {
    limit = Math.min(Math.max(limit, 1), 100);
    const [groupRow] = await this.db
      .select({ id: groups.id, name: groups.name, slug: groups.slug })
      .from(groups)
      .where(eq(groups.slug, slug))
      .limit(1);
    if (!groupRow) throw new NotFoundException('Group not found');

    const releaseCount = await this.db.$count(
      chapterGroups,
      eq(chapterGroups.groupId, groupRow.id),
    );

    // Derive manga from chapterGroups → chapters → manga (mangaGroups may be empty)
    const mangaIdsQuery = this.db
      .selectDistinct({ mangaId: chapters.mangaId })
      .from(chapterGroups)
      .innerJoin(chapters, eq(chapterGroups.chapterId, chapters.id))
      .where(eq(chapterGroups.groupId, groupRow.id));

    const mangaIdRows = await mangaIdsQuery;
    const mangaIds = mangaIdRows.map((r) => r.mangaId);
    const titleCount = mangaIds.length;

    const offset = (page - 1) * limit;
    const rows =
      mangaIds.length > 0
        ? await this.db
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
            .where(
              and(inArray(manga.id, mangaIds), isNull(manga.deletedAt)),
            )
            .orderBy(desc(manga.updatedAt))
            .limit(limit)
            .offset(offset)
        : [];

    return {
      group: { ...groupRow, titleCount, releaseCount },
      manga: { data: rows as MangaListItem[], total: titleCount, page, limit },
    };
  }

  async findRandom(): Promise<{ slug: string }> {
    const [row] = await this.db
      .select({ slug: manga.slug })
      .from(manga)
      .where(
        and(isNull(manga.deletedAt), notInArray(manga.contentRating, NSFW_RATINGS)),
      )
      .orderBy(sql`RANDOM()`)
      .limit(1);
    if (!row) throw new NotFoundException('No manga found');
    return { slug: row.slug };
  }

  async findBySlug(
    slug: string,
    isAuthenticated = false,
  ): Promise<MangaDetail> {
    const whereConditions = [eq(manga.slug, slug), isNull(manga.deletedAt)];
    if (!isAuthenticated) {
      whereConditions.push(notInArray(manga.contentRating, NSFW_RATINGS));
    }
    const [m] = await this.db
      .select()
      .from(manga)
      .where(and(...whereConditions))
      .limit(1);
    if (!m) throw new NotFoundException('Manga not found');

    const [genreList, artistList, authorList, groupList, chapterList] =
      await Promise.all([
        this.db
          .select({ id: genres.id, name: genres.name, slug: genres.slug })
          .from(genres)
          .innerJoin(mangaGenres, eq(mangaGenres.genreId, genres.id))
          .where(eq(mangaGenres.mangaId, m.id)),
        this.db
          .select({ id: artists.id, name: artists.name, slug: artists.slug })
          .from(artists)
          .innerJoin(mangaArtists, eq(mangaArtists.artistId, artists.id))
          .where(eq(mangaArtists.mangaId, m.id)),
        this.db
          .select({ id: authors.id, name: authors.name, slug: authors.slug })
          .from(authors)
          .innerJoin(mangaAuthors, eq(mangaAuthors.authorId, authors.id))
          .where(eq(mangaAuthors.mangaId, m.id)),
        this.db
          .select({ id: groups.id, name: groups.name, slug: groups.slug })
          .from(groups)
          .innerJoin(mangaGroups, eq(mangaGroups.groupId, groups.id))
          .where(eq(mangaGroups.mangaId, m.id)),
        this.db
          .select({
            id: chapters.id,
            number: chapters.number,
            title: chapters.title,
            slug: chapters.slug,
            language: chapters.language,
            volume: chapters.volume,
            viewCount: chapters.viewCount,
            order: chapters.order,
            createdAt: chapters.createdAt,
          })
          .from(chapters)
          .where(and(eq(chapters.mangaId, m.id), isNull(chapters.deletedAt)))
          .orderBy(asc(chapters.order)),
      ]);

    const chapterIds = chapterList.map((ch) => ch.id);
    const chapterGroupRows =
      chapterIds.length > 0
        ? await this.db
            .select({
              chapterId: chapterGroups.chapterId,
              id: groups.id,
              name: groups.name,
              slug: groups.slug,
            })
            .from(chapterGroups)
            .innerJoin(groups, eq(chapterGroups.groupId, groups.id))
            .where(inArray(chapterGroups.chapterId, chapterIds))
        : [];

    const groupsByChapter = new Map<
      number,
      { id: number; name: string; slug: string }[]
    >();
    for (const row of chapterGroupRows) {
      const arr = groupsByChapter.get(row.chapterId) ?? [];
      arr.push({ id: row.id, name: row.name, slug: row.slug });
      groupsByChapter.set(row.chapterId, arr);
    }

    const chaptersWithGroups = chapterList.map((ch) => ({
      ...ch,
      groups: groupsByChapter.get(ch.id) ?? [],
    }));

    return {
      ...m,
      genres: genreList,
      artists: artistList,
      authors: authorList,
      groups: groupList,
      chapters: chaptersWithGroups as unknown as MangaDetail['chapters'],
    } as unknown as MangaDetail;
  }

  async create(dto: CreateMangaDto): Promise<MangaDetail> {
    const slug = dto.slug ?? slugify(dto.title);

    if (!slug) {
      throw new BadRequestException(
        'Could not generate a valid slug from the provided title',
      );
    }

    const [existing] = await this.db
      .select({ id: manga.id })
      .from(manga)
      .where(eq(manga.slug, slug))
      .limit(1);
    if (existing)
      throw new ConflictException('Manga with this slug already exists');

    const [created] = await this.db
      .insert(manga)
      .values({
        title: dto.title,
        altTitles: dto.altTitles ?? [],
        slug,
        description: dto.description,
        cover: dto.cover,
        originalLanguage: dto.originalLanguage,
        status: dto.status,
        type: dto.type,
        contentRating: dto.contentRating,
        demographic: dto.demographic,
        year: dto.year,
      })
      .returning();

    await this.syncPivots(created.id, dto);
    return this.findBySlug(created.slug);
  }

  async update(id: number, dto: UpdateMangaDto): Promise<MangaDetail> {
    const [existing] = await this.db
      .select({ id: manga.id, slug: manga.slug })
      .from(manga)
      .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException('Manga not found');

    const updates: Partial<typeof manga.$inferInsert> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.altTitles !== undefined) updates.altTitles = dto.altTitles;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.cover !== undefined) updates.cover = dto.cover;
    if (dto.originalLanguage !== undefined)
      updates.originalLanguage = dto.originalLanguage;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.slug !== undefined) updates.slug = dto.slug;
    if (dto.contentRating !== undefined) updates.contentRating = dto.contentRating;
    if (dto.demographic !== undefined) updates.demographic = dto.demographic;
    if (dto.year !== undefined) updates.year = dto.year;

    const [updated] = await this.db
      .update(manga)
      .set(updates)
      .where(eq(manga.id, id))
      .returning();

    await this.syncPivots(id, dto);
    return this.findBySlug(updated.slug);
  }

  async remove(id: number): Promise<void> {
    const [existing] = await this.db
      .select({ id: manga.id })
      .from(manga)
      .where(and(eq(manga.id, id), isNull(manga.deletedAt)))
      .limit(1);
    if (!existing) throw new NotFoundException('Manga not found');

    await this.db
      .update(manga)
      .set({ deletedAt: new Date() })
      .where(eq(manga.id, id));
  }

  private async syncPivots(
    mangaId: number,
    dto: CreateMangaDto | UpdateMangaDto,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (dto.genreIds !== undefined) {
        await tx.delete(mangaGenres).where(eq(mangaGenres.mangaId, mangaId));
        if (dto.genreIds.length) {
          await tx
            .insert(mangaGenres)
            .values(dto.genreIds.map((genreId) => ({ mangaId, genreId })));
        }
      }
      if (dto.artistIds !== undefined) {
        await tx.delete(mangaArtists).where(eq(mangaArtists.mangaId, mangaId));
        if (dto.artistIds.length) {
          await tx
            .insert(mangaArtists)
            .values(dto.artistIds.map((artistId) => ({ mangaId, artistId })));
        }
      }
      if (dto.authorIds !== undefined) {
        await tx.delete(mangaAuthors).where(eq(mangaAuthors.mangaId, mangaId));
        if (dto.authorIds.length) {
          await tx
            .insert(mangaAuthors)
            .values(dto.authorIds.map((authorId) => ({ mangaId, authorId })));
        }
      }
      if (dto.groupIds !== undefined) {
        await tx.delete(mangaGroups).where(eq(mangaGroups.mangaId, mangaId));
        if (dto.groupIds.length) {
          await tx
            .insert(mangaGroups)
            .values(dto.groupIds.map((groupId) => ({ mangaId, groupId })));
        }
      }
    });
  }
}
