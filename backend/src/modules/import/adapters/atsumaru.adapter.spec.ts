import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AtsumaruAdapter } from './atsumaru.adapter.js';
import { ImportService } from '../services/import.service.js';
import { ImportSource } from '../types/import-source.enum.js';

describe('AtsumaruAdapter', () => {
  let adapter: AtsumaruAdapter;
  let mockImportService: any;

  beforeEach(async () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'import.atsumaru.baseUrl') return 'https://atsu.moe';
        return '';
      }),
    };

    mockImportService = {
      registerAdapter: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtsumaruAdapter,
        { provide: ConfigService, useValue: mockConfig },
        { provide: ImportService, useValue: mockImportService },
      ],
    }).compile();

    adapter = module.get<AtsumaruAdapter>(AtsumaruAdapter);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should register itself with ImportService', () => {
      adapter.onModuleInit();
      expect(mockImportService.registerAdapter).toHaveBeenCalledWith(
        ImportSource.ATSUMARU,
        adapter,
      );
    });
  });

  describe('searchManga', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should POST filteredView and map hits to ExternalManga[]', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            page: 0,
            found: 2,
            hits: [
              { document: { id: 'solo-leveling', title: 'Solo Leveling', tags: [{ name: 'Action' }] } },
              { document: { id: 'one-piece', title: 'One Piece', tags: [] } },
            ],
          }),
      });

      const results = await adapter.searchManga('solo');

      expect(fetch).toHaveBeenCalledWith(
        'https://atsu.moe/api/explore/filteredView',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(results).toHaveLength(2);
      expect(results[0].externalId).toBe('solo-leveling');
      expect(results[0].title).toBe('Solo Leveling');
      expect(results[0].genres).toEqual(['Action']);
    });

    it('should fallback to items[] when hits missing', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 'naruto', title: 'Naruto', tags: [] }],
          }),
      });

      const results = await adapter.searchManga('naruto');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Naruto');
    });
  });

  describe('fetchManga', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should fetch manga detail and normalize fields', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: {
              id: 'tower-of-god',
              title: 'Tower of God',
              poster: 'covers/tower-of-god.jpg',
              synopsis: 'A boy enters the tower',
              status: 'Ongoing',
              type: 'Manwha',
              authors: [{ name: 'SIU' }],
              tags: [{ name: 'Action' }, { name: 'Fantasy' }],
            },
          }),
      });

      const result = await adapter.fetchManga('tower-of-god');

      expect(result.externalId).toBe('tower-of-god');
      expect(result.title).toBe('Tower of God');
      expect(result.coverUrl).toBe('https://atsu.moe/static/covers/tower-of-god.jpg');
      expect(result.description).toBe('A boy enters the tower');
      expect(result.status).toBe('ongoing');
      expect(result.type).toBe('manhwa');
      expect(result.authors).toEqual(['SIU']);
      expect(result.artists).toEqual(['SIU']);
      expect(result.genres).toEqual(['Action', 'Fantasy']);
      expect(result.contentRating).toBe('safe');
    });

    it('should map all statuses correctly', async () => {
      const cases = [
        ['Ongoing', 'ongoing'],
        ['Completed', 'completed'],
        ['Hiatus', 'hiatus'],
        ['Canceled', 'cancelled'],
      ];

      for (const [input, expected] of cases) {
        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              mangaPage: { id: 'test', title: 'T', status: input, tags: [] },
            }),
        });

        const result = await adapter.fetchManga('test');
        expect(result.status).toBe(expected);
      }
    });

    it('should normalize "Manwha" typo to "manhwa"', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: { id: 'test', title: 'T', type: 'Manwha', tags: [] },
          }),
      });

      const result = await adapter.fetchManga('test');
      expect(result.type).toBe('manhwa');
    });

    it('should map OEL type to manga', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: { id: 'test', title: 'T', type: 'OEL', tags: [] },
          }),
      });

      const result = await adapter.fetchManga('test');
      expect(result.type).toBe('manga');
    });
  });

  describe('content rating inference', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should infer erotica from Adult tag', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: { id: 'x', title: 'T', tags: [{ name: 'Adult' }, { name: 'Action' }] },
          }),
      });

      const result = await adapter.fetchManga('x');
      expect(result.contentRating).toBe('erotica');
    });

    it('should infer pornographic from Hentai tag (highest severity)', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: { id: 'x', title: 'T', tags: [{ name: 'Ecchi' }, { name: 'Hentai' }] },
          }),
      });

      const result = await adapter.fetchManga('x');
      expect(result.contentRating).toBe('pornographic');
    });

    it('should infer suggestive from Ecchi tag', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: { id: 'x', title: 'T', tags: [{ name: 'Ecchi' }] },
          }),
      });

      const result = await adapter.fetchManga('x');
      expect(result.contentRating).toBe('suggestive');
    });

    it('should default to safe when no NSFW tags', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mangaPage: { id: 'x', title: 'T', tags: [{ name: 'Comedy' }] },
          }),
      });

      const result = await adapter.fetchManga('x');
      expect(result.contentRating).toBe('safe');
    });
  });

  describe('fetchChapters', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should fetch all chapters with hardcoded en language', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            chapters: [
              { id: 'ch-1', number: 1, title: 'Chapter 1', createdAt: '2025-01-01T00:00:00Z' },
              { id: 'ch-2', number: 2, title: 'Chapter 2', createdAt: 1704067200000 },
            ],
          }),
      });

      const results = await adapter.fetchChapters('solo-leveling');

      expect(results).toHaveLength(2);
      expect(results[0].externalId).toBe('solo-leveling:::ch-1');
      expect(results[0].number).toBe(1);
      expect(results[0].language).toBe('en');
      expect(results[1].externalId).toBe('solo-leveling:::ch-2');
    });

    it('should return empty array for page > 1 (no server-side pagination)', async () => {
      const results = await adapter.fetchChapters('solo-leveling', 'en', 2);
      expect(results).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle chapters with scanlation group', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            chapters: [
              { id: 'ch-1', number: 1, title: 'C1', scanlationMangaId: 'group-abc' },
            ],
          }),
      });

      const results = await adapter.fetchChapters('test-manga');
      expect(results[0].groups).toEqual([
        { externalId: 'group-abc', name: 'group-abc' },
      ]);
    });

    it('should handle missing chapter number as 0', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            chapters: [{ id: 'ch-special', title: 'Special' }],
          }),
      });

      const results = await adapter.fetchChapters('test');
      expect(results[0].number).toBe(0);
    });
  });

  describe('fetchChapterImages', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should split compound ID and fetch images', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            readChapter: {
              pages: [
                { image: 'https://cdn.example.com/page1.webp' },
                { image: 'https://cdn.example.com/page2.webp' },
              ],
            },
          }),
      });

      const results = await adapter.fetchChapterImages('solo-leveling:::ch-1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('mangaId=solo-leveling&chapterId=ch-1'),
        expect.any(Object),
      );
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ url: 'https://cdn.example.com/page1.webp', pageNumber: 1 });
      expect(results[1]).toEqual({ url: 'https://cdn.example.com/page2.webp', pageNumber: 2 });
    });

    it('should throw on missing separator in compound ID', async () => {
      await expect(adapter.fetchChapterImages('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should resolve protocol-relative image URLs', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            readChapter: {
              pages: [{ image: '//cdn.example.com/page.jpg' }],
            },
          }),
      });

      const results = await adapter.fetchChapterImages('manga:::ch-1');
      expect(results[0].url).toBe('https://cdn.example.com/page.jpg');
    });

    it('should resolve relative paths with /static/ prefix', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            readChapter: {
              pages: [{ image: 'uploads/page.jpg' }],
            },
          }),
      });

      const results = await adapter.fetchChapterImages('manga:::ch-1');
      expect(results[0].url).toBe('https://atsu.moe/static/uploads/page.jpg');
    });

    it('should upgrade http to https for absolute URLs', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            readChapter: {
              pages: [{ image: 'http://cdn.example.com/page.jpg' }],
            },
          }),
      });

      const results = await adapter.fetchChapterImages('manga:::ch-1');
      expect(results[0].url).toBe('https://cdn.example.com/page.jpg');
    });
  });

  describe('retry on 403/503', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on 503 and succeed on second attempt', async () => {
      (fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ mangaPage: { id: 'test', title: 'T', tags: [] } }),
        });

      const result = await adapter.fetchManga('test');
      expect(result.title).toBe('T');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after MAX_RETRIES exhausted', async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(adapter.fetchManga('test')).rejects.toThrow(BadRequestException);
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should enforce 500ms minimum interval between requests', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mangaPage: { id: 'x', title: 'T', tags: [] } }),
      });

      const start = Date.now();
      await adapter.fetchManga('a');
      await adapter.fetchManga('b');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(400);
    }, 10000);
  });
});
