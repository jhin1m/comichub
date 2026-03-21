import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert',
    'values', 'update', 'set', 'delete', 'innerJoin', 'leftJoin'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('HistoryService', () => {
  let service: HistoryService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        readingHistory: { findFirst: vi.fn() },
      },
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  afterEach(() => { vi.clearAllMocks(); });

  // ─── upsert ───────────────────────────────────────────────────────────

  describe('upsert()', () => {
    it('should insert new history entry when none exists', async () => {
      mockDb.query.readingHistory.findFirst.mockResolvedValue(null);
      mockDb.insert.mockReturnValue(buildChain([]));

      const result = await service.upsert(10, { mangaId: 1, chapterId: 5 });
      expect(result.message).toBe('History updated');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update existing history entry', async () => {
      const existing = { id: 1, userId: 10, mangaId: 1, chapterId: 3 };
      mockDb.query.readingHistory.findFirst.mockResolvedValue(existing);
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.upsert(10, { mangaId: 1, chapterId: 5 });
      expect(result.message).toBe('History updated');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should preserve existing chapterId when dto.chapterId is null', async () => {
      const existing = { id: 1, userId: 10, mangaId: 1, chapterId: 3 };
      mockDb.query.readingHistory.findFirst.mockResolvedValue(existing);
      mockDb.update.mockReturnValue(buildChain([]));

      await service.upsert(10, { mangaId: 1 });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ─── getHistory ───────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('should return paginated history', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([{ cnt: 2 }]);
        return buildChain([{ id: 1, mangaId: 1, manga: { id: 1, title: 'Test' } }]);
      });

      const result = await service.getHistory(10, { page: 1, limit: 20, offset: 0 } as any);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should return empty list when no history', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([{ cnt: 0 }]);
        return buildChain([]);
      });

      const result = await service.getHistory(10, { page: 1, limit: 20, offset: 0 } as any);
      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  // ─── removeEntry ──────────────────────────────────────────────────────

  describe('removeEntry()', () => {
    it('should delete the history entry and return message', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.removeEntry(10, 1);
      expect(result.message).toBe('History entry removed');
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  // ─── clearAll ─────────────────────────────────────────────────────────

  describe('clearAll()', () => {
    it('should delete all history entries for user', async () => {
      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.clearAll(10);
      expect(result.message).toBe('History cleared');
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
