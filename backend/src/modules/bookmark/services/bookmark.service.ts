import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  eq,
  and,
  count,
  sql,
  desc,
  asc,
  ilike,
  inArray,
  gte,
  lte,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  follows,
  bookmarkFolders,
  ratings,
  readingHistory,
} from '../../../database/schema/community.schema.js';
import { manga, chapters } from '../../../database/schema/manga.schema.js';
import { FolderService } from './folder.service.js';
import type { BookmarkQueryDto } from '../dto/bookmark-query.dto.js';
import {
  BookmarkSortBy,
  BookmarkSortOrder,
} from '../dto/bookmark-query.dto.js';
import type { PaginatedResult } from '../../user/types/user.types.js';

export interface BookmarkStatusResult {
  bookmarked: boolean;
  folderId: number | null;
  folderName: string | null;
  folderSlug: string | null;
}

export interface BookmarkToggleResult {
  bookmarked: boolean;
  folderId: number | null;
  followersCount: number;
}

@Injectable()
export class BookmarkService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly folderService: FolderService,
  ) {}

  async addBookmark(
    userId: number,
    mangaId: number,
    folderId?: number,
  ): Promise<BookmarkToggleResult> {
    const [mangaRow] = await this.db
      .select({ id: manga.id, followersCount: manga.followersCount })
      .from(manga)
      .where(eq(manga.id, mangaId))
      .limit(1);

    if (!mangaRow) throw new NotFoundException('Manga not found');

    await this.folderService.ensureDefaultFolders(userId);

    let resolvedFolderId: number;
    if (folderId) {
      const folder = await this.folderService.assertFolderBelongsToUser(
        userId,
        folderId,
      );
      resolvedFolderId = folder.id;
    } else {
      const readingFolder = await this.folderService.getReadingFolder(userId);
      if (!readingFolder) {
        throw new BadRequestException('No default reading folder found');
      }
      resolvedFolderId = readingFolder.id;
    }

    // Check if already bookmarked
    const existing = await this.db.query.follows.findFirst({
      where: and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)),
    });

    if (existing) {
      // Change folder instead
      await this.db
        .update(follows)
        .set({ folderId: resolvedFolderId })
        .where(and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)));

      return {
        bookmarked: true,
        folderId: resolvedFolderId,
        followersCount: mangaRow.followersCount,
      };
    }

    return this.db.transaction(async (tx) => {
      await tx
        .insert(follows)
        .values({ userId, mangaId, folderId: resolvedFolderId });

      const [updated] = await tx
        .update(manga)
        .set({ followersCount: sql`${manga.followersCount} + 1` })
        .where(eq(manga.id, mangaId))
        .returning({ followersCount: manga.followersCount });

      return {
        bookmarked: true,
        folderId: resolvedFolderId,
        followersCount: updated?.followersCount ?? mangaRow.followersCount + 1,
      };
    });
  }

  async removeBookmark(
    userId: number,
    mangaId: number,
  ): Promise<{ bookmarked: false; followersCount: number }> {
    const [mangaRow] = await this.db
      .select({ id: manga.id, followersCount: manga.followersCount })
      .from(manga)
      .where(eq(manga.id, mangaId))
      .limit(1);

    if (!mangaRow) throw new NotFoundException('Manga not found');

    return this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(follows)
        .where(and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)))
        .returning({ id: follows.id });

      if (deleted.length === 0) {
        return { bookmarked: false as const, followersCount: mangaRow.followersCount };
      }

      const [updated] = await tx
        .update(manga)
        .set({ followersCount: sql`greatest(${manga.followersCount} - 1, 0)` })
        .where(eq(manga.id, mangaId))
        .returning({ followersCount: manga.followersCount });

      return {
        bookmarked: false as const,
        followersCount: updated?.followersCount ?? 0,
      };
    });
  }

  async changeFolder(
    userId: number,
    mangaId: number,
    folderId: number,
  ): Promise<{ folderId: number }> {
    await this.folderService.assertFolderBelongsToUser(userId, folderId);

    const [existing] = await this.db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)))
      .limit(1);

    if (!existing) throw new NotFoundException('Bookmark not found');

    await this.db
      .update(follows)
      .set({ folderId })
      .where(and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)));

    return { folderId };
  }

  async removeMany(
    userId: number,
    mangaIds: number[],
  ): Promise<{ removed: number }> {
    if (mangaIds.length === 0) return { removed: 0 };

    return this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(follows)
        .where(
          and(eq(follows.userId, userId), inArray(follows.mangaId, mangaIds)),
        )
        .returning({ mangaId: follows.mangaId });

      if (deleted.length === 0) return { removed: 0 };

      const removedIds = deleted.map((d) => d.mangaId);
      await tx
        .update(manga)
        .set({
          followersCount: sql`greatest(${manga.followersCount} - 1, 0)`,
        })
        .where(inArray(manga.id, removedIds));

      return { removed: deleted.length };
    });
  }

  async changeFolderMany(
    userId: number,
    mangaIds: number[],
    folderId: number,
  ): Promise<{ updated: number; folderId: number }> {
    if (mangaIds.length === 0) return { updated: 0, folderId };

    await this.folderService.assertFolderBelongsToUser(userId, folderId);

    const updated = await this.db
      .update(follows)
      .set({ folderId })
      .where(
        and(eq(follows.userId, userId), inArray(follows.mangaId, mangaIds)),
      )
      .returning({ id: follows.id });

    return { updated: updated.length, folderId };
  }

  async getStatus(
    userId: number,
    mangaId: number,
  ): Promise<BookmarkStatusResult> {
    const row = await this.db
      .select({
        folderId: follows.folderId,
        folderName: bookmarkFolders.name,
        folderSlug: bookmarkFolders.slug,
      })
      .from(follows)
      .leftJoin(bookmarkFolders, eq(follows.folderId, bookmarkFolders.id))
      .where(and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)))
      .limit(1);

    if (!row.length) {
      return {
        bookmarked: false,
        folderId: null,
        folderName: null,
        folderSlug: null,
      };
    }

    return {
      bookmarked: true,
      folderId: row[0].folderId ?? null,
      folderName: row[0].folderName ?? null,
      folderSlug: row[0].folderSlug ?? null,
    };
  }

  async getBookmarks(
    userId: number,
    query: BookmarkQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const {
      page,
      limit,
      offset,
      folderId,
      search,
      sortBy = BookmarkSortBy.UPDATED,
      sortOrder = BookmarkSortOrder.DESC,
      types,
      genres: genreFilter,
      excludedGenres,
      demographic,
      status,
      minChapters,
      yearFrom,
      yearTo,
      authors: authorFilter,
      artists: artistFilter,
      minRating,
    } = query;

    const conditions: SQL[] = [eq(follows.userId, userId)];

    if (folderId) conditions.push(eq(follows.folderId, folderId));
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&');
      conditions.push(ilike(manga.title, `%${escaped}%`));
    }
    if (status) conditions.push(eq(manga.status, status as never));
    if (demographic) conditions.push(eq(manga.demographic, demographic));
    if (yearFrom) conditions.push(gte(manga.year, yearFrom));
    if (yearTo) conditions.push(lte(manga.year, yearTo));
    if (minChapters) conditions.push(gte(manga.chaptersCount, minChapters));
    if (minRating)
      conditions.push(gte(sql`${manga.averageRating}::numeric`, minRating));

    if (types) {
      const typeList = types.split(',');
      conditions.push(inArray(manga.type, typeList as never[]));
    }

    // Genre filters via subqueries
    if (genreFilter) {
      const slugList = genreFilter.split(',');
      conditions.push(
        sql`${manga.id} IN (
          SELECT mg.manga_id FROM manga_genres mg
          JOIN genres g ON g.id = mg.genre_id
          WHERE g.slug = ANY(${slugList})
        )`,
      );
    }

    if (excludedGenres) {
      const slugList = excludedGenres.split(',');
      conditions.push(
        sql`${manga.id} NOT IN (
          SELECT mg.manga_id FROM manga_genres mg
          JOIN genres g ON g.id = mg.genre_id
          WHERE g.slug = ANY(${slugList})
        )`,
      );
    }

    if (authorFilter) {
      const ids = authorFilter.split(',').map(Number);
      conditions.push(
        sql`${manga.id} IN (
          SELECT ma.manga_id FROM manga_authors ma WHERE ma.author_id = ANY(${ids})
        )`,
      );
    }

    if (artistFilter) {
      const ids = artistFilter.split(',').map(Number);
      conditions.push(
        sql`${manga.id} IN (
          SELECT mar.manga_id FROM manga_artists mar WHERE mar.artist_id = ANY(${ids})
        )`,
      );
    }

    const whereClause = and(...conditions)!;

    // Sort expression
    const sortExpr = (() => {
      const dir = sortOrder === BookmarkSortOrder.ASC ? asc : desc;
      switch (sortBy) {
        case BookmarkSortBy.ADDED:
          return dir(follows.createdAt);
        case BookmarkSortBy.TITLE:
          return dir(manga.title);
        case BookmarkSortBy.LAST_READ:
          return dir(readingHistory.lastReadAt);
        case BookmarkSortBy.UPDATED:
        default:
          return dir(manga.chapterUpdatedAt);
      }
    })();

    const [totalRow, rows] = await Promise.all([
      this.db
        .select({ cnt: count() })
        .from(follows)
        .innerJoin(manga, eq(follows.mangaId, manga.id))
        .leftJoin(
          readingHistory,
          and(
            eq(readingHistory.userId, userId),
            eq(readingHistory.mangaId, manga.id),
          ),
        )
        .where(whereClause),
      this.db
        .select({
          id: follows.id,
          mangaId: follows.mangaId,
          addedAt: follows.createdAt,
          folderId: follows.folderId,
          folderName: bookmarkFolders.name,
          folderSlug: bookmarkFolders.slug,
          manga: {
            id: manga.id,
            title: manga.title,
            slug: manga.slug,
            cover: manga.cover,
            status: manga.status,
            type: manga.type,
            chaptersCount: manga.chaptersCount,
            followersCount: manga.followersCount,
            averageRating: manga.averageRating,
            chapterUpdatedAt: manga.chapterUpdatedAt,
            year: manga.year,
            demographic: manga.demographic,
          },
          readingHistory: {
            chapterId: readingHistory.chapterId,
            lastReadAt: readingHistory.lastReadAt,
            chapterNumber: chapters.number,
          },
          userRating: ratings.score,
        })
        .from(follows)
        .innerJoin(manga, eq(follows.mangaId, manga.id))
        .leftJoin(bookmarkFolders, eq(follows.folderId, bookmarkFolders.id))
        .leftJoin(
          readingHistory,
          and(
            eq(readingHistory.userId, userId),
            eq(readingHistory.mangaId, manga.id),
          ),
        )
        .leftJoin(chapters, eq(chapters.id, readingHistory.chapterId))
        .leftJoin(
          ratings,
          and(eq(ratings.userId, userId), eq(ratings.mangaId, manga.id)),
        )
        .where(whereClause)
        .orderBy(sortExpr)
        .limit(limit)
        .offset(offset),
    ]);

    // Transform flat fields to nested objects for frontend consumption
    const data = rows.map((row) => ({
      id: row.id,
      mangaId: row.mangaId,
      manga: row.manga,
      folder: {
        id: row.folderId,
        name: row.folderName,
        slug: row.folderSlug,
      },
      userRating: row.userRating ?? null,
      readingProgress: row.readingHistory?.chapterId
        ? {
            currentChapter: row.readingHistory.chapterNumber ?? null,
            currentChapterId: row.readingHistory.chapterId,
            lastReadAt: row.readingHistory.lastReadAt,
          }
        : null,
      createdAt: row.addedAt,
    }));

    const total = totalRow[0]?.cnt ?? 0;
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
