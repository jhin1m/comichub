import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReadingHistoryService } from './reading-history.service.js';
import { HistoryService } from '../../user/services/history.service.js';

describe('ReadingHistoryService (community delegate)', () => {
  let service: ReadingHistoryService;
  let mockHistoryService: any;

  beforeEach(async () => {
    mockHistoryService = {
      upsert: vi.fn().mockResolvedValue({ message: 'History updated' }),
      getHistory: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      removeEntry: vi
        .fn()
        .mockResolvedValue({ message: 'History entry removed' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingHistoryService,
        { provide: HistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<ReadingHistoryService>(ReadingHistoryService);
  });

  describe('upsert()', () => {
    it('should delegate to historyService.upsert', async () => {
      const dto = { mangaId: 1, chapterId: 5 };
      await service.upsert(10, dto);
      expect(mockHistoryService.upsert).toHaveBeenCalledWith(10, {
        mangaId: 1,
        chapterId: 5,
      });
    });

    it('should handle missing chapterId', async () => {
      await service.upsert(10, { mangaId: 1 });
      expect(mockHistoryService.upsert).toHaveBeenCalledWith(10, {
        mangaId: 1,
        chapterId: undefined,
      });
    });
  });

  describe('getHistory()', () => {
    it('should delegate to historyService.getHistory', async () => {
      const pagination = { page: 1, limit: 20, offset: 0 };
      const result = await service.getHistory(10, pagination);
      expect(mockHistoryService.getHistory).toHaveBeenCalledWith(
        10,
        pagination,
      );
      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });
  });

  describe('removeEntry()', () => {
    it('should delegate to historyService.removeEntry', async () => {
      await service.removeEntry(10, 1);
      expect(mockHistoryService.removeEntry).toHaveBeenCalledWith(10, 1);
    });
  });
});
