import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { DrizzleModule } from './database/drizzle.module.js';

@Module({
  imports: [
    AppConfigModule,
    DrizzleModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
