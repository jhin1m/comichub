import { Module } from '@nestjs/common';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { SitemapService } from './sitemap.service.js';

@Module({
  imports: [DrizzleModule],
  providers: [SitemapService],
})
export class SitemapModule {}
