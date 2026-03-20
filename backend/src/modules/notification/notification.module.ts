import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { DiscordWebhookService } from './discord/discord-webhook.service.js';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, DiscordWebhookService],
  exports: [NotificationService],
})
export class NotificationModule {}
