import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SourceAdapter } from './source-adapter.interface.js';
import { ImportSource } from '../types/import-source.enum.js';
import { normalizeContentRating } from '../../../common/utils/content-rating.util.js';
import type {
  ExternalManga,
  ExternalLink,
} from '../types/external-manga.types.js';
import type {
  MangaBakaSeries,
  MangaBakaSearchResult,
} from '../types/mangabaka-api.types.js';
import { ImportService } from '../services/import.service.js';

@Injectable()
export class MangaBakaAdapter implements SourceAdapter, OnModuleInit {
  readonly source = ImportSource.MANGABAKA;
  private readonly logger = new Logger(MangaBakaAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly importService: ImportService,
  ) {
    this.baseUrl = this.config.get<string>('import.mangabaka.baseUrl') ?? '';
    this.apiKey = this.config.get<string>('import.mangabaka.apiKey') ?? '';

    if (!this.apiKey) {
      this.logger.warn('MangaBaka API key not configured — requests will fail');
    }
  }

  onModuleInit(): void {
    this.importService.registerAdapter(ImportSource.MANGABAKA, this);
  }

  async searchManga(query: string): Promise<ExternalManga[]> {
    const data = await this.request<MangaBakaSearchResult>(
      `/v1/series/search?q=${encodeURIComponent(query)}`,
    );
    return (data.results ?? []).map((r) => this.normalize(r));
  }

  async fetchManga(externalId: string): Promise<ExternalManga> {
    const data = await this.request<MangaBakaSeries>(
      `/v1/series/${externalId}/full`,
    );
    return this.normalize(data);
  }

  private normalize(raw: MangaBakaSeries): ExternalManga {
    return {
      externalId: String(raw.id),
      title: raw.title,
      nativeTitle: raw.native_title,
      romanizedTitle: raw.romanized_title,
      altTitles: this.flattenAltTitles(raw.secondary_titles),
      description: raw.description,
      coverUrl: raw.cover?.x300?.url ?? raw.cover?.raw?.url,
      status: this.normalizeStatus(raw.status),
      type: this.normalizeType(raw.type),
      contentRating: this.normalizeContentRating(raw.content_rating),
      year: raw.year,
      genres: raw.genres_v2
        ? raw.genres_v2.filter((g) => g.group === 'genre').map((g) => g.name)
        : (raw.genres ?? []),
      themes: raw.tags_v2
        ? raw.tags_v2.filter((t) => t.group === 'theme').map((t) => t.name)
        : (raw.tags ?? []),
      authors: raw.authors ?? [],
      artists: raw.artists ?? [],
      links: this.buildLinks(raw),
    };
  }

  private flattenAltTitles(
    secondary?: Record<string, { type: string; title: string }[]>,
  ): string[] {
    if (!secondary) return [];
    return Object.values(secondary)
      .flat()
      .map((entry) => entry.title)
      .filter(Boolean);
  }

  private normalizeStatus(status?: string): ExternalManga['status'] {
    switch (status) {
      case 'releasing':
        return 'ongoing';
      case 'finished':
        return 'completed';
      case 'hiatus':
        return 'hiatus';
      case 'cancelled':
        return 'cancelled';
      case 'dropped':
        return 'dropped';
      default:
        return 'ongoing';
    }
  }

  private normalizeType(type?: string): ExternalManga['type'] {
    switch (type) {
      case 'manhwa':
        return 'manhwa';
      case 'manhua':
        return 'manhua';
      case 'doujinshi':
        return 'doujinshi';
      case 'manga':
      case 'novel':
      case 'oel':
      case 'other':
      default:
        return 'manga';
    }
  }

  private normalizeContentRating(
    rating?: string,
  ): ExternalManga['contentRating'] {
    return normalizeContentRating(rating) as ExternalManga['contentRating'];
  }

  private buildLinks(raw: MangaBakaSeries): ExternalLink[] {
    const links: ExternalLink[] = [];

    if (raw.source) {
      for (const [type, data] of Object.entries(raw.source)) {
        links.push({ type, externalId: String(data.id) });
      }
    }

    if (raw.links) {
      for (const link of raw.links) {
        const type = this.parseLinkType(link.url);
        if (type) links.push({ type, url: link.url });
      }
    }

    return links;
  }

  private parseLinkType(url: string): string | null {
    if (url.includes('myanimelist.net')) return 'mal';
    if (url.includes('anilist.co')) return 'anilist';
    if (url.includes('kitsu.app') || url.includes('kitsu.io')) return 'kitsu';
    if (url.includes('amazon')) return 'amazon';
    if (url.includes('mangaupdates.com')) return 'mu';
    return null;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'x-api-key': this.apiKey,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      this.logger.error(
        `MangaBaka API error: ${res.status} ${res.statusText} — ${this.baseUrl}${path}`,
      );
      throw new BadRequestException(`MangaBaka API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }
}
