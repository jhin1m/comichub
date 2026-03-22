import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MangaService } from './manga.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

/** Build a chainable Drizzle mock that resolves to `resolvedValue` at the end. */
function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'leftJoin',
    'innerJoin',
    'set',
    'update',
    'insert',
    'values',
    'delete',
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  // Make the chain itself thenable so `await chain.from(...)` works
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('MangaService', () => {
  let service: MangaService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      $count: vi.fn().mockResolvedValue(0),
      transaction: vi.fn().mockImplementation(async (fn: any) => {
        // Pass mockDb as the transaction context so inner calls work
        return fn(mockDb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MangaService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<MangaService>(MangaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return paginated list without filters', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1, title: 'Naruto' }]));
      mockDb.$count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
      } as any);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty list when no manga matches', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      mockDb.$count.mockResolvedValue(0);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
      } as any);
      expect(result.total).toBe(0);
    });

    it('should filter by status', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      mockDb.$count.mockResolvedValue(0);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
        status: 'ongoing',
      } as any);
      expect(result.data).toEqual([]);
    });

    it('should early-return empty when genre slug not found', async () => {
      mockDb.select.mockReturnValue(buildChain([])); // genre lookup returns nothing

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
        genre: 'action',
      } as any);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should filter by genre when genre found but no manga with that genre', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([{ id: 5 }]); // genre row found
        if (call === 2) return buildChain([]); // no manga IDs with genre → early return
        return buildChain([]);
      });

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
        genre: 'action',
      } as any);
      expect(result.data).toEqual([]);
    });

    it('should early-return empty when artist has no manga', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
        artist: 1,
      } as any);
      expect(result.data).toEqual([]);
    });

    it('should early-return empty when author has no manga', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const result = await service.findAll({
        page: 1,
        limit: 20,
        offset: 0,
        author: 1,
      } as any);
      expect(result.data).toEqual([]);
    });

    it('should sort by views ascending', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.findAll({
          page: 1,
          limit: 20,
          offset: 0,
          sort: 'views',
          order: 'asc',
        } as any),
      ).resolves.not.toThrow();
    });

    it('should sort by createdAt descending', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.findAll({
          page: 1,
          limit: 20,
          offset: 0,
          sort: 'created_at',
        } as any),
      ).resolves.not.toThrow();
    });
  });

  // ─── findBySlug ────────────────────────────────────────────────────

  describe('findBySlug()', () => {
    it('should throw NotFoundException when manga not found', async () => {
      // First select returns empty array (manga not found)
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.findBySlug('nonexistent-slug')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return manga with relations when found', async () => {
      const mangaRow = {
        id: 1,
        title: 'One Piece',
        slug: 'one-piece',
        deletedAt: null,
      };
      // First call: find manga; subsequent calls: relations
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return buildChain([mangaRow]);
        return buildChain([]); // genres, artists, authors, groups, chapters
      });

      const result = await service.findBySlug('one-piece');

      expect(result).toMatchObject({ id: 1, title: 'One Piece' });
      expect(result.genres).toEqual([]);
    });
  });

  // ─── create ────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should throw ConflictException when slug already exists', async () => {
      // Slug uniqueness check returns existing row
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));

      await expect(
        service.create({
          title: 'One Piece',
          status: 'ongoing' as any,
          type: 'manga' as any,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create manga and return detail when slug is unique', async () => {
      const created = { id: 2, slug: 'new-manga', title: 'New Manga' };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        // 1st: slug check (empty = not taken)
        if (selectCall === 1) return buildChain([]);
        // 2nd: findBySlug → manga row
        if (selectCall === 2)
          return buildChain([{ ...created, deletedAt: null }]);
        return buildChain([]); // relations
      });

      const insertChain = buildChain([created]);
      mockDb.insert.mockReturnValue(insertChain);
      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.create({
        title: 'New Manga',
        status: 'ongoing' as any,
        type: 'manga' as any,
      });

      expect(result).toMatchObject({ id: 2, title: 'New Manga' });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when manga does not exist', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete manga when it exists', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));

      const updateChain = buildChain([]);
      mockDb.update.mockReturnValue(updateChain);

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  // ─── update ────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when manga not found for update', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.update(999, { title: 'New Title' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update manga and return detail', async () => {
      const existing = { id: 1, slug: 'old-slug' };
      const updated = { id: 1, slug: 'old-slug', title: 'New Title' };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([existing]); // existence check
        if (selectCall === 2)
          return buildChain([{ ...updated, deletedAt: null }]); // findBySlug
        return buildChain([]); // relations
      });

      mockDb.update.mockReturnValue(buildChain([updated]));
      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.update(1, { title: 'New Title' });
      expect(result).toMatchObject({ id: 1 });
    });

    it('should sync genreIds pivot on update', async () => {
      const existing = { id: 1, slug: 'manga-slug' };
      const updated = { id: 1, slug: 'manga-slug' };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([existing]);
        if (selectCall === 2)
          return buildChain([{ ...updated, deletedAt: null }]);
        return buildChain([]);
      });

      mockDb.update.mockReturnValue(buildChain([updated]));
      mockDb.delete.mockReturnValue(buildChain([]));
      mockDb.insert.mockReturnValue(buildChain([]));

      await service.update(1, { genreIds: [1, 2] });
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
