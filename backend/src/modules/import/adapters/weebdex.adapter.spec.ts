import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeebDexAdapter } from './weebdex.adapter.js';
import { ImportService } from '../services/import.service.js';

describe('WeebDexAdapter', () => {
  let adapter: WeebDexAdapter;
  let mockConfig: any;
  let mockImportService: any;

  beforeEach(async () => {
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'import.weebdex.baseUrl') return 'https://api.weebdex.org';
        return '';
      }),
    };

    mockImportService = {
      registerAdapter: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeebDexAdapter,
        { provide: ConfigService, useValue: mockConfig },
        { provide: ImportService, useValue: mockImportService },
      ],
    }).compile();

    adapter = module.get<WeebDexAdapter>(WeebDexAdapter);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('normalization', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should extract title preferring English, fallback to first available', async () => {
      const raw = {
        id: 'manga-123',
        title: 'English Title',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.title).toBe('English Title');
    });

    it('should fallback to first available title when en missing', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Japanese Title',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.title).toBeTruthy();
    });

    it('should extract nativeTitle from ja/ko/zh keys', async () => {
      const raw = {
        id: 'manga-123',
        title: 'English',
        alt_titles: {
          ja: ['Japanese Title'],
          en: ['English'],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.nativeTitle).toBe('Japanese Title');
    });

    it('should flatten altTitles from array of Record objects', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Main Title',
        alt_titles: {
          en: ['Alt Title 1'],
          ja: ['Alt Title 1 JP'],
          ko: ['Alt Title 2'],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.altTitles).toContain('Alt Title 1');
      expect(result.altTitles).toContain('Alt Title 1 JP');
      expect(result.altTitles).toContain('Alt Title 2');
    });

    it('should extract description preferring English', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        description: 'English Description',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.description).toBe('English Description');
    });

    it('should map status directly (ongoing/completed/hiatus/cancelled)', async () => {
      const statuses = ['ongoing', 'completed', 'hiatus', 'cancelled'];

      for (const status of statuses) {
        const raw = {
          id: 'manga-123',
          title: 'Title',
          status,
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(raw),
        });

        const result = await adapter.fetchManga('manga-123');
        expect(result.status).toBe(status);
      }
    });

    it('should infer type: ko → manhwa', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        language: 'ko',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.type).toBe('manhwa');
    });

    it('should infer type: zh → manhua', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        language: 'zh',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.type).toBe('manhua');
    });

    it('should extract genres from tags where group=genre', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        relationships: {
          tags: [
            { group: 'genre', name: 'Action' },
            { group: 'genre', name: 'Comedy' },
            { group: 'theme', name: 'School' },
          ],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.genres).toEqual(['Action', 'Comedy']);
    });

    it('should extract themes from tags where group=theme', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        relationships: {
          tags: [
            { group: 'genre', name: 'Action' },
            { group: 'theme', name: 'School' },
            { group: 'theme', name: 'Slice of Life' },
          ],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.themes).toEqual(['School', 'Slice of Life']);
    });

    it('should extract authors from relationships', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        relationships: {
          authors: [
            { name: 'Author A' },
            { name: 'Author B' },
          ],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.authors).toEqual(['Author A', 'Author B']);
    });

    it('should extract artists from relationships', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        relationships: {
          artists: [
            { name: 'Artist A' },
            { name: 'Artist B' },
          ],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.artists).toEqual(['Artist A', 'Artist B']);
    });

    it('should construct cover URL from cover_art relationship', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        relationships: {
          cover: { id: 'cover-id', ext: '.jpg' },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.coverUrl).toBe('https://weebdex.org/covers/manga-123/cover-id.jpg');
    });

    it('should map link keys using LINK_TYPE_MAP', async () => {
      const raw = {
        id: 'manga-123',
        title: 'Title',
        relationships: {
          links: {
            mal: 'mal-123',
            al: 'al-456',
            kt: 'kt-789',
          },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('manga-123');
      expect(result.links).toContainEqual({ type: 'mal', externalId: 'mal-123' });
      expect(result.links).toContainEqual({ type: 'anilist', externalId: 'al-456' });
      expect(result.links).toContainEqual({ type: 'kitsu', externalId: 'kt-789' });
    });
  });

  describe('chapter normalization', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should normalize chapter fields from attributes', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'ch-123',
              attributes: {
                chapter: '1',
                title: 'Chapter 1',
                volume: '1',
                translatedLanguage: 'en',
              },
            },
          ],
        }),
      });

      const result = await adapter.fetchChapters('manga-123');

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe('ch-123');
      expect(result[0].number).toBe(1);
      expect(result[0].title).toBe('Chapter 1');
      expect(result[0].volume).toBe('1');
      expect(result[0].language).toBe('en');
    });

    it('should handle decimal chapter numbers (e.g., "10.5")', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'ch-123',
              attributes: { chapter: '10.5' },
            },
          ],
        }),
      });

      const result = await adapter.fetchChapters('manga-123');
      expect(result[0].number).toBe(10.5);
    });

    it('should handle null chapter number (default to 0)', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'ch-123',
              attributes: { chapter: null },
            },
          ],
        }),
      });

      const result = await adapter.fetchChapters('manga-123');
      expect(result[0].number).toBe(0);
    });
  });

  describe('image URL construction', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should construct image URLs from baseUrl + hash + filename', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          baseUrl: 'https://cdn.example.com',
          chapter: {
            hash: 'abc123def456',
            data: ['page-1.jpg', 'page-2.jpg'],
          },
        }),
      });

      const result = await adapter.fetchChapterImages('ch-123');

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://cdn.example.com/data/abc123def456/page-1.jpg');
      expect(result[1].url).toBe('https://cdn.example.com/data/abc123def456/page-2.jpg');
    });

    it('should assign sequential page numbers', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          baseUrl: 'https://cdn.example.com',
          chapter: {
            hash: 'abc123',
            data: ['page-1.jpg', 'page-2.jpg', 'page-3.jpg'],
          },
        }),
      });

      const result = await adapter.fetchChapterImages('ch-123');

      expect(result[0].pageNumber).toBe(1);
      expect(result[1].pageNumber).toBe(2);
      expect(result[2].pageNumber).toBe(3);
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it(
      'should enforce minimum interval between requests',
      async () => {
        (fetch as any).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: { id: '1', attributes: { title: { en: 'Title' } } } }),
        });

        const start = Date.now();

        // First request should not throttle
        await adapter.fetchManga('manga-1');
        const after1st = Date.now();

        // Second request should wait ~200ms
        await adapter.fetchManga('manga-2');
        const after2nd = Date.now();

        // Verify throttling occurred (should be at least 200ms between requests)
        expect(after2nd - after1st).toBeGreaterThanOrEqual(150);
      },
      10000,
    );
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should throw BadRequestException on non-200 response', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(adapter.fetchManga('manga-999')).rejects.toThrow(BadRequestException);
    });

    it('should include status and URL in error message', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(adapter.fetchManga('manga-999')).rejects.toThrow(/404/);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should search manga and normalize results', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'manga-1',
              attributes: { title: { en: 'Result 1' } },
            },
            {
              id: 'manga-2',
              attributes: { title: { en: 'Result 2' } },
            },
          ],
        }),
      });

      const result = await adapter.searchManga('test');
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Result 1');
      expect(result[1].title).toBe('Result 2');
    });
  });
});
