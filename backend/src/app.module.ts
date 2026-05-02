import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config/config.module.js';
import { CommonModule } from './common/common.module.js';
import { DrizzleModule } from './database/drizzle.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { MangaModule } from './modules/manga/manga.module.js';
import { CommunityModule } from './modules/community/community.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { SitemapModule } from './modules/sitemap/sitemap.module.js';
import { ImportModule } from './modules/import/import.module.js';
import { BookmarkModule } from './modules/bookmark/bookmark.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MirrorModule } from './modules/mirror/mirror.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    DrizzleModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('redis.url') },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: { age: 86400 },
        },
      }),
    }),
    AuthModule,
    UserModule,
    MangaModule,
    CommunityModule,
    SearchModule,
    JobsModule,
    NotificationModule,
    SitemapModule,
    ImportModule,
    BookmarkModule,
    HealthModule,
    MirrorModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
