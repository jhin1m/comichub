import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportService } from './report.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  [
    'select',
    'from',
    'where',
    'limit',
    'offset',
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

const reportFixture = {
  id: 1,
  userId: 10,
  chapterId: 1,
  type: 'missing_pages',
  status: 'pending',
};

describe('ReportService', () => {
  let service: ReportService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── submit ────────────────────────────────────────────────────────

  describe('submit()', () => {
    it('should throw NotFoundException when chapter not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(
        service.submit(999, 10, { type: 'missing_pages' as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and return report when chapter exists', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        return buildChain(call === 1 ? [{ id: 1 }] : []);
      });
      mockDb.insert.mockReturnValue(buildChain([reportFixture]));

      const result = await service.submit(1, 10, {
        type: 'missing_pages' as any,
      });
      expect(result).toMatchObject({
        type: 'missing_pages',
        status: 'pending',
      });
    });
  });

  // ─── list ──────────────────────────────────────────────────────────

  describe('list()', () => {
    it('should return reports without status filter', async () => {
      mockDb.select.mockReturnValue(buildChain([reportFixture]));

      const result = await service.list({ page: 1, limit: 20, offset: 0 });
      expect(result).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      mockDb.select.mockReturnValue(buildChain([reportFixture]));

      const result = await service.list(
        { page: 1, limit: 20, offset: 0 },
        'pending' as any,
      );
      expect(result).toBeDefined();
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────

  describe('updateStatus()', () => {
    it('should throw NotFoundException when report not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(
        service.updateStatus(999, { status: 'resolved' as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return report status', async () => {
      const updated = { ...reportFixture, status: 'resolved' };
      mockDb.select.mockReturnValue(buildChain([reportFixture]));
      mockDb.update.mockReturnValue(buildChain([updated]));

      const result = await service.updateStatus(1, {
        status: 'resolved' as any,
      });
      expect(result.status).toBe('resolved');
    });
  });

  // ─── remove ────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when report not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete report when it exists', async () => {
      mockDb.select.mockReturnValue(buildChain([reportFixture]));
      mockDb.delete.mockReturnValue(buildChain([]));

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });
  });
});
