import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { RedisCacheInterceptor } from './redis-cache.interceptor.js';

function buildContext(method = 'GET', url = '/manga', authHeader?: string) {
  return {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({
        method,
        url,
        headers: authHeader ? { authorization: authHeader } : {},
      }),
      getResponse: vi.fn().mockReturnValue({
        setHeader: vi.fn(),
      }),
    }),
  } as any;
}

function buildHandler(data: any = { ok: true }) {
  return { handle: vi.fn().mockReturnValue(of(data)) };
}

describe('RedisCacheInterceptor', () => {
  let interceptor: RedisCacheInterceptor;
  let mockRedis: any;
  let mockReflector: any;

  beforeEach(async () => {
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    };

    mockReflector = {
      getAllAndOverride: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheInterceptor,
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    interceptor = module.get<RedisCacheInterceptor>(RedisCacheInterceptor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should bypass cache when no TTL is configured', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    const next = buildHandler();
    await interceptor.intercept(buildContext(), next);
    expect(next.handle).toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('should bypass cache for non-GET requests', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(60);
    const next = buildHandler();
    await interceptor.intercept(buildContext('POST'), next);
    expect(next.handle).toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('should bypass cache when Authorization header is present', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(60);
    const next = buildHandler();
    await interceptor.intercept(
      buildContext('GET', '/manga', 'Bearer token'),
      next,
    );
    expect(next.handle).toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('should return cached response on cache hit', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(60);
    const cached = [{ id: 1 }];
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const next = buildHandler();
    const obs = await interceptor.intercept(buildContext(), next);

    let result: any;
    obs.subscribe((v) => {
      result = v;
    });

    expect(result).toEqual(cached);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('should fetch from handler and cache on cache miss', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(60);
    mockRedis.get.mockResolvedValue(null);

    const data = { id: 1, title: 'Naruto' };
    const next = buildHandler(data);
    const obs = await interceptor.intercept(buildContext(), next);

    await new Promise<void>((resolve) => {
      obs.subscribe({ next: () => {}, complete: resolve });
    });

    expect(next.handle).toHaveBeenCalled();
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'cache:/manga',
      60,
      JSON.stringify(data),
    );
  });
});
