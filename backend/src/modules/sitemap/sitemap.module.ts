import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { SitemapController } from './sitemap.controller.js';
import { SitemapService } from './sitemap.service.js';

@Module({
  imports: [AuthModule, DrizzleModule],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
