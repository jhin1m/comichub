import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, inArray, desc, sql, count } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { mangaSources, manga, chapters } from '../../../database/schema/index.js';
import type { SourceAdapter } from '../adapters/source-adapter.interface.js';
import { ImportSource } from '../types/import-source.enum.js';
import type {
  ImportResult,
  SearchResult,
  ExternalChapter,
} from '../types/external-manga.types.js';
import { ImportMappingService } from './import-mapping.service.js';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private adapters = new Map<ImportSource, SourceAdapter>();

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private mappingService: ImportMappingService,
  ) {}

  registerAdapter(source: ImportSource, adapter: SourceAdapter): void {
    this.adapters.set(source, adapter);
  }

  private getAdapter(source: ImportSource): SourceAdapter {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new BadRequestException(
        `No adapter registered for source: ${source}`,
      );
    }
    return adapter;
  }

  async importManga(
    source: ImportSource,
    externalId: string,
  ): Promise<ImportResult> {
    const adapter = this.getAdapter(source);
    try {
      const external = await adapter.fetchManga(externalId);
      return await this.mappingService.upsertManga(external, source);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Import failed for ${source}/${externalId}: ${(err as Error).message}`,
      );
    }
  }

  async searchManga(
    source: ImportSource,
    query: string,
  ): Promise<SearchResult[]> {
    const adapter = this.getAdapter(source);
    const results = await adapter.searchManga(query);

    const externalIds = results.map((r) => r.externalId);
    const imported =
      externalIds.length > 0
        ? await this.db
            .select({
              externalId: mangaSources.externalId,
              mangaId: mangaSources.mangaId,
            })
            .from(mangaSources)
            .where(
              and(
                eq(mangaSources.source, source),
                inArray(mangaSources.externalId, externalIds),
              ),
            )
        : [];

    const importedMap = new Map(imported.map((r) => [r.externalId, r.mangaId]));

    return results.map((r) => ({
      ...r,
      alreadyImported: importedMap.has(r.externalId),
      internalId: importedMap.get(r.externalId),
    }));
  }

  async syncManga(mangaId: number): Promise<ImportResult> {
    const [sourceRecord] = await this.db
      .select()
      .from(mangaSources)
      .where(eq(mangaSources.mangaId, mangaId))
      .limit(1);

    if (!sourceRecord) {
      throw new NotFoundException(
        `No import source found for manga ${mangaId}`,
      );
    }

    const source = sourceRecord.source as ImportSource;
    const adapter = this.getAdapter(source);

    try {
      const external = await adapter.fetchManga(sourceRecord.externalId);
      return await this.mappingService.upsertManga(external, source);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(
        `Sync failed for manga ${mangaId}: ${(err as Error).message}`,
      );
    }
  }

  async importChapters(
    mangaId: number,
    lang = 'en',
  ): Promise<{ chaptersImported: number; imagesImported: number }> {
    const [sourceRecord] = await this.db
      .select()
      .from(mangaSources)
      .where(eq(mangaSources.mangaId, mangaId))
      .limit(1);

    if (!sourceRecord) {
      throw new NotFoundException(`No import source found for manga ${mangaId}`);
    }

    const source = sourceRecord.source as ImportSource;
    const adapter = this.getAdapter(source);

    if (!adapter.fetchChapters) {
      throw new BadRequestException(`Adapter ${source} does not support chapter fetching`);
    }

    const MAX_PAGES = 50;
    let page = 1;
    let allChapters: ExternalChapter[] = [];
    let batch: ExternalChapter[];
    do {
      batch = await adapter.fetchChapters(sourceRecord.externalId, lang, page);
      allChapters.push(...batch);
      page++;
    } while (batch.length === 100 && page <= MAX_PAGES);

    if (!allChapters.length) {
      return { chaptersImported: 0, imagesImported: 0 };
    }

    const results = await this.mappingService.upsertChapters(mangaId, allChapters, source);
    const newChapters = results.filter((r) => r.isNew);

    let imagesImported = 0;
    if (adapter.fetchChapterImages) {
      for (const ch of newChapters) {
        try {
          const images = await adapter.fetchChapterImages(ch.externalId);
          imagesImported += await this.mappingService.insertChapterImages(ch.chapterId, images);
        } catch (err) {
          this.logger.warn(`Image import failed for chapter ${ch.externalId}: ${(err as Error).message}`);
        }
      }
    }

    // Update manga counters: lastChapterId, chaptersCount, chapterUpdatedAt
    if (newChapters.length > 0) {
      const [latest] = await this.db
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.mangaId, mangaId))
        .orderBy(desc(chapters.number))
        .limit(1);

      const [{ total }] = await this.db
        .select({ total: count() })
        .from(chapters)
        .where(eq(chapters.mangaId, mangaId));

      const now = new Date();
      await this.db
        .update(manga)
        .set({
          lastChapterId: latest?.id ?? null,
          chaptersCount: total,
          chapterUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(manga.id, mangaId));
    }

    return { chaptersImported: newChapters.length, imagesImported };
  }

  async getMangaSources(mangaId: number) {
    return this.db
      .select()
      .from(mangaSources)
      .where(eq(mangaSources.mangaId, mangaId));
  }
}
