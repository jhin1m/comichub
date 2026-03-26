import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ImportMappingService } from './import-mapping.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import { ImportSource } from '../types/import-source.enum.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'insert',
    'values',
    'delete',
    'update',
    'set',
    'returning',
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.onConflictDoNothing = vi.fn().mockReturnValue(chain);
  chain.onConflictDoUpdate = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('ImportMappingService', () => {
  let service: ImportMappingService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockDb)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportMappingService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ImportMappingService>(ImportMappingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveByName', () => {
    it('should find existing record by slug', async () => {
      const mockTable = { id: 'id', slug: 'slug' };

      // Batch lookup: returns existing record with slug
      mockDb.select.mockReturnValue(buildChain([{ id: 1, slug: 'action' }]));

      const result = await service['resolveByName'](mockTable as any, ['Action']);

      expect(result).toContain(1);
    });

    it('should create new record when not found', async () => {
      const mockTable = { id: 'id', slug: 'slug' };

      // Batch lookup returns empty (none found)
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 2 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service['resolveByName'](mockTable as any, ['NewGenre']);

      expect(result).toContain(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle multiple names', async () => {
      const mockTable = { id: 'id', slug: 'slug' };

      // Batch lookup: 'action' found, 'comedy' not found
      mockDb.select.mockReturnValue(buildChain([{ id: 1, slug: 'action' }]));

      const insertChain = buildChain([{ id: 2 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service['resolveByName'](mockTable as any, ['Action', 'Comedy']);

      expect(result).toContain(1);
      expect(result).toContain(2);
    });
  });

  describe('resolveGenres', () => {
    it('should find existing genre by slug', async () => {
      // Batch lookup returns existing genre with slug
      mockDb.select.mockReturnValue(buildChain([{ id: 1, slug: 'action' }]));

      const result = await service.resolveGenres(['Action']);

      expect(result).toContain(1);
    });

    it('should create new genre when not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 2 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service.resolveGenres(['Action']);

      expect(result).toContain(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle onConflictDoNothing for concurrent inserts', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([]); // No result on conflict
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service.resolveGenres(['Action']);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should pass group parameter to insert', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 2 }]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.resolveGenres(['Action', 'School'], 'custom_group');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle empty genres array', async () => {
      const result = await service.resolveGenres([]);

      expect(result).toEqual([]);
    });
  });

  describe('syncPivots', () => {
    it('should delete existing pivots', async () => {
      const deleteChain = buildChain([]);
      mockDb.delete.mockReturnValue(deleteChain);
      mockDb.insert.mockReturnValue(buildChain([]));

      await service.syncPivots(1, [1, 2], [3, 4], [5, 6]);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should insert new genre pivots', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.syncPivots(1, [1, 2], [], []);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should insert new artist pivots', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.syncPivots(1, [], [3, 4], []);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should insert new author pivots', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.syncPivots(1, [], [], [5, 6]);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should insert all pivots simultaneously', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.syncPivots(1, [1], [2], [3]);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle empty pivot arrays', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      await service.syncPivots(1, [], [], []);

      // Only delete called, no insert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('upsertLinks', () => {
    it('should insert link with onConflictDoUpdate', async () => {
      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.upsertLinks(1, [
        { type: 'mal', externalId: 'mal-123' },
      ]);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle multiple links', async () => {
      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.upsertLinks(1, [
        { type: 'mal', externalId: 'mal-123' },
        { type: 'anilist', externalId: 'al-456', url: 'https://anilist.co/manga/456' },
      ]);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should handle empty links array', async () => {
      await service.upsertLinks(1, []);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should upsert links with both externalId and url', async () => {
      const insertChain = buildChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      await service.upsertLinks(1, [
        { type: 'custom', externalId: 'id-123', url: 'https://example.com' },
      ]);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('upsertManga', () => {
    it('should create new manga when no existing source record', async () => {
      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        // First call: source record lookup → not found
        if (selectCall === 1) return buildChain([]);
        // Slug conflict check → not found
        if (selectCall === 2) return buildChain([]);
        return buildChain([]);
      });

      const insertChain = buildChain([{ id: 1, slug: 'new-manga' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.upsertManga(
        {
          externalId: '123',
          title: 'New Manga',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(result.created).toBe(true);
      expect(result.mangaId).toBe(1);
    });

    it('should update existing manga when source record found', async () => {
      mockDb.select.mockReturnValue(
        buildChain([{ mangaId: 1 }]),
      );

      const updateChain = buildChain([{ slug: 'existing-manga' }]);
      mockDb.update.mockReturnValue(updateChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.upsertManga(
        {
          externalId: '123',
          title: 'Updated Manga',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(result.created).toBe(false);
      expect(result.mangaId).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should create manga_sources record on new import', async () => {
      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([]); // No existing
        if (selectCall === 2) return buildChain([]); // No slug conflict
        return buildChain([]);
      });

      const insertChain = buildChain([{ id: 1, slug: 'manga' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      await service.upsertManga(
        {
          externalId: '123',
          title: 'Manga',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should sync genre/artist/author pivots', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 1, slug: 'manga' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      await service.upsertManga(
        {
          externalId: '123',
          title: 'Manga',
          genres: ['Action'],
          themes: ['School'],
          authors: ['Author A'],
          artists: ['Artist B'],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should generate slug from title', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 1, slug: 'my-test-manga' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.upsertManga(
        {
          externalId: '123',
          title: 'My Test Manga',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(result.slug).toBeTruthy();
    });

    it('should handle slug conflicts by appending timestamp suffix', async () => {
      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([]); // No existing source
        if (selectCall === 2) return buildChain([{ id: 999 }]); // Slug conflict
        return buildChain([]);
      });

      const insertChain = buildChain([{ id: 1, slug: 'conflicting-manga-1234567890' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      await service.upsertManga(
        {
          externalId: '123',
          title: 'Conflicting Manga',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle empty genres/authors/artists arrays', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 1, slug: 'manga' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.upsertManga(
        {
          externalId: '123',
          title: 'Manga',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(result.mangaId).toBe(1);
    });

    it('should map contentRating to fields', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const insertChain = buildChain([{ id: 1, slug: 'manga' }]);
      mockDb.insert.mockReturnValue(insertChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      await service.upsertManga(
        {
          externalId: '123',
          title: 'Manga',
          contentRating: 'erotica',
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should preserve optional fields in update', async () => {
      mockDb.select.mockReturnValue(
        buildChain([{ mangaId: 1 }]),
      );

      const updateChain = buildChain([{ slug: 'manga' }]);
      mockDb.update.mockReturnValue(updateChain);

      mockDb.delete.mockReturnValue(buildChain([]));

      await service.upsertManga(
        {
          externalId: '123',
          title: 'Manga',
          nativeTitle: 'Native',
          romanizedTitle: 'Romanized',
          altTitles: ['Alt1', 'Alt2'],
          description: 'Description',
          coverUrl: 'https://example.com/cover.jpg',
          originalLanguage: 'ja',
          status: 'completed',
          type: 'manhwa',
          contentRating: 'safe',
          demographic: 'seinen',
          year: 2020,
          genres: [],
          themes: [],
          authors: [],
          artists: [],
          links: [],
        },
        ImportSource.MANGABAKA,
      );

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
