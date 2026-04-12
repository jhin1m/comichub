import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheInvalidationJob } from './cache-invalidation.job.js';

describe('CacheInvalidationJob', () => {
  let job: CacheInvalidationJob;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      scan: vi.fn(),
      del: vi.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationJob,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    job = module.get<CacheInvalidationJob>(CacheInvalidationJob);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onChapterCreated()', () => {
    it('should scan and delete manga + ranking caches', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await expect(
        job.onChapterCreated({
          mangaId: 1,
          chapterId: 5,
          mangaTitle: 'Test',
          chapterNumber: '1',
        }),
      ).resolves.not.toThrow();

      // Called twice: once for manga pattern, once for rankings pattern
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });

    it('should delete matched keys when scan returns them', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['cache:/api/v1/manga?page=1']]) // first pattern
        .mockResolvedValueOnce(['0', ['cache:/api/v1/rankings?sort=day']]); // second pattern

      await job.onChapterCreated({
        mangaId: 1,
        chapterId: 5,
        mangaTitle: 'T',
        chapterNumber: '1',
      });

      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('onMangaUpdated()', () => {
    it('should delete both new-format and legacy cache keys', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await expect(
        job.onMangaUpdated({ id: 1, slug: 'one-piece' }),
      ).resolves.not.toThrow();

      // new shortId-slug format: encodeId(1) = '1'
      expect(mockRedis.del).toHaveBeenCalledWith(
        'cache:/api/v1/manga/1-one-piece',
      );
      // legacy slug-only format
      expect(mockRedis.del).toHaveBeenCalledWith(
        'cache:/api/v1/manga/one-piece',
      );
    });

    it('should also invalidate manga list cache', async () => {
      mockRedis.scan.mockResolvedValueOnce([
        '0',
        ['cache:/api/v1/manga?page=1'],
      ]);

      await job.onMangaUpdated({ id: 2, slug: 'naruto' });

      // del called for both keys + once inside deleteByPattern for list key
      expect(mockRedis.del.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
