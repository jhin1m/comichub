/**
 * Creates an initialized NestJS SuperTest app for integration tests.
 *
 * DRIZZLE and REDIS_CLIENT are provided via a @Global() mock module so they
 * are visible to all feature modules (mirroring how DrizzleModule works in prod).
 * No real database or Redis connection is made.
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';

import { AppConfigModule } from '../../src/config/config.module.js';
import { DRIZZLE, POSTGRES_CLIENT } from '../../src/database/drizzle.provider.js';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter.js';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard.js';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from '../../src/modules/auth/strategies/jwt-refresh.strategy.js';
import { createMockDb, createMockRedis } from './mock-db.js';

export type MockDb = ReturnType<typeof createMockDb>;
export type MockRedis = ReturnType<typeof createMockRedis>;

export interface TestApp {
  app: INestApplication;
  db: MockDb;
  redis: MockRedis;
  req: ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * Build a NestJS test app for the given feature modules.
 * @param featureModules  NestJS module classes to load (e.g. AuthModule, MangaModule).
 */
export async function createTestApp(featureModules: any[]): Promise<TestApp> {
  const db = createMockDb();
  const redis = createMockRedis();

  // @Global() mock that mirrors DrizzleModule — makes DRIZZLE + REDIS_CLIENT
  // available to all feature module providers without real DB/Redis connections.
  @Global()
  @Module({
    providers: [
      { provide: DRIZZLE, useValue: db },
      { provide: POSTGRES_CLIENT, useValue: {} },
      { provide: 'REDIS_CLIENT', useValue: redis },
    ],
    exports: [DRIZZLE, POSTGRES_CLIENT, 'REDIS_CLIENT'],
  })
  class MockInfraModule {}

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      AppConfigModule,
      PassportModule,
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 9999 }]),
      EventEmitterModule.forRoot(),
      JwtModule.register({}),
      MockInfraModule,
      ...featureModules,
    ],
    providers: [
      JwtStrategy,
      JwtRefreshStrategy,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  })
    // Override any real ioredis instances declared inside feature modules (e.g. AuthModule)
    .overrideProvider('REDIS_CLIENT').useValue(redis)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  return {
    app,
    db,
    redis,
    req: request(app.getHttpServer()) as any,
    close: () => app.close(),
  };
}
