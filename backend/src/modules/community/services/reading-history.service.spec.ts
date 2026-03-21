import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReadingHistoryService } from './reading-history.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert', 'values', 'delete'].forEach(
    (m) => { chain[m] = vi.fn().mockReturnValue(chain); },
  );
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.onConflictDoUpdate = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('ReadingHistoryService', () => {
  let service: ReadingHistoryService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: vi.fn(),
      select: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingHistoryService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ReadingHistoryService>(ReadingHistoryService);
  });

  afterEach(() => { vi.clearAllMocks(); });

  // ─── upsert ────────────────────────────────────────────────────────

  describe('upsert()', () => {
    it('should insert and return reading history entry', async () => {
      const entry = {
        id: 1, userId: 10, mangaId: 5, chapterId: 2, lastReadAt: new Date(),
      };
      mockDb.insert.mockReturnValue(buildChain([entry]));

      const result = await service.upsert(10, { mangaId: 5, chapterId: 2 });

      expect(result).toMatchObject({ userId: 10, mangaId: 5 });
      expect(mockDb.insert).toHaveBeenCalledOnce();
    });

    it('should upsert without chapterId (null)', async () => {
      const entry = { id: 2, userId: 10, mangaId: 5, chapterId: null };
      mockDb.insert.mockReturnValue(buildChain([entry]));

      const result = await service.upsert(10, { mangaId: 5 });

      expect(result.chapterId).toBeNull();
    });
  });

  // ─── getHistory ────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('should return empty array when no history', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const result = await service.getHistory(10, { page: 1, limit: 20, offset: 0 });

      expect(result).toEqual([]);
    });

    it('should return paginated history ordered by lastReadAt', async () => {
      const entries = [
        { id: 1, userId: 10, mangaId: 3, lastReadAt: new Date('2024-02-01') },
        { id: 2, userId: 10, mangaId: 5, lastReadAt: new Date('2024-01-01') },
      ];
      mockDb.select.mockReturnValue(buildChain(entries));

      const result = await service.getHistory(10, { page: 1, limit: 20, offset: 0 });

      expect(result).toHaveLength(2);
    });
  });

  // ─── removeEntry ───────────────────────────────────────────────────

  describe('removeEntry()', () => {
    it('should delete the reading history entry without throwing', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      await expect(service.removeEntry(10, 5)).resolves.not.toThrow();
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });
  });
});
