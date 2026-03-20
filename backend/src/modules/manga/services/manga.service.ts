import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, isNull, and, desc, asc, inArray, SQL } from 'drizzle-orm';
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
} from '../../../database/schema/index.js';
import { slugify } from '../../../common/utils/slug.util.js';
import { CreateMangaDto } from '../dto/create-manga.dto.js';
import { UpdateMangaDto } from '../dto/update-manga.dto.js';
import { MangaQueryDto, MangaSortField, SortOrder } from '../dto/manga-query.dto.js';
import type { MangaDetail, MangaListItem, PaginatedResult } from '../types/manga.types.js';

@Injectable()
export class MangaService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(query: MangaQueryDto): Promise<PaginatedResult<MangaListItem>> {
    const { page, limit, offset, status, type, genre, artist, author, sort, order } = query;

    const conditions: SQL[] = [isNull(manga.deletedAt)];

    if (status) conditions.push(eq(manga.status, status));
    if (type) conditions.push(eq(manga.type, type));

    // Genre filter via subquery on pivot
    if (genre) {
      const [genreRow] = await this.db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, genre))
        .limit(1);
      if (genreRow) {
        const mangaIdsWithGenre = await this.db
          .select({ mangaId: mangaGenres.mangaId })
          .from(mangaGenres)
          .where(eq(mangaGenres.genreId, genreRow.id));
        const ids = mangaIdsWithGenre.map((r) => r.mangaId);
        if (ids.length) conditions.push(inArray(manga.id, ids));
        else return { data: [], total: 0, page, limit };
      }
    }

    if (artist) {
      const rows = await this.db
        .select({ mangaId: mangaArtists.mangaId })
        .from(mangaArtists)
        .where(eq(mangaArtists.artistId, artist));
      const ids = rows.map((r) => r.mangaId);
      if (ids.length) conditions.push(inArray(manga.id, ids));
      else return { data: [], total: 0, page, limit };
    }

    if (author) {
      const rows = await this.db
        .select({ mangaId: mangaAuthors.mangaId })
        .from(mangaAuthors)
        .where(eq(mangaAuthors.authorId, author));
      const ids = rows.map((r) => r.mangaId);
      if (ids.length) conditions.push(inArray(manga.id, ids));
      else return { data: [], total: 0, page, limit };
    }

    const where = and(...conditions);
    const sortDir = order === SortOrder.ASC ? asc : desc;
    let orderBy;
    switch (sort) {
      case MangaSortField.VIEWS: orderBy = sortDir(manga.views); break;
      case MangaSortField.CREATED_AT: orderBy = sortDir(manga.createdAt); break;
      default: orderBy = sortDir(manga.updatedAt);
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

    return { data: rows as MangaListItem[], total: countResult, page, limit };
  }

  async findBySlug(slug: string): Promise<MangaDetail> {
    const [m] = await this.db
      .select()
      .from(manga)
      .where(and(eq(manga.slug, slug), isNull(manga.deletedAt)))
      .limit(1);
    if (!m) throw new NotFoundException('Manga not found');

    const [genreList, artistList, authorList, groupList, chapterList] = await Promise.all([
      this.db.select({ id: genres.id, name: genres.name, slug: genres.slug })
        .from(genres)
        .innerJoin(mangaGenres, eq(mangaGenres.genreId, genres.id))
        .where(eq(mangaGenres.mangaId, m.id)),
      this.db.select({ id: artists.id, name: artists.name, slug: artists.slug })
        .from(artists)
        .innerJoin(mangaArtists, eq(mangaArtists.artistId, artists.id))
        .where(eq(mangaArtists.mangaId, m.id)),
      this.db.select({ id: authors.id, name: authors.name, slug: authors.slug })
        .from(authors)
        .innerJoin(mangaAuthors, eq(mangaAuthors.authorId, authors.id))
        .where(eq(mangaAuthors.mangaId, m.id)),
      this.db.select({ id: groups.id, name: groups.name, slug: groups.slug })
        .from(groups)
        .innerJoin(mangaGroups, eq(mangaGroups.groupId, groups.id))
        .where(eq(mangaGroups.mangaId, m.id)),
      this.db
        .select({
          id: chapters.id,
          number: chapters.number,
          title: chapters.title,
          slug: chapters.slug,
          viewCount: chapters.viewCount,
          order: chapters.order,
          createdAt: chapters.createdAt,
        })
        .from(chapters)
        .where(and(eq(chapters.mangaId, m.id), isNull(chapters.deletedAt)))
        .orderBy(asc(chapters.order)),
    ]);

    return {
      ...m,
      genres: genreList,
      artists: artistList,
      authors: authorList,
      groups: groupList,
      chapters: chapterList as unknown as MangaDetail['chapters'],
    } as unknown as MangaDetail;
  }

  async create(dto: CreateMangaDto): Promise<MangaDetail> {
    const slug = dto.slug ?? slugify(dto.title);

    const [existing] = await this.db
      .select({ id: manga.id })
      .from(manga)
      .where(eq(manga.slug, slug))
      .limit(1);
    if (existing) throw new ConflictException('Manga with this slug already exists');

    const [created] = await this.db
      .insert(manga)
      .values({
        title: dto.title,
        titleAlt: dto.titleAlt,
        slug,
        description: dto.description,
        cover: dto.cover,
        status: dto.status,
        type: dto.type,
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
    if (dto.titleAlt !== undefined) updates.titleAlt = dto.titleAlt;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.cover !== undefined) updates.cover = dto.cover;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.slug !== undefined) updates.slug = dto.slug;

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

    await this.db.update(manga).set({ deletedAt: new Date() }).where(eq(manga.id, id));
  }

  private async syncPivots(mangaId: number, dto: CreateMangaDto | UpdateMangaDto): Promise<void> {
    if (dto.genreIds !== undefined) {
      await this.db.delete(mangaGenres).where(eq(mangaGenres.mangaId, mangaId));
      if (dto.genreIds.length) {
        await this.db.insert(mangaGenres).values(
          dto.genreIds.map((genreId) => ({ mangaId, genreId })),
        );
      }
    }
    if (dto.artistIds !== undefined) {
      await this.db.delete(mangaArtists).where(eq(mangaArtists.mangaId, mangaId));
      if (dto.artistIds.length) {
        await this.db.insert(mangaArtists).values(
          dto.artistIds.map((artistId) => ({ mangaId, artistId })),
        );
      }
    }
    if (dto.authorIds !== undefined) {
      await this.db.delete(mangaAuthors).where(eq(mangaAuthors.mangaId, mangaId));
      if (dto.authorIds.length) {
        await this.db.insert(mangaAuthors).values(
          dto.authorIds.map((authorId) => ({ mangaId, authorId })),
        );
      }
    }
    if (dto.groupIds !== undefined) {
      await this.db.delete(mangaGroups).where(eq(mangaGroups.mangaId, mangaId));
      if (dto.groupIds.length) {
        await this.db.insert(mangaGroups).values(
          dto.groupIds.map((groupId) => ({ mangaId, groupId })),
        );
      }
    }
  }
}
