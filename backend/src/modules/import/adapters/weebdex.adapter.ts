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
  ExternalLink,
} from '../types/external-manga.types.js';
import type {
  WeebDexManga,
  WeebDexSearchResponse,
  WeebDexChapterResponse,
  WeebDexChapter,
  WeebDexChapterDetail,
  WeebDexScanlationGroup,
} from '../types/weebdex-api.types.js';
import { ImportService } from '../services/import.service.js';

const LINK_TYPE_MAP: Record<string, string> = {
  mal: 'mal',
  al: 'anilist',
  kt: 'kitsu',
  mu: 'mu',
  ap: 'anime-planet',
  bw: 'bookwalker',
  nu: 'novelupdates',
  amz: 'amazon',
  ebj: 'ebookjapan',
  cdj: 'cdjapan',
  raw: 'raw',
  engtl: 'official-en',
};

@Injectable()
export class WeebDexAdapter implements SourceAdapter, OnModuleInit {
  readonly source = ImportSource.WEEBDEX;
  private readonly logger = new Logger(WeebDexAdapter.name);
  private readonly baseUrl: string;
  private lastRequestTime = 0;
  private readonly MIN_INTERVAL_MS = 200;

  constructor(
    private readonly config: ConfigService,
    private readonly importService: ImportService,
  ) {
    this.baseUrl = this.config.get<string>('import.weebdex.baseUrl')!;
  }

  onModuleInit(): void {
    this.importService.registerAdapter(ImportSource.WEEBDEX, this);
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.MIN_INTERVAL_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.MIN_INTERVAL_MS - elapsed),
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(path: string): Promise<T> {
    await this.throttle();
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.error(
        `WeebDex API error: ${res.status} ${res.statusText} — ${url}`,
      );
      throw new BadRequestException(`WeebDex API error: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async searchManga(query: string): Promise<ExternalManga[]> {
    const data = await this.request<WeebDexSearchResponse>(
      `/manga?title=${encodeURIComponent(query)}&limit=20`,
    );
    return data.data.map((item) => this.normalizeManga(item));
  }

  async fetchManga(externalId: string): Promise<ExternalManga> {
    // Single manga returns the object directly (no wrapper)
    const raw = await this.request<WeebDexManga>(`/manga/${externalId}`);
    return this.normalizeManga(raw);
  }

  async fetchChapters(
    externalId: string,
    lang = 'en',
    page = 1,
  ): Promise<ExternalChapter[]> {
    const data = await this.request<WeebDexChapterResponse>(
      `/manga/${externalId}/chapters?limit=100&page=${page}`,
    );
    return data.data
      .filter((ch) => ch.language === lang)
      .map((ch) => this.normalizeChapter(ch));
  }

  async fetchChapterImages(
    chapterExternalId: string,
  ): Promise<ExternalChapterImage[]> {
    const data = await this.request<WeebDexChapterDetail>(
      `/chapter/${chapterExternalId}`,
    );
    const images = data.data_optimized ?? data.data;
    return images.map((img, idx) => ({
      url: `${data.node}/data/${chapterExternalId}/${img.name}`,
      pageNumber: idx + 1,
      width: img.dimensions?.[0],
      height: img.dimensions?.[1],
    }));
  }

  private normalizeManga(raw: WeebDexManga): ExternalManga {
    const rels = raw.relationships;

    // Alt titles: flatten Record<string, string[]> → string[]
    const altTitles = raw.alt_titles
      ? Object.values(raw.alt_titles).flat()
      : [];

    // Native title: prefer ja, then ko, then zh from alt_titles
    const nativeTitle =
      raw.alt_titles?.['ja']?.[0] ??
      raw.alt_titles?.['ko']?.[0] ??
      raw.alt_titles?.['zh']?.[0] ??
      undefined;

    const tags = rels?.tags ?? [];
    const genres = tags.filter((t) => t.group === 'genre').map((t) => t.name);
    const themes = tags.filter((t) => t.group === 'theme').map((t) => t.name);

    const authorNames = (rels?.authors ?? []).map((a) => a.name);
    const artistNames = (rels?.artists ?? []).map((a) => a.name);

    const links = this.extractLinks(rels?.links);

    return {
      externalId: raw.id,
      title: raw.title,
      nativeTitle,
      altTitles,
      description: raw.description,
      coverUrl: this.extractCoverUrl(raw),
      originalLanguage: raw.language,
      status: raw.status as ExternalManga['status'],
      type: this.inferType(raw.language),
      contentRating: raw.content_rating as ExternalManga['contentRating'],
      demographic: raw.demographic,
      year: raw.year,
      genres,
      themes,
      authors: authorNames,
      artists: artistNames,
      links,
    };
  }

  private inferType(lang?: string): ExternalManga['type'] {
    if (lang === 'ko') return 'manhwa';
    if (lang === 'zh') return 'manhua';
    return 'manga';
  }

  private extractCoverUrl(raw: WeebDexManga): string | undefined {
    const cover = raw.relationships?.cover;
    if (!cover?.id || !cover?.ext) return undefined;
    // Actual URL pattern: https://weebdex.org/covers/{mangaId}/{coverId}{ext}
    return `https://weebdex.org/covers/${raw.id}/${cover.id}${cover.ext}`;
  }

  private extractLinks(links?: Record<string, string>): ExternalLink[] {
    if (!links) return [];
    return Object.entries(links)
      .filter(([key]) => LINK_TYPE_MAP[key])
      .map(([key, value]) => ({
        type: LINK_TYPE_MAP[key],
        externalId: value,
      }));
  }

  private normalizeChapter(raw: WeebDexChapter): ExternalChapter {
    const groups = (raw.relationships?.groups ?? [])
      .filter((g): g is WeebDexScanlationGroup & { name: string } => !!g.name)
      .map((g) => ({ externalId: g.id, name: g.name }));

    return {
      externalId: raw.id,
      number: parseFloat(raw.chapter ?? '0'),
      title: raw.title,
      volume: raw.volume,
      language: raw.language,
      publishedAt: raw.published_at,
      groups: groups.length > 0 ? groups : undefined,
    };
  }
}
