import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  manga,
  genres,
  artists,
  authors,
  mangaGenres,
  mangaArtists,
  mangaAuthors,
  mangaSources,
  mangaLinks,
} from '../../../database/schema/index.js';
import { slugify } from '../../../common/utils/slug.util.js';
import type { ExternalManga, ExternalLink, ImportResult } from '../types/external-manga.types.js';
import type { ImportSource } from '../types/import-source.enum.js';

type TaxonomyTable = typeof genres | typeof artists | typeof authors;

@Injectable()
export class ImportMappingService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async resolveByName(table: TaxonomyTable, names: string[]): Promise<number[]> {
    const ids: number[] = [];
    for (const name of names) {
      const slug = slugify(name);
      const [existing] = await this.db
        .select({ id: table.id })
        .from(table as typeof genres)
        .where(eq((table as typeof genres).slug, slug))
        .limit(1);
      if (existing) {
        ids.push(existing.id);
      } else {
        const [created] = await this.db
          .insert(table as typeof genres)
          .values({ name, slug } as { name: string; slug: string })
          .onConflictDoNothing()
          .returning({ id: (table as typeof genres).id });
        if (created) ids.push(created.id);
      }
    }
    return ids;
  }

  async resolveGenres(names: string[], group = 'genre'): Promise<number[]> {
    const ids: number[] = [];
    for (const name of names) {
      const slug = slugify(name);
      const [existing] = await this.db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, slug))
        .limit(1);
      if (existing) {
        ids.push(existing.id);
      } else {
        const [created] = await this.db
          .insert(genres)
          .values({ name, slug, group })
          .onConflictDoNothing()
          .returning({ id: genres.id });
        if (created) ids.push(created.id);
      }
    }
    return ids;
  }

  async syncPivots(
    mangaId: number,
    genreIds: number[],
    artistIds: number[],
    authorIds: number[],
  ): Promise<void> {
    await this.db.delete(mangaGenres).where(eq(mangaGenres.mangaId, mangaId));
    await this.db.delete(mangaArtists).where(eq(mangaArtists.mangaId, mangaId));
    await this.db.delete(mangaAuthors).where(eq(mangaAuthors.mangaId, mangaId));

    if (genreIds.length > 0) {
      await this.db.insert(mangaGenres).values(genreIds.map((genreId) => ({ mangaId, genreId })));
    }
    if (artistIds.length > 0) {
      await this.db.insert(mangaArtists).values(artistIds.map((artistId) => ({ mangaId, artistId })));
    }
    if (authorIds.length > 0) {
      await this.db.insert(mangaAuthors).values(authorIds.map((authorId) => ({ mangaId, authorId })));
    }
  }

  async upsertLinks(mangaId: number, links: ExternalLink[]): Promise<void> {
    for (const link of links) {
      await this.db
        .insert(mangaLinks)
        .values({ mangaId, type: link.type, externalId: link.externalId, url: link.url })
        .onConflictDoUpdate({
          target: [mangaLinks.mangaId, mangaLinks.type],
          set: { externalId: link.externalId, url: link.url },
        });
    }
  }

  async upsertManga(external: ExternalManga, source: ImportSource): Promise<ImportResult> {
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
      status: (external.status ?? 'ongoing') as typeof manga.$inferInsert['status'],
      type: (external.type ?? 'manga') as typeof manga.$inferInsert['type'],
      contentRating: (external.contentRating ?? 'safe') as typeof manga.$inferInsert['contentRating'],
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

        return { mangaId, slug: updated!.slug, created: false };
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

      const mangaId = inserted!.id;

      await tx.insert(mangaSources).values({
        mangaId,
        source,
        externalId: external.externalId,
        lastSyncedAt: new Date(),
      });

      await this.syncPivotsTx(tx, mangaId, allGenreIds, artistIds, authorIds);
      await this.upsertLinksTx(tx, mangaId, external.links);

      return { mangaId, slug: inserted!.slug, created: true };
    });
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
      await tx.insert(mangaGenres).values(genreIds.map((genreId) => ({ mangaId, genreId })));
    }
    if (artistIds.length > 0) {
      await tx.insert(mangaArtists).values(artistIds.map((artistId) => ({ mangaId, artistId })));
    }
    if (authorIds.length > 0) {
      await tx.insert(mangaAuthors).values(authorIds.map((authorId) => ({ mangaId, authorId })));
    }
  }

  private async upsertLinksTx(tx: DrizzleDB, mangaId: number, links: ExternalLink[]): Promise<void> {
    for (const link of links) {
      await tx
        .insert(mangaLinks)
        .values({ mangaId, type: link.type, externalId: link.externalId, url: link.url })
        .onConflictDoUpdate({
          target: [mangaLinks.mangaId, mangaLinks.type],
          set: { externalId: link.externalId, url: link.url },
        });
    }
  }
}
