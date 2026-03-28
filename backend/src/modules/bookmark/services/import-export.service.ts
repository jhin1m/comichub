import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  follows,
  bookmarkFolders,
} from '../../../database/schema/community.schema.js';
import { manga } from '../../../database/schema/manga.schema.js';
import { FolderService } from './folder.service.js';
import { ImportStrategy, ExportFormat } from '../dto/import-bookmark.dto.js';

export interface ParsedEntry {
  title: string;
  status: string;
  score: number;
  chaptersRead: number;
}

export interface MatchResult {
  entry: ParsedEntry;
  matched: { id: number; title: string; slug: string } | null;
  confidence: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  notFound: number;
}

const MAL_STATUS_TO_SLUG: Record<string, string> = {
  reading: 'reading',
  '1': 'reading',
  completed: 'completed',
  '2': 'completed',
  'on hold': 'on-hold',
  'on-hold': 'on-hold',
  '3': 'on-hold',
  dropped: 'dropped',
  '4': 'dropped',
  'plan to read': 'plan-to-read',
  'plan-to-read': 'plan-to-read',
  '6': 'plan-to-read',
};

@Injectable()
export class ImportExportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly folderService: FolderService,
  ) {}

  parseMALXml(buffer: Buffer): ParsedEntry[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
    });
    let parsed: any;
    try {
      parsed = parser.parse(buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid XML format');
    }

    const mangaList = parsed?.myanimelist?.manga;
    if (!mangaList) return [];

    const entries = Array.isArray(mangaList) ? mangaList : [mangaList];
    return entries
      .map((e: any) => ({
        title: String(e.manga_title ?? e.series_title ?? '').trim(),
        status: String(e.my_status ?? '').trim(),
        score: Number(e.my_score ?? 0),
        chaptersRead: Number(e.my_read_chapters ?? 0),
      }))
      .filter((e: ParsedEntry) => e.title);
  }

  parseMALJson(json: any): ParsedEntry[] {
    const list = Array.isArray(json) ? json : (json?.manga ?? json?.list ?? []);
    return list
      .map((e: any) => ({
        title: String(e.manga_title ?? e.title ?? '').trim(),
        status: String(e.my_status ?? e.status ?? '').trim(),
        score: Number(e.my_score ?? e.score ?? 0),
        chaptersRead: Number(e.my_read_chapters ?? e.chapters_read ?? 0),
      }))
      .filter((e: ParsedEntry) => e.title);
  }

  async matchTitles(entries: ParsedEntry[]): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    for (const entry of entries) {
      const lowerTitle = entry.title.toLowerCase();

      const escaped = entry.title.replace(/[%_\\]/g, '\\$&');
      const rows = await this.db
        .select({ id: manga.id, title: manga.title, slug: manga.slug })
        .from(manga)
        .where(ilike(manga.title, `%${escaped}%`))
        .limit(5);

      if (!rows.length) {
        results.push({ entry, matched: null, confidence: 0 });
        continue;
      }

      // Prefer exact match
      const exact = rows.find((r) => r.title.toLowerCase() === lowerTitle);
      if (exact) {
        results.push({ entry, matched: exact, confidence: 1.0 });
      } else {
        results.push({ entry, matched: rows[0], confidence: 0.5 });
      }
    }

    return results;
  }

  async importBookmarks(
    userId: number,
    entries: ParsedEntry[],
    strategy: ImportStrategy = ImportStrategy.SKIP,
  ): Promise<ImportResult> {
    await this.folderService.ensureDefaultFolders(userId);

    const folders = await this.db
      .select({ id: bookmarkFolders.id, slug: bookmarkFolders.slug })
      .from(bookmarkFolders)
      .where(eq(bookmarkFolders.userId, userId));

    const folderBySlug = new Map(folders.map((f) => [f.slug, f.id]));
    const readingFolderId = folderBySlug.get('reading');

    const result: ImportResult = { imported: 0, skipped: 0, notFound: 0 };
    const BATCH = 50;

    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const matchResults = await this.matchTitles(batch);

      for (let j = 0; j < batch.length; j++) {
        const match = matchResults[j];

        if (!match.matched) {
          result.notFound++;
          continue;
        }

        const slug =
          MAL_STATUS_TO_SLUG[match.entry.status.toLowerCase()] ?? 'reading';
        const folderId = folderBySlug.get(slug) ?? readingFolderId ?? null;

        const existing = await this.db.query.follows.findFirst({
          where: and(
            eq(follows.userId, userId),
            eq(follows.mangaId, match.matched.id),
          ),
        });

        if (existing) {
          if (strategy === ImportStrategy.OVERWRITE && folderId) {
            await this.db
              .update(follows)
              .set({ folderId })
              .where(
                and(
                  eq(follows.userId, userId),
                  eq(follows.mangaId, match.matched.id),
                ),
              );
            result.imported++;
          } else {
            result.skipped++;
          }
        } else {
          await this.db
            .insert(follows)
            .values({ userId, mangaId: match.matched.id, folderId });
          // Keep followersCount consistent
          await this.db
            .update(manga)
            .set({ followersCount: sql`${manga.followersCount} + 1` })
            .where(eq(manga.id, match.matched.id));
          result.imported++;
        }
      }
    }

    return result;
  }

  async exportBookmarks(
    userId: number,
    format: ExportFormat = ExportFormat.JSON,
    folderId?: number,
  ): Promise<string> {
    const conditions = [eq(follows.userId, userId)];
    if (folderId) conditions.push(eq(follows.folderId, folderId));

    const rows = await this.db
      .select({
        title: manga.title,
        slug: manga.slug,
        folderName: bookmarkFolders.name,
        folderSlug: bookmarkFolders.slug,
        addedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(manga, eq(follows.mangaId, manga.id))
      .leftJoin(bookmarkFolders, eq(follows.folderId, bookmarkFolders.id))
      .where(and(...conditions));

    if (format === ExportFormat.JSON) {
      return JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          bookmarks: rows.map((r) => ({
            title: r.title,
            slug: r.slug,
            folder: r.folderSlug ?? null,
            addedAt: r.addedAt,
          })),
        },
        null,
        2,
      );
    }

    // MAL-compatible XML
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xmlObj = {
      myanimelist: {
        manga: rows.map((r) => ({
          manga_title: r.title,
          my_status: r.folderName ?? 'Reading',
          my_score: 0,
          my_read_chapters: 0,
        })),
      },
    };

    return builder.build(xmlObj);
  }
}
