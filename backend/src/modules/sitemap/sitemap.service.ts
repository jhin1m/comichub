import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { manga } from '../../database/schema/index.js';
import { isNull } from 'drizzle-orm';
import { encodeId } from '../../common/utils/short-id.util.js';

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private readonly appUrl: string;
  /** Path to frontend/public where static files are written */
  private readonly outputDir: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('app.url', 'https://comichub.app');
    this.outputDir = this.configService.get<string>(
      'SITEMAP_OUTPUT_DIR',
      join(process.cwd(), '..', 'frontend', 'public'),
    );
  }

  /** Generate sitemap + robots.txt on startup and every 6 hours */
  async onModuleInit(): Promise<void> {
    await this.generateStaticFiles();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async generateStaticFiles(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true });
      const sitemapXml = await this.buildSitemapXml();
      const robotsTxt = this.buildRobotsTxt();
      await Promise.all([
        writeFile(join(this.outputDir, 'sitemap.xml'), sitemapXml, 'utf-8'),
        writeFile(join(this.outputDir, 'robots.txt'), robotsTxt, 'utf-8'),
      ]);
      this.logger.log('Sitemap + robots.txt written to frontend/public/');
    } catch (err) {
      this.logger.error(
        'Failed to generate sitemap files',
        (err as Error).message,
      );
    }
  }

  private async buildSitemapXml(): Promise<string> {
    const rows = await this.db
      .select({ id: manga.id, slug: manga.slug, updatedAt: manga.updatedAt })
      .from(manga)
      .where(isNull(manga.deletedAt))
      .limit(50000);

    const urls = rows
      .map((row) => {
        const lastmod = row.updatedAt.toISOString().split('T')[0];
        return [
          '  <url>',
          `    <loc>${this.appUrl}/manga/${encodeId(row.id)}-${row.slug}</loc>`,
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

  private buildRobotsTxt(): string {
    return `User-agent: *\nAllow: /\nSitemap: ${this.appUrl}/sitemap.xml`;
  }
}
