import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SourceAdapter } from './source-adapter.interface.js';
import { ImportSource } from '../types/import-source.enum.js';
import type {
  ExternalManga,
  ExternalChapter,
  ExternalChapterImage,
} from '../types/external-manga.types.js';
import type {
  AtsuSearchResponse,
  AtsuBrowseResponse,
  AtsuMangaPageResponse,
  AtsuAllChaptersResponse,
  AtsuPageResponse,
  AtsuManga,
  AtsuSearchRequest,
} from '../types/atsumaru-api.types.js';
import { ImportService } from '../services/import.service.js';

/** Separator for compound chapter external IDs: {mangaSlug}:::{chapterName} */
const COMPOUND_ID_SEP = ':::';

const NSFW_GENRE_MAP: Record<string, ExternalManga['contentRating']> = {
  hentai: 'pornographic',
  adult: 'erotica',
  mature: 'erotica',
  smut: 'erotica',
  erotica: 'erotica',
  ecchi: 'suggestive',
};

const STATUS_MAP: Record<string, ExternalManga['status']> = {
  ongoing: 'ongoing',
  completed: 'completed',
  hiatus: 'hiatus',
  canceled: 'cancelled',
};

const TYPE_MAP: Record<string, ExternalManga['type']> = {
  manga: 'manga',
  manwha: 'manhwa',
  manhwa: 'manhwa',
  manhua: 'manhua',
  oel: 'manga',
};

@Injectable()
export class AtsumaruAdapter implements SourceAdapter, OnModuleInit {
  readonly source = ImportSource.ATSUMARU;
  private readonly logger = new Logger(AtsumaruAdapter.name);
  private readonly baseUrl: string;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL_MS = 500;
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly config: ConfigService,
    private readonly importService: ImportService,
  ) {
    this.baseUrl = this.config.get<string>('import.atsumaru.baseUrl')!;
  }

  onModuleInit(): void {
    this.importService.registerAdapter(ImportSource.ATSUMARU, this);
  }

  /* ── HTTP helpers ────────────────────────────────────── */

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_INTERVAL_MS) {
      await new Promise<void>((r) =>
        setTimeout(r, this.MIN_INTERVAL_MS - elapsed),
      );
    }
    this.lastRequestTime = Date.now();
  }

  private get headers(): Record<string, string> {
    return {
      Accept: '*/*',
      Referer: this.baseUrl,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    await this.throttle();
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options?.headers },
      });

      if (res.ok) return res.json() as Promise<T>;

      if ((res.status === 403 || res.status === 503) && attempt < this.MAX_RETRIES) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Atsumaru ${res.status} on ${path}, retry ${attempt}/${this.MAX_RETRIES} in ${delay}ms`,
        );
        await new Promise<void>((r) => setTimeout(r, delay));
        continue;
      }

      this.logger.error(
        `Atsumaru API error: ${res.status} ${res.statusText} — ${url}`,
      );
      throw new BadRequestException(`Atsumaru API error: ${res.status}`);
    }

    throw new BadRequestException(`Atsumaru API failed after ${this.MAX_RETRIES} retries`);
  }

  /* ── SourceAdapter methods ──────────────────────────── */

  async searchManga(query: string): Promise<ExternalManga[]> {
    const body: AtsuSearchRequest = {
      page: 0,
      filter: {
        search: query,
        types: ['Manga', 'Manwha', 'Manhua', 'OEL'],
        showAdult: false,
      },
    };

    const data = await this.request<AtsuSearchResponse & AtsuBrowseResponse>(
      '/api/explore/filteredView',
      { method: 'POST', body: JSON.stringify(body) },
    );

    // Search returns hits[]; fallback to items[] (browse format)
    const mangas = data.hits
      ? data.hits.map((h) => h.document)
      : data.items ?? [];

    return mangas.map((m) => this.normalizeManga(m));
  }

  async fetchManga(externalId: string): Promise<ExternalManga> {
    const data = await this.request<AtsuMangaPageResponse>(
      `/api/manga/page?id=${encodeURIComponent(externalId)}`,
    );
    return this.normalizeManga(data.mangaPage);
  }

  async fetchChapters(
    externalId: string,
    _lang = 'en',
    page = 1,
  ): Promise<ExternalChapter[]> {
    // atsu.moe returns all chapters at once — no server-side pagination
    if (page > 1) return [];

    const data = await this.request<AtsuAllChaptersResponse>(
      `/api/manga/allChapters?mangaId=${encodeURIComponent(externalId)}`,
    );

    return (data.chapters ?? []).map((ch) => ({
      externalId: `${externalId}${COMPOUND_ID_SEP}${ch.id}`,
      number: ch.number ?? 0,
      title: ch.title || undefined,
      language: 'en',
      publishedAt: ch.createdAt
        ? new Date(
            typeof ch.createdAt === 'number'
              ? ch.createdAt
              : ch.createdAt,
          ).toISOString()
        : undefined,
      groups: ch.scanlationMangaId
        ? [{ externalId: ch.scanlationMangaId, name: ch.scanlationMangaId }]
        : undefined,
    }));
  }

  async fetchChapterImages(
    chapterExternalId: string,
  ): Promise<ExternalChapterImage[]> {
    const sepIdx = chapterExternalId.indexOf(COMPOUND_ID_SEP);
    if (sepIdx === -1) {
      throw new BadRequestException(
        `Invalid Atsumaru chapter ID (missing separator): ${chapterExternalId}`,
      );
    }

    const mangaSlug = chapterExternalId.slice(0, sepIdx);
    const chapterId = chapterExternalId.slice(sepIdx + COMPOUND_ID_SEP.length);

    const data = await this.request<AtsuPageResponse>(
      `/api/read/chapter?mangaId=${encodeURIComponent(mangaSlug)}&chapterId=${encodeURIComponent(chapterId)}`,
    );

    return (data.readChapter?.pages ?? []).map((p, idx) => ({
      url: this.resolveImageUrl(p.image),
      pageNumber: idx + 1,
    }));
  }

  /* ── Normalization helpers ──────────────────────────── */

  private normalizeManga(raw: AtsuManga): ExternalManga {
    const tagNames = (raw.tags ?? []).map((t) => t.name);
    const contentRating = this.inferContentRating(tagNames);

    return {
      externalId: raw.id,
      title: raw.title,
      altTitles: [],
      description: raw.synopsis,
      coverUrl: this.resolveImageUrl(raw.poster ?? raw.image),
      status: STATUS_MAP[(raw.status ?? '').toLowerCase()],
      type: TYPE_MAP[(raw.type ?? '').toLowerCase()],
      contentRating,
      genres: tagNames,
      themes: [],
      authors: (raw.authors ?? []).map((a) => a.name),
      artists: (raw.authors ?? []).map((a) => a.name),
      links: [],
    };
  }

  private inferContentRating(
    tags: string[],
  ): ExternalManga['contentRating'] {
    let rating: ExternalManga['contentRating'] = 'safe';
    const severity: Record<string, number> = {
      safe: 0,
      suggestive: 1,
      erotica: 2,
      pornographic: 3,
    };

    for (const tag of tags) {
      const mapped = NSFW_GENRE_MAP[tag.toLowerCase()];
      if (mapped && severity[mapped] > severity[rating!]) {
        rating = mapped;
      }
    }
    return rating;
  }

  private resolveImageUrl(path?: unknown): string {
    if (!path || typeof path !== 'string') return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path.replace(/^http:/, 'https:');
    }
    if (path.startsWith('//')) return `https:${path}`;
    return `${this.baseUrl}/static/${path.replace(/^\//, '')}`;
  }
}
