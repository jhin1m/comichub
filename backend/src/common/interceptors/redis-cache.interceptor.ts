import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { CACHE_TTL_KEY } from '../decorators/cache-ttl.decorator.js';

@Injectable()
export class RedisCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const ttl = this.reflector.getAllAndOverride<number>(CACHE_TTL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!ttl) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();

    // Only cache GET requests for unauthenticated users
    if (request.method !== 'GET') return next.handle();
    if (request.headers.authorization) return next.handle();

    const key = `cache:${request.url}`;

    const cached = await this.redis.get(key);
    if (cached) {
      return of(JSON.parse(cached) as unknown);
    }

    return next.handle().pipe(
      tap(async (data: unknown) => {
        await this.redis.setex(key, ttl, JSON.stringify(data));
      }),
    );
  }
}
