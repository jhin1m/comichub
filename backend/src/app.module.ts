import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from './config/config.module.js';
import { DrizzleModule } from './database/drizzle.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { MangaModule } from './modules/manga/manga.module.js';
import { CommunityModule } from './modules/community/community.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { SitemapModule } from './modules/sitemap/sitemap.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';

@Module({
  imports: [
    AppConfigModule,
    DrizzleModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    AuthModule,
    UserModule,
    MangaModule,
    CommunityModule,
    SearchModule,
    JobsModule,
    NotificationModule,
    SitemapModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
