import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewChapterEvent } from '../events/new-chapter.event.js';

@Injectable()
export class DiscordWebhookService {
  private readonly logger = new Logger(DiscordWebhookService.name);
  private readonly webhookUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.webhookUrl = this.config.get<string>('DISCORD_WEBHOOK_URL');
  }

  async sendNewChapter(event: NewChapterEvent): Promise<void> {
    if (!this.webhookUrl) return;

    const embed = {
      title: `New Chapter: ${event.mangaTitle}`,
      description: `Chapter ${event.chapterNumber} is now available!`,
      color: 0x5865f2,
      thumbnail: event.mangaCover ? { url: event.mangaCover } : undefined,
      fields: [
        { name: 'Manga', value: event.mangaTitle, inline: true },
        { name: 'Chapter', value: String(event.chapterNumber), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (!res.ok) {
        this.logger.warn(`Discord webhook failed: ${res.status}`);
      }
    } catch (err) {
      this.logger.error('Discord webhook error', err);
    }
  }
}
