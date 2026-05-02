import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { ChapterService } from './chapter.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import { REDIS_AVAILABLE } from '../../../common/providers/redis.provider.js';

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
    'innerJoin',
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
  let mirrorQueue: { add: ReturnType<typeof vi.fn> };
  let redisStatus: { available: boolean };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      $count: vi.fn().mockResolvedValue(1),
    };
    mirrorQueue = { add: vi.fn().mockResolvedValue({ id: 'mock' }) };
    redisStatus = { available: true };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChapterService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
        { provide: getQueueToken('mirror'), useValue: mirrorQueue },
        { provide: REDIS_AVAILABLE, useValue: redisStatus },
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
        if (callCount === 1)
          return buildChain([{ chapter, mangaTitle: 'Test Manga' }]);
        return buildChain(images);
      });

      const result = await service.findOne(1);
      expect(result).toMatchObject({
        id: 1,
        number: '1',
        mangaTitle: 'Test Manga',
      });
      expect(result.images).toEqual(images);
    });

    it('should enqueue mirror job when images need mirroring', async () => {
      const chapter = { id: 1, mangaId: 1, number: '1', slug: 'chapter-1' };
      const images = [
        {
          id: 1,
          chapterId: 1,
          imageUrl: 'https://source.example/page1.jpg',
          sourceUrl: 'https://source.example/page1.jpg',
          order: 1,
        },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return buildChain([{ chapter, mangaTitle: 'M' }]);
        return buildChain(images);
      });

      await service.findOne(1);

      expect(mirrorQueue.add).toHaveBeenCalledOnce();
      expect(mirrorQueue.add).toHaveBeenCalledWith(
        'mirror-chapter',
        { chapterId: 1 },
        { jobId: 'chapter:1' },
      );
    });

    it('should NOT enqueue when all images already mirrored', async () => {
      const chapter = { id: 1, mangaId: 1, number: '1', slug: 'chapter-1' };
      const images = [
        {
          id: 1,
          chapterId: 1,
          imageUrl: 'https://cdn.example/page1.webp',
          sourceUrl: 'https://source.example/page1.jpg',
          order: 1,
        },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return buildChain([{ chapter, mangaTitle: 'M' }]);
        return buildChain(images);
      });

      await service.findOne(1);

      expect(mirrorQueue.add).not.toHaveBeenCalled();
    });

    it('should NOT enqueue when Redis is unavailable', async () => {
      redisStatus.available = false;
      const chapter = { id: 1, mangaId: 1, number: '1', slug: 'chapter-1' };
      const images = [
        {
          id: 1,
          chapterId: 1,
          imageUrl: 'https://source.example/page1.jpg',
          sourceUrl: 'https://source.example/page1.jpg',
          order: 1,
        },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return buildChain([{ chapter, mangaTitle: 'M' }]);
        return buildChain(images);
      });

      await service.findOne(1);

      expect(mirrorQueue.add).not.toHaveBeenCalled();
    });

    it('should not propagate enqueue failures', async () => {
      mirrorQueue.add.mockRejectedValueOnce(new Error('redis flap'));
      const chapter = { id: 1, mangaId: 1, number: '1', slug: 'chapter-1' };
      const images = [
        {
          id: 1,
          chapterId: 1,
          imageUrl: 'https://source.example/page1.jpg',
          sourceUrl: 'https://source.example/page1.jpg',
          order: 1,
        },
      ];

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return buildChain([{ chapter, mangaTitle: 'M' }]);
        return buildChain(images);
      });

      const result = await service.findOne(1);

      expect(result).toMatchObject({ id: 1 });
      expect(mirrorQueue.add).toHaveBeenCalledOnce();
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

    it('should soft-delete chapter and update chaptersCount', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1, mangaId: 1 }]));
      mockDb.update.mockReturnValue(buildChain([]));
      mockDb.$count = vi.fn().mockReturnValue(0);

      await expect(service.remove(1)).resolves.not.toThrow();
      // Called twice: soft-delete chapter + update manga chaptersCount
      expect(mockDb.update).toHaveBeenCalledTimes(2);
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
        if (selectCall === 1)
          return buildChain([{ chapter, mangaTitle: 'Test Manga' }]); // findOne → chapter+manga join
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
