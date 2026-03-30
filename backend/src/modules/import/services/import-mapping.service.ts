import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
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
  mangaSources,
  mangaLinks,
  chapters,
  chapterSources,
  chapterImages,
  chapterGroups,
} from '../../../database/schema/index.js';
import { slugify } from '../../../common/utils/slug.util.js';
import type {
  ExternalManga,
  ExternalLink,
  ExternalChapter,
  ExternalChapterImage,
  ImportResult,
} from '../types/external-manga.types.js';
import type { ImportSource } from '../types/import-source.enum.js';

type TaxonomyTable = typeof genres | typeof artists | typeof authors | typeof groups;

@Injectable()
export class ImportMappingService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async resolveByName(
    table: TaxonomyTable,
    names: string[],
  ): Promise<number[]> {
    if (!names.length) return [];
    const t = table as typeof genres;
    const slugMap = new Map(names.map((name) => [slugify(name), name]));
    const slugs = [...slugMap.keys()];

    // Batch lookup existing
    const existing = await this.db
      .select({ id: t.id, slug: t.slug })
      .from(t)
      .where(inArray(t.slug, slugs));

    const foundSlugs = new Set(existing.map((r) => r.slug));
    const missing = slugs.filter((s) => !foundSlugs.has(s));

    if (missing.length) {
      await this.db
        .insert(t)
        .values(
          missing.map(
            (s) =>
              ({ name: slugMap.get(s)!, slug: s }) as {
                name: string;
                slug: string;
              },
          ),
        )
        .onConflictDoNothing();
      // Re-query to get correct IDs (positional mapping breaks when conflicts occur)
      const newlyResolved = await this.db
        .select({ id: t.id, slug: t.slug })
        .from(t)
        .where(inArray(t.slug, missing));
      existing.push(...newlyResolved);
    }

    // Preserve input order
    const idBySlug = new Map(
      existing.map((r) => [r.slug, r.id] as [string, number]),
    );
    return slugs
      .map((s) => idBySlug.get(s))
      .filter((id): id is number => id !== undefined);
  }

  async resolveGenres(names: string[], group = 'genre'): Promise<number[]> {
    if (!names.length) return [];
    const slugMap = new Map(names.map((name) => [slugify(name), name]));
    const slugs = [...slugMap.keys()];

    // Batch lookup existing
    const existing = await this.db
      .select({ id: genres.id, slug: genres.slug })
      .from(genres)
      .where(inArray(genres.slug, slugs));

    const foundSlugs = new Set(existing.map((r) => r.slug));
    const missing = slugs.filter((s) => !foundSlugs.has(s));

    if (missing.length) {
      await this.db
        .insert(genres)
        .values(missing.map((s) => ({ name: slugMap.get(s)!, slug: s, group })))
        .onConflictDoNothing();
      const newlyResolved = await this.db
        .select({ id: genres.id, slug: genres.slug })
        .from(genres)
        .where(inArray(genres.slug, missing));
      existing.push(...newlyResolved);
    }

    const idBySlug = new Map(
      existing.map((r) => [r.slug, r.id] as [string, number]),
    );
    return slugs
      .map((s) => idBySlug.get(s))
      .filter((id): id is number => id !== undefined);
  }

  async syncPivots(
    mangaId: number,
    genreIds: number[],
    artistIds: number[],
    authorIds: number[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.syncPivotsTx(tx, mangaId, genreIds, artistIds, authorIds);
    });
  }

  async upsertLinks(mangaId: number, links: ExternalLink[]): Promise<void> {
    for (const link of links) {
      await this.db
        .insert(mangaLinks)
        .values({
          mangaId,
          type: link.type,
          externalId: link.externalId,
          url: link.url,
        })
        .onConflictDoUpdate({
          target: [mangaLinks.mangaId, mangaLinks.type],
          set: { externalId: link.externalId, url: link.url },
        });
    }
  }

  async upsertManga(
    external: ExternalManga,
    source: ImportSource,
  ): Promise<ImportResult> {
    // Resolve taxonomy outside transaction (idempotent find-or-create)
    const genreIds = await this.resolveGenres(external.genres, 'genre');
    const themeIds = await this.resolveGenres(external.themes, 'theme');
    const allGenreIds = [...new Set([...genreIds, ...themeIds])];
    const artistIds = await this.resolveByName(artists, external.artists);
    const authorIds = await this.resolveByName(authors, external.authors);

    const mangaValues = {
      title: external.title,
      nativeTitle: external.nativeTitle ?? null,
      romanizedTitle: external.romanizedTitle ?? null,
      altTitles: external.altTitles,
      description: external.description ?? null,
      cover: external.coverUrl ?? null,
      originalLanguage: external.originalLanguage ?? null,
      status: (external.status ??
        'ongoing') as (typeof manga.$inferInsert)['status'],
      type: (external.type ?? 'manga') as (typeof manga.$inferInsert)['type'],
      contentRating: (external.contentRating ??
        'safe') as (typeof manga.$inferInsert)['contentRating'],
      demographic: external.demographic ?? null,
      year: external.year ?? null,
    };

    return this.db.transaction(async (tx) => {
      const [existingSource] = await tx
        .select({ mangaId: mangaSources.mangaId })
        .from(mangaSources)
        .where(
          and(
            eq(mangaSources.source, source),
            eq(mangaSources.externalId, external.externalId),
          ),
        )
        .limit(1);

      if (existingSource) {
        const { mangaId } = existingSource;
        const [updated] = await tx
          .update(manga)
          .set(mangaValues)
          .where(eq(manga.id, mangaId))
          .returning({ slug: manga.slug });

        await this.syncPivotsTx(tx, mangaId, allGenreIds, artistIds, authorIds);
        await this.upsertLinksTx(tx, mangaId, external.links);
        await tx
          .update(mangaSources)
          .set({ lastSyncedAt: new Date() })
          .where(
            and(
              eq(mangaSources.source, source),
              eq(mangaSources.externalId, external.externalId),
            ),
          );

        return { mangaId, slug: updated.slug, created: false };
      }

      // New manga — generate unique slug
      const baseSlug = slugify(external.title);
      let slug = baseSlug;
      const [conflict] = await tx
        .select({ id: manga.id })
        .from(manga)
        .where(eq(manga.slug, slug))
        .limit(1);
      if (conflict) slug = `${baseSlug}-${Date.now()}`;

      const [inserted] = await tx
        .insert(manga)
        .values({ ...mangaValues, slug })
        .returning({ id: manga.id, slug: manga.slug });

      const mangaId = inserted.id;

      await tx.insert(mangaSources).values({
        mangaId,
        source,
        externalId: external.externalId,
        lastSyncedAt: new Date(),
      });

      await this.syncPivotsTx(tx, mangaId, allGenreIds, artistIds, authorIds);
      await this.upsertLinksTx(tx, mangaId, external.links);

      return { mangaId, slug: inserted.slug, created: true };
    });
  }

  async upsertChapters(
    mangaId: number,
    externalChapters: ExternalChapter[],
    source: ImportSource,
  ): Promise<{ chapterId: number; externalId: string; isNew: boolean }[]> {
    const results: { chapterId: number; externalId: string; isNew: boolean }[] = [];

    for (const ext of externalChapters) {
      const [existing] = await this.db
        .select({ chapterId: chapterSources.chapterId })
        .from(chapterSources)
        .where(
          and(
            eq(chapterSources.source, source),
            eq(chapterSources.externalId, ext.externalId),
          ),
        )
        .limit(1);

      if (existing) {
        results.push({ chapterId: existing.chapterId, externalId: ext.externalId, isNew: false });
        continue;
      }

      const slug = `chapter-${ext.number}`;
      const [existingChapter] = await this.db
        .select({ id: chapters.id })
        .from(chapters)
        .where(
          and(
            eq(chapters.mangaId, mangaId),
            eq(chapters.number, String(ext.number)),
            eq(chapters.language, ext.language),
          ),
        )
        .limit(1);

      let chapterId: number;
      if (existingChapter) {
        chapterId = existingChapter.id;
      } else {
        const [inserted] = await this.db
          .insert(chapters)
          .values({
            mangaId,
            number: String(ext.number),
            title: ext.title ?? null,
            slug,
            language: ext.language,
            volume: ext.volume ?? null,
            publishedAt: ext.publishedAt ? new Date(ext.publishedAt) : null,
            order: Math.round(ext.number * 10),
          })
          .onConflictDoNothing()
          .returning({ id: chapters.id });

        if (!inserted) {
          const [found] = await this.db
            .select({ id: chapters.id })
            .from(chapters)
            .where(
              and(
                eq(chapters.mangaId, mangaId),
                eq(chapters.number, String(ext.number)),
                eq(chapters.language, ext.language),
              ),
            )
            .limit(1);
          if (!found) continue;
          chapterId = found.id;
        } else {
          chapterId = inserted.id;
        }
      }

      await this.db
        .insert(chapterSources)
        .values({
          chapterId,
          source,
          externalId: ext.externalId,
          lastSyncedAt: new Date(),
        })
        .onConflictDoNothing();

      // Link scanlation groups to chapter
      if (ext.groups?.length) {
        const groupIds = await this.resolveByName(groups, ext.groups.map((g) => g.name));
        if (groupIds.length) {
          await this.db
            .insert(chapterGroups)
            .values(groupIds.map((groupId) => ({ chapterId, groupId })))
            .onConflictDoNothing();
        }
      }

      results.push({ chapterId, externalId: ext.externalId, isNew: !existingChapter });
    }

    return results;
  }

  async insertChapterImages(
    chapterId: number,
    images: ExternalChapterImage[],
    groupId?: number | null,
  ): Promise<number> {
    if (!images.length) return 0;

    // Check if images already exist for this exact chapter+group combo (symmetric for null)
    const existingQuery = this.db
      .select({ id: chapterImages.id })
      .from(chapterImages)
      .where(
        and(
          eq(chapterImages.chapterId, chapterId),
          groupId != null
            ? eq(chapterImages.groupId, groupId)
            : isNull(chapterImages.groupId),
        ),
      )
      .limit(1);

    const [existing] = await existingQuery;
    if (existing) return 0;

    const records = images.map((img, idx) => ({
      chapterId,
      groupId: groupId ?? null,
      imageUrl: img.url,
      sourceUrl: img.url,
      pageNumber: img.pageNumber,
      order: idx + 1,
      width: img.width ?? null,
      height: img.height ?? null,
    }));

    await this.db.insert(chapterImages).values(records);
    return records.length;
  }

  private async syncPivotsTx(
    tx: DrizzleDB,
    mangaId: number,
    genreIds: number[],
    artistIds: number[],
    authorIds: number[],
  ): Promise<void> {
    await tx.delete(mangaGenres).where(eq(mangaGenres.mangaId, mangaId));
    await tx.delete(mangaArtists).where(eq(mangaArtists.mangaId, mangaId));
    await tx.delete(mangaAuthors).where(eq(mangaAuthors.mangaId, mangaId));

    if (genreIds.length > 0) {
      await tx
        .insert(mangaGenres)
        .values(genreIds.map((genreId) => ({ mangaId, genreId })));
    }
    if (artistIds.length > 0) {
      await tx
        .insert(mangaArtists)
        .values(artistIds.map((artistId) => ({ mangaId, artistId })));
    }
    if (authorIds.length > 0) {
      await tx
        .insert(mangaAuthors)
        .values(authorIds.map((authorId) => ({ mangaId, authorId })));
    }
  }

  private async upsertLinksTx(
    tx: DrizzleDB,
    mangaId: number,
    links: ExternalLink[],
  ): Promise<void> {
    for (const link of links) {
      await tx
        .insert(mangaLinks)
        .values({
          mangaId,
          type: link.type,
          externalId: link.externalId,
          url: link.url,
        })
        .onConflictDoUpdate({
          target: [mangaLinks.mangaId, mangaLinks.type],
          set: { externalId: link.externalId, url: link.url },
        });
    }
  }
}
