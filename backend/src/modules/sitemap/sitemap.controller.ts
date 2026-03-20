import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('sitemap')
@Controller()
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Public()
  @Get('sitemap.xml')
  @ApiOperation({ summary: 'XML sitemap' })
  async getSitemap(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return this.sitemapService.getSitemap();
  }

  @Public()
  @Get('robots.txt')
  @ApiOperation({ summary: 'robots.txt' })
  getRobots(@Res({ passthrough: true }) res: Response): string {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return this.sitemapService.getRobotsTxt();
  }
}
