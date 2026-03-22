import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type Redis from 'ioredis';
import type { NewChapterEvent } from '../modules/notification/events/new-chapter.event.js';

@Injectable()
export class CacheInvalidationJob {
  private readonly logger = new Logger(CacheInvalidationJob.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  @OnEvent('chapter.created')
  async onChapterCreated(_event?: NewChapterEvent): Promise<void> {
    await this.deleteByPattern('cache:/api/v1/manga*');
    await this.deleteByPattern('cache:/api/v1/rankings*');
    this.logger.debug('Invalidated manga + ranking caches (new chapter)');
  }

  @OnEvent('manga.updated')
  async onMangaUpdated(event: { slug: string }): Promise<void> {
    await this.redis.del(`cache:/api/v1/manga/${event.slug}`);
    await this.deleteByPattern('cache:/api/v1/manga?*');
    this.logger.debug(`Invalidated cache for manga ${event.slug}`);
  }

  /** SCAN + DEL by pattern (safe for production) */
  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length) await this.redis.del(...keys);
    } while (cursor !== '0');
  }
}
