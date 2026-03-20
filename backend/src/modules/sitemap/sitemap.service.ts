import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { manga } from '../../database/schema/index.js';
import { isNull } from 'drizzle-orm';

const SITEMAP_CACHE_KEY = 'sitemap:main';
const SITEMAP_TTL = 86400; // 24h

@Injectable()
export class SitemapService {
  private readonly appUrl: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('app.url', 'https://comichub.app');
  }

  async getSitemap(): Promise<string> {
    const cached = await this.redis.get(SITEMAP_CACHE_KEY);
    if (cached) return cached;

    const xml = await this.generateSitemapXml();
    await this.redis.setex(SITEMAP_CACHE_KEY, SITEMAP_TTL, xml);
    return xml;
  }

  getRobotsTxt(): string {
    return `User-agent: *\nAllow: /\nSitemap: ${this.appUrl}/sitemap.xml`;
  }

  private async generateSitemapXml(): Promise<string> {
    const rows = await this.db
      .select({ slug: manga.slug, updatedAt: manga.updatedAt })
      .from(manga)
      .where(isNull(manga.deletedAt))
      .limit(50000);

    const urls = rows
      .map((row) => {
        const lastmod = row.updatedAt.toISOString().split('T')[0];
        return [
          '  <url>',
          `    <loc>${this.appUrl}/manga/${row.slug}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          '    <priority>0.8</priority>',
          '  </url>',
        ].join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
    ].join('\n');
  }
}
