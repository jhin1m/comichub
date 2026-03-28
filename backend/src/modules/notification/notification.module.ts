import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { DiscordWebhookService } from './discord/discord-webhook.service.js';
import { SseConnectionManagerService } from './sse-connection-manager.service.js';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    DiscordWebhookService,
    SseConnectionManagerService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
