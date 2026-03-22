import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  [
    'select',
    'from',
    'where',
    'limit',
    'orderBy',
    'insert',
    'values',
    'update',
    'set',
    'delete',
  ].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const genreItem = { id: 1, name: 'Action', slug: 'action' };

describe('TaxonomyService', () => {
  let service: TaxonomyService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxonomyService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<TaxonomyService>(TaxonomyService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getTable ──────────────────────────────────────────────────────

  describe('getTable() (via findAll)', () => {
    it('should throw NotFoundException for unknown type', async () => {
      await expect(service.findAll('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should resolve genres table without error', async () => {
      mockDb.select.mockReturnValue(buildChain([genreItem]));
      const result = await service.findAll('genres');
      expect(result).toContainEqual(genreItem);
    });

    it('should resolve artists table', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.findAll('artists')).resolves.not.toThrow();
    });

    it('should resolve authors table', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.findAll('authors')).resolves.not.toThrow();
    });

    it('should resolve groups table', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.findAll('groups')).resolves.not.toThrow();
    });
  });

  // ─── findBySlug ────────────────────────────────────────────────────

  describe('findBySlug()', () => {
    it('should throw NotFoundException when slug not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.findBySlug('genres', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return item when slug found', async () => {
      mockDb.select.mockReturnValue(buildChain([genreItem]));
      const result = await service.findBySlug('genres', 'action');
      expect(result).toMatchObject({ name: 'Action' });
    });
  });

  // ─── create ────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should throw ConflictException when name (slug) already exists', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));
      await expect(
        service.create('genres', { name: 'Action' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create and return new taxonomy item', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        return buildChain(call === 1 ? [] : [genreItem]); // slug check: not taken
      });
      mockDb.insert.mockReturnValue(buildChain([genreItem]));

      const result = await service.create('genres', { name: 'Action' });
      expect(result).toMatchObject({ name: 'Action' });
    });
  });

  // ─── update ────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when item not found for update', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(
        service.update('genres', 999, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return updated item', async () => {
      const updated = {
        ...genreItem,
        name: 'Updated Action',
        slug: 'updated-action',
      };
      mockDb.select.mockReturnValue(buildChain([genreItem]));
      mockDb.update.mockReturnValue(buildChain([updated]));

      const result = await service.update('genres', 1, {
        name: 'Updated Action',
      });
      expect(result.name).toBe('Updated Action');
    });
  });

  // ─── remove ────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.remove('genres', 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete item when found', async () => {
      mockDb.select.mockReturnValue(buildChain([genreItem]));
      mockDb.delete.mockReturnValue(buildChain([]));

      await expect(service.remove('genres', 1)).resolves.not.toThrow();
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });
  });

  // ─── getMangaByTaxonomy ────────────────────────────────────────────

  describe('getMangaByTaxonomy()', () => {
    it('should return empty data set', () => {
      const result = service.getMangaByTaxonomy('genres', 1, 1, 20);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });
});
