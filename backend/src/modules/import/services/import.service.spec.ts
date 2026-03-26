import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImportService } from './import.service.js';
import { ImportMappingService } from './import-mapping.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import { ImportSource } from '../types/import-source.enum.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  const methods = ['select', 'from', 'where', 'limit', 'offset'];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('ImportService', () => {
  let service: ImportService;
  let mockDb: any;
  let mockMappingService: any;
  let mockMangaBakaAdapter: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
    };

    mockMappingService = {
      upsertManga: vi.fn(),
    };

    mockMangaBakaAdapter = {
      source: ImportSource.MANGABAKA,
      fetchManga: vi.fn(),
      searchManga: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ImportMappingService, useValue: mockMappingService },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);

    // Register adapters
    service.registerAdapter(ImportSource.MANGABAKA, mockMangaBakaAdapter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAdapter', () => {
    it('should register adapter for source', () => {
      const adapter = {
        source: ImportSource.WEEBDEX,
        fetchManga: vi.fn(),
        searchManga: vi.fn(),
      };

      service.registerAdapter(ImportSource.WEEBDEX, adapter);

      // Verify by attempting to use it
      expect(() => {
        // This would throw if adapter not found
        service['getAdapter'](ImportSource.WEEBDEX);
      }).not.toThrow();
    });
  });

  describe('importManga', () => {
    it('should call correct adapter based on source', async () => {
      const externalManga = {
        externalId: '123',
        title: 'Test Manga',
        status: 'ongoing' as const,
        type: 'manga' as const,
        genres: [],
        themes: [],
        authors: [],
        artists: [],
        links: [],
      };

      mockMangaBakaAdapter.fetchManga.mockResolvedValueOnce(externalManga);
      mockMappingService.upsertManga.mockResolvedValueOnce({
        mangaId: 1,
        slug: 'test-manga',
        created: true,
      });

      await service.importManga(ImportSource.MANGABAKA, '123');

      expect(mockMangaBakaAdapter.fetchManga).toHaveBeenCalledWith('123');
    });

    it('should throw if adapter not found for source', async () => {
      await expect(
        service.importManga(ImportSource.WEEBDEX, '123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call mappingService.upsertManga with fetched external data', async () => {
      const externalManga = {
        externalId: '123',
        title: 'Test Manga',
        status: 'ongoing' as const,
        type: 'manga' as const,
        genres: ['Action'],
        themes: ['School'],
        authors: ['Author A'],
        artists: ['Artist B'],
        links: [],
      };

      mockMangaBakaAdapter.fetchManga.mockResolvedValueOnce(externalManga);
      mockMappingService.upsertManga.mockResolvedValueOnce({
        mangaId: 1,
        slug: 'test-manga',
        created: true,
      });

      await service.importManga(ImportSource.MANGABAKA, '123');

      expect(mockMappingService.upsertManga).toHaveBeenCalledWith(
        externalManga,
        ImportSource.MANGABAKA,
      );
    });

    it('should return import result from mapping service', async () => {
      const externalManga = {
        externalId: '123',
        title: 'Test Manga',
        status: 'ongoing' as const,
        type: 'manga' as const,
        genres: [],
        themes: [],
        authors: [],
        artists: [],
        links: [],
      };

      const importResult = { mangaId: 1, slug: 'test-manga', created: true };

      mockMangaBakaAdapter.fetchManga.mockResolvedValueOnce(externalManga);
      mockMappingService.upsertManga.mockResolvedValueOnce(importResult);

      const result = await service.importManga(ImportSource.MANGABAKA, '123');

      expect(result).toEqual(importResult);
    });

    it('should throw on adapter fetch error', async () => {
      mockMangaBakaAdapter.fetchManga.mockRejectedValueOnce(new Error('Fetch failed'));

      await expect(
        service.importManga(ImportSource.MANGABAKA, '123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rethrow BadRequestException from adapter', async () => {
      mockMangaBakaAdapter.fetchManga.mockRejectedValueOnce(
        new BadRequestException('API error'),
      );

      await expect(
        service.importManga(ImportSource.MANGABAKA, '123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('searchManga', () => {
    it('should return search results from adapter', async () => {
      const results = [
        {
          externalId: '1',
          title: 'Result 1',
          status: 'ongoing' as const,
          type: 'manga' as const,
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        {
          externalId: '2',
          title: 'Result 2',
          status: 'completed' as const,
          type: 'manga' as const,
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
      ];

      mockMangaBakaAdapter.searchManga.mockResolvedValueOnce(results);
      mockDb.select.mockReturnValue(buildChain([]));

      const searchResults = await service.searchManga(ImportSource.MANGABAKA, 'test');

      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].title).toBe('Result 1');
      expect(searchResults[1].title).toBe('Result 2');
    });

    it('should mark search results as alreadyImported when source record exists', async () => {
      const results = [
        {
          externalId: '1',
          title: 'Result 1',
          status: 'ongoing' as const,
          type: 'manga' as const,
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
      ];

      mockMangaBakaAdapter.searchManga.mockResolvedValueOnce(results);
      mockDb.select.mockReturnValue(
        buildChain([{ externalId: '1', mangaId: 42 }]),
      );

      const searchResults = await service.searchManga(ImportSource.MANGABAKA, 'test');

      expect(searchResults[0].alreadyImported).toBe(true);
      expect(searchResults[0].internalId).toBe(42);
    });

    it('should mark search results as not imported when no source record', async () => {
      const results = [
        {
          externalId: '1',
          title: 'Result 1',
          status: 'ongoing' as const,
          type: 'manga' as const,
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
      ];

      mockMangaBakaAdapter.searchManga.mockResolvedValueOnce(results);
      mockDb.select.mockReturnValue(buildChain([]));

      const searchResults = await service.searchManga(ImportSource.MANGABAKA, 'test');

      expect(searchResults[0].alreadyImported).toBe(false);
      expect(searchResults[0].internalId).toBeUndefined();
    });

    it('should handle empty search results', async () => {
      mockMangaBakaAdapter.searchManga.mockResolvedValueOnce([]);
      mockDb.select.mockReturnValue(buildChain([]));

      const searchResults = await service.searchManga(ImportSource.MANGABAKA, 'nonexistent');

      expect(searchResults).toEqual([]);
    });
  });

  describe('syncManga', () => {
    it('should lookup manga_sources and call adapter with externalId', async () => {
      const externalManga = {
        externalId: '123',
        title: 'Updated Manga',
        status: 'ongoing' as const,
        type: 'manga' as const,
        genres: [],
        themes: [],
        authors: [],
        artists: [],
        links: [],
      };

      mockDb.select.mockReturnValue(
        buildChain([
          {
            mangaId: 42,
            source: ImportSource.MANGABAKA,
            externalId: '123',
          },
        ]),
      );
      mockMangaBakaAdapter.fetchManga.mockResolvedValueOnce(externalManga);
      mockMappingService.upsertManga.mockResolvedValueOnce({
        mangaId: 42,
        slug: 'updated-manga',
        created: false,
      });

      await service.syncManga(42);

      expect(mockMangaBakaAdapter.fetchManga).toHaveBeenCalledWith('123');
    });

    it('should throw NotFoundException when no source record found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.syncManga(999)).rejects.toThrow(NotFoundException);
    });

    it('should call mappingService.upsertManga with fetched data', async () => {
      const externalManga = {
        externalId: '123',
        title: 'Updated Manga',
        status: 'ongoing' as const,
        type: 'manga' as const,
        genres: [],
        themes: [],
        authors: [],
        artists: [],
        links: [],
      };

      mockDb.select.mockReturnValue(
        buildChain([
          {
            mangaId: 42,
            source: ImportSource.MANGABAKA,
            externalId: '123',
          },
        ]),
      );
      mockMangaBakaAdapter.fetchManga.mockResolvedValueOnce(externalManga);
      mockMappingService.upsertManga.mockResolvedValueOnce({
        mangaId: 42,
        slug: 'updated-manga',
        created: false,
      });

      await service.syncManga(42);

      expect(mockMappingService.upsertManga).toHaveBeenCalledWith(
        externalManga,
        ImportSource.MANGABAKA,
      );
    });

    it('should throw on adapter fetch error', async () => {
      mockDb.select.mockReturnValue(
        buildChain([
          {
            mangaId: 42,
            source: ImportSource.MANGABAKA,
            externalId: '123',
          },
        ]),
      );
      mockMangaBakaAdapter.fetchManga.mockRejectedValueOnce(new Error('API error'));

      await expect(service.syncManga(42)).rejects.toThrow(BadRequestException);
    });

    it('should rethrow NotFoundException from adapter', async () => {
      mockDb.select.mockReturnValue(
        buildChain([
          {
            mangaId: 42,
            source: ImportSource.MANGABAKA,
            externalId: '999',
          },
        ]),
      );
      mockMangaBakaAdapter.fetchManga.mockRejectedValueOnce(
        new NotFoundException('Not found'),
      );

      await expect(service.syncManga(42)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMangaSources', () => {
    it('should return manga sources for given manga ID', async () => {
      const sources = [
        {
          mangaId: 1,
          source: ImportSource.MANGABAKA,
          externalId: '123',
          lastSyncedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValue(buildChain(sources));

      const result = await service.getMangaSources(1);

      expect(result).toEqual(sources);
    });

    it('should return empty array when no sources found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const result = await service.getMangaSources(999);

      expect(result).toEqual([]);
    });
  });
});
