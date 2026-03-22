import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChapterService } from './chapter.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
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
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('ChapterService', () => {
  let service: ChapterService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      $count: vi.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChapterService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
      ],
    }).compile();

    service = module.get<ChapterService>(ChapterService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── findByManga ───────────────────────────────────────────────────

  describe('findByManga()', () => {
    it('should return empty array when no chapters exist', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const result = await service.findByManga(1);
      expect(result).toEqual([]);
    });

    it('should return chapter list for a manga', async () => {
      const chapters = [
        {
          id: 1,
          number: '1',
          title: 'Ch 1',
          slug: 'chapter-1',
          viewCount: 0,
          order: 10,
        },
      ];
      mockDb.select.mockReturnValue(buildChain(chapters));

      const result = await service.findByManga(1);
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe('1');
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should throw NotFoundException when chapter not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should return chapter with images when found', async () => {
      const chapter = {
        id: 1,
        mangaId: 1,
        number: '1',
        slug: 'chapter-1',
        deletedAt: null,
      };
      const images = [
        { id: 1, chapterId: 1, url: 'https://example.com/page1.jpg', order: 1 },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return buildChain([chapter]);
        return buildChain(images);
      });

      const result = await service.findOne(1);
      expect(result).toMatchObject({ id: 1, number: '1' });
      expect(result.images).toEqual(images);
    });
  });

  // ─── create ────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should throw NotFoundException when manga does not exist', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(
        service.create(999, { number: 1, title: 'Ch 1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when chapter number already exists', async () => {
      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        // manga exists, chapter slug already taken
        return buildChain(selectCall === 1 ? [{ id: 1 }] : [{ id: 99 }]);
      });

      await expect(
        service.create(1, { number: 1, title: 'Duplicate Chapter' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create chapter when manga exists and slug is free', async () => {
      const created = {
        id: 5,
        mangaId: 1,
        number: '2',
        slug: 'chapter-2',
        order: 20,
      };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([{ id: 1 }]); // manga exists
        return buildChain([]); // slug not taken
      });

      mockDb.insert.mockReturnValue(buildChain([created]));
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.create(1, { number: 2, title: 'Chapter 2' });
      expect(result).toMatchObject({ id: 5, number: '2' });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when chapter not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete chapter when it exists', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1, mangaId: 1 }]));
      mockDb.update.mockReturnValue(buildChain([]));

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  // ─── update ────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when chapter not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.update(999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update chapter title and return result', async () => {
      const chapter = {
        id: 1,
        mangaId: 1,
        number: '1',
        slug: 'chapter-1',
        deletedAt: null,
      };
      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([chapter]); // findOne → chapter
        return buildChain([]); // findOne → images
      });
      mockDb.update.mockReturnValue(
        buildChain([{ ...chapter, title: 'Updated' }]),
      );

      const result = await service.update(1, { title: 'Updated' });
      expect(result).toMatchObject({ id: 1 });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ─── getNavigation ─────────────────────────────────────────────────

  describe('getNavigation()', () => {
    it('should throw NotFoundException when chapter not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.getNavigation(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return null prev/next for a standalone chapter', async () => {
      const chapter = { id: 1, mangaId: 1, order: 10 };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([chapter]); // current chapter
        return buildChain([]); // no prev, no next
      });

      const result = await service.getNavigation(1);
      expect(result.prev).toBeNull();
      expect(result.next).toBeNull();
    });
  });
});
