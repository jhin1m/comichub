import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MangaBakaAdapter } from './mangabaka.adapter.js';
import { ImportService } from '../services/import.service.js';

describe('MangaBakaAdapter', () => {
  let adapter: MangaBakaAdapter;
  let mockConfig: any;
  let mockImportService: any;

  beforeEach(async () => {
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'import.mangabaka.baseUrl')
          return 'https://api.mangabaka.dev';
        if (key === 'import.mangabaka.apiKey') return 'mb-test-key';
        return '';
      }),
    };

    mockImportService = {
      registerAdapter: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MangaBakaAdapter,
        { provide: ConfigService, useValue: mockConfig },
        { provide: ImportService, useValue: mockImportService },
      ],
    }).compile();

    adapter = module.get<MangaBakaAdapter>(MangaBakaAdapter);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('normalization', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should normalize basic series fields', async () => {
      const raw = {
        id: 123,
        title: 'Test Manga',
        native_title: 'テスト漫画',
        romanized_title: 'Tesuto Manga',
        secondary_titles: {},
        description: 'A test manga',
        status: 'releasing',
        type: 'manga',
        content_rating: 'safe',
        year: 2020,
        genres: ['Action', 'Comedy'],
        tags: [],
        authors: ['Author A'],
        artists: ['Artist B'],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('123');

      expect(result.externalId).toBe('123');
      expect(result.title).toBe('Test Manga');
      expect(result.nativeTitle).toBe('テスト漫画');
      expect(result.romanizedTitle).toBe('Tesuto Manga');
      expect(result.description).toBe('A test manga');
      expect(result.year).toBe(2020);
      expect(result.authors).toEqual(['Author A']);
      expect(result.artists).toEqual(['Artist B']);
    });

    it('should normalize status: releasing → ongoing', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        status: 'releasing',
        type: 'manga',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.status).toBe('ongoing');
    });

    it('should normalize status: finished → completed', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        status: 'finished',
        type: 'manga',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.status).toBe('completed');
    });

    it('should normalize status: hiatus → hiatus', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        status: 'hiatus',
        type: 'manga',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.status).toBe('hiatus');
    });

    it('should normalize status: cancelled → cancelled', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        status: 'cancelled',
        type: 'manga',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.status).toBe('cancelled');
    });

    it('should fallback unknown status to ongoing', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        status: 'unknown_status',
        type: 'manga',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.status).toBe('ongoing');
    });

    it('should normalize type: manga directly', async () => {
      const raw = { id: 1, title: 'Manga', type: 'manga' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.type).toBe('manga');
    });

    it('should normalize type: manhwa directly', async () => {
      const raw = { id: 1, title: 'Manga', type: 'manhwa' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.type).toBe('manhwa');
    });

    it('should normalize type: manhua directly', async () => {
      const raw = { id: 1, title: 'Manga', type: 'manhua' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.type).toBe('manhua');
    });

    it('should fallback novel type to manga', async () => {
      const raw = { id: 1, title: 'Manga', type: 'novel' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.type).toBe('manga');
    });

    it('should fallback unknown type to manga', async () => {
      const raw = { id: 1, title: 'Manga', type: 'unknown_type' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.type).toBe('manga');
    });

    it('should extract altTitles from secondary_titles', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        secondary_titles: {
          en: [{ type: 'English', title: 'English Title' }],
          ja: [{ type: 'Japanese', title: 'Japanese Title' }],
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.altTitles).toContain('English Title');
      expect(result.altTitles).toContain('Japanese Title');
    });

    it('should handle empty secondary_titles', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        secondary_titles: {},
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.altTitles).toEqual([]);
    });

    it('should extract cover URL from x300', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        cover: {
          x300: { url: 'https://cdn.example.com/cover-300.jpg' },
          raw: { url: 'https://cdn.example.com/cover.jpg' },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.coverUrl).toBe('https://cdn.example.com/cover-300.jpg');
    });

    it('should fallback to raw cover URL when x300 missing', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        cover: {
          raw: { url: 'https://cdn.example.com/cover.jpg' },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.coverUrl).toBe('https://cdn.example.com/cover.jpg');
    });

    it('should split genres_v2 into genres and themes', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        genres_v2: [
          { group: 'genre', name: 'Action' },
          { group: 'genre', name: 'Comedy' },
        ],
        tags_v2: [
          { group: 'theme', name: 'School' },
          { group: 'theme', name: 'Slice of Life' },
        ],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.genres).toEqual(['Action', 'Comedy']);
      expect(result.themes).toEqual(['School', 'Slice of Life']);
    });

    it('should fallback to flat genres array when genres_v2 missing', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        genres: ['Action', 'Comedy'],
        tags: ['School'],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.genres).toEqual(['Action', 'Comedy']);
      expect(result.themes).toEqual(['School']);
    });

    it('should extract links from source object', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        source: {
          anilist: { id: 'al-123' },
          mal: { id: 'mal-456' },
          kitsu: { id: 'kitsu-789' },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.links).toHaveLength(3);
      expect(result.links).toContainEqual({
        type: 'anilist',
        externalId: 'al-123',
      });
      expect(result.links).toContainEqual({
        type: 'mal',
        externalId: 'mal-456',
      });
      expect(result.links).toContainEqual({
        type: 'kitsu',
        externalId: 'kitsu-789',
      });
    });

    it('should parse link type from URL in links array', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
        links: [
          { url: 'https://myanimelist.net/manga/123' },
          { url: 'https://anilist.co/manga/456' },
          { url: 'https://kitsu.io/manga/789' },
        ],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.links).toHaveLength(3);
      expect(result.links).toContainEqual({
        type: 'mal',
        url: 'https://myanimelist.net/manga/123',
      });
      expect(result.links).toContainEqual({
        type: 'anilist',
        url: 'https://anilist.co/manga/456',
      });
      expect(result.links).toContainEqual({
        type: 'kitsu',
        url: 'https://kitsu.io/manga/789',
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const raw = {
        id: 1,
        title: 'Manga',
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.externalId).toBe('1');
      expect(result.title).toBe('Manga');
      expect(result.nativeTitle).toBeUndefined();
      expect(result.altTitles).toEqual([]);
      expect(result.authors).toEqual([]);
      expect(result.artists).toEqual([]);
    });
  });

  describe('fetch', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should call /v1/series/{id}/full with correct headers', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, title: 'Test' }),
      });

      await adapter.fetchManga('123');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.mangabaka.dev/v1/series/123/full',
        {
          headers: {
            'x-api-key': 'mb-test-key',
            Accept: 'application/json',
          },
        },
      );
    });

    it('should call /v1/series/search with query param', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.searchManga('test query');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.mangabaka.dev/v1/series/search?q=test%20query',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'mb-test-key',
          }),
        }),
      );
    });

    it('should throw BadRequestException on non-200 response', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(adapter.fetchManga('999')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle search with no results', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: null }),
      });

      const result = await adapter.searchManga('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('content rating normalization', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('should normalize content rating: safe', async () => {
      const raw = { id: 1, title: 'Manga', content_rating: 'safe' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.contentRating).toBe('safe');
    });

    it('should normalize content rating: suggestive', async () => {
      const raw = { id: 1, title: 'Manga', content_rating: 'suggestive' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.contentRating).toBe('suggestive');
    });

    it('should normalize content rating: erotica', async () => {
      const raw = { id: 1, title: 'Manga', content_rating: 'erotica' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(raw),
      });

      const result = await adapter.fetchManga('1');
      expect(result.contentRating).toBe('erotica');
    });
  });
});
