import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { mangaSources } from '../../../database/schema/index.js';
import type { SourceAdapter } from '../adapters/source-adapter.interface.js';
import { ImportSource } from '../types/import-source.enum.js';
import type { ImportResult, SearchResult } from '../types/external-manga.types.js';
import { ImportMappingService } from './import-mapping.service.js';

@Injectable()
export class ImportService {
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
      throw new BadRequestException(`No adapter registered for source: ${source}`);
    }
    return adapter;
  }

  async importManga(source: ImportSource, externalId: string): Promise<ImportResult> {
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

  async searchManga(source: ImportSource, query: string): Promise<SearchResult[]> {
    const adapter = this.getAdapter(source);
    const results = await adapter.searchManga(query);

    const externalIds = results.map((r) => r.externalId);
    const imported = externalIds.length > 0
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
      throw new NotFoundException(`No import source found for manga ${mangaId}`);
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

  async getMangaSources(mangaId: number) {
    return this.db
      .select()
      .from(mangaSources)
      .where(eq(mangaSources.mangaId, mangaId));
  }
}
