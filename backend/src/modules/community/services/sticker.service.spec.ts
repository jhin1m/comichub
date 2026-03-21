import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StickerService } from './sticker.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert',
    'values', 'update', 'set', 'delete'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const setFixture = { id: 1, name: 'Emoji Pack', isActive: true, createdAt: new Date() };
const stickerFixture = { id: 1, stickerSetId: 1, name: 'smile', imageUrl: '/smile.png', order: 0 };

describe('StickerService', () => {
  let service: StickerService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StickerService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<StickerService>(StickerService);
  });

  afterEach(() => { vi.clearAllMocks(); });

  // ─── listSets ─────────────────────────────────────────────────────────

  describe('listSets()', () => {
    it('should return active sticker sets', async () => {
      mockDb.select.mockReturnValue(buildChain([setFixture]));
      const result = await service.listSets();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Emoji Pack');
    });

    it('should return empty array when no active sets', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      const result = await service.listSets();
      expect(result).toEqual([]);
    });
  });

  // ─── getSet ───────────────────────────────────────────────────────────

  describe('getSet()', () => {
    it('should throw NotFoundException when set not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.getSet(999)).rejects.toThrow(NotFoundException);
    });

    it('should return set with its stickers', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([setFixture]);
        return buildChain([stickerFixture]);
      });

      const result = await service.getSet(1);
      expect(result.name).toBe('Emoji Pack');
      expect(result.stickers).toHaveLength(1);
    });
  });

  // ─── createSet ────────────────────────────────────────────────────────

  describe('createSet()', () => {
    it('should create and return a new sticker set', async () => {
      mockDb.insert.mockReturnValue(buildChain([setFixture]));

      const result = await service.createSet({ name: 'Emoji Pack' });
      expect(result.name).toBe('Emoji Pack');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should default isActive to true when not provided', async () => {
      mockDb.insert.mockReturnValue(buildChain([setFixture]));
      await service.createSet({ name: 'Pack' });
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ─── updateSet ────────────────────────────────────────────────────────

  describe('updateSet()', () => {
    it('should throw NotFoundException when set not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.updateSet(999, { name: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('should update name and return updated set', async () => {
      const updated = { ...setFixture, name: 'Updated Pack' };
      mockDb.select.mockReturnValue(buildChain([setFixture]));
      mockDb.update.mockReturnValue(buildChain([updated]));

      const result = await service.updateSet(1, { name: 'Updated Pack' });
      expect(result.name).toBe('Updated Pack');
    });

    it('should update isActive flag', async () => {
      const updated = { ...setFixture, isActive: false };
      mockDb.select.mockReturnValue(buildChain([setFixture]));
      mockDb.update.mockReturnValue(buildChain([updated]));

      const result = await service.updateSet(1, { isActive: false });
      expect(result.isActive).toBe(false);
    });
  });

  // ─── removeSet ────────────────────────────────────────────────────────

  describe('removeSet()', () => {
    it('should throw NotFoundException when set not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.removeSet(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete set when it exists', async () => {
      mockDb.select.mockReturnValue(buildChain([setFixture]));
      mockDb.delete.mockReturnValue(buildChain([]));

      await expect(service.removeSet(1)).resolves.not.toThrow();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  // ─── addSticker ───────────────────────────────────────────────────────

  describe('addSticker()', () => {
    it('should throw NotFoundException when parent set not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(
        service.addSticker(999, { name: 'smile', imageUrl: '/smile.png' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should insert and return new sticker', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([setFixture]); // getSet → set exists
        return buildChain([stickerFixture]);              // getSet → stickers list
      });
      mockDb.insert.mockReturnValue(buildChain([stickerFixture]));

      const result = await service.addSticker(1, { name: 'smile', imageUrl: '/smile.png' });
      expect(result.name).toBe('smile');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ─── removeSticker ────────────────────────────────────────────────────

  describe('removeSticker()', () => {
    it('should throw NotFoundException when sticker not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.removeSticker(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete sticker when it exists', async () => {
      mockDb.select.mockReturnValue(buildChain([stickerFixture]));
      mockDb.delete.mockReturnValue(buildChain([]));

      await expect(service.removeSticker(1)).resolves.not.toThrow();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
