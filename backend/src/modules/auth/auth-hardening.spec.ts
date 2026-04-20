import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import { REDIS_AVAILABLE } from '../../common/providers/redis.provider.js';

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed'),
  compare: vi.fn().mockResolvedValue(true),
}));

function buildService(overrides: {
  findUser?: any;
  redisGet?: any;
  redisIncr?: any;
  redisGetdel?: any;
  dbJtiRow?: any;
  redisAvailable?: boolean;
}) {
  const mockDb: any = {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(overrides.findUser ?? null),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([overrides.findUser ?? {}]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue(overrides.dbJtiRow ? [overrides.dbJtiRow] : []),
        }),
      }),
    }),
  };
  const mockRedis: any = {
    get: vi.fn().mockResolvedValue(overrides.redisGet ?? null),
    del: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue('OK'),
    incr: vi.fn().mockResolvedValue(overrides.redisIncr ?? 1),
    expire: vi.fn().mockResolvedValue(1),
    getdel: vi.fn().mockResolvedValue(overrides.redisGetdel ?? null),
  };
  const mockJwt = {
    signAsync: vi.fn().mockResolvedValue('signed-token'),
  };
  const mockConfig = {
    getOrThrow: (k: string) => ({
      'jwt.accessSecret': 'a'.repeat(32),
      'jwt.refreshSecret': 'b'.repeat(32),
    })[k],
    get: (k: string, d?: string) =>
      ({ 'jwt.accessExpiry': '15m', 'jwt.refreshExpiry': '7d' })[k] ?? d,
  };

  return Test.createTestingModule({
    providers: [
      AuthService,
      { provide: DRIZZLE, useValue: mockDb },
      { provide: 'REDIS_CLIENT', useValue: mockRedis },
      { provide: JwtService, useValue: mockJwt },
      { provide: ConfigService, useValue: mockConfig },
      { provide: MailService, useValue: { sendResetPassword: vi.fn() } },
      {
        provide: REDIS_AVAILABLE,
        useValue: { available: overrides.redisAvailable ?? true },
      },
    ],
  })
    .compile()
    .then((mod: TestingModule) => ({
      service: mod.get<AuthService>(AuthService),
      mockDb,
      mockRedis,
    }));
}

describe('AuthService hardening (Phase 03)', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── H5 login lockout ───────────────────────────────────────────

  it('H5: blocks login after 10 failed attempts within window', async () => {
    const { service, mockRedis } = await buildService({
      redisGet: '10', // counter already at threshold
    });
    mockRedis.get.mockResolvedValueOnce('10');

    await expect(
      service.login({ email: 'a@b.com', password: 'pw' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('H5: increments counter on bad password', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.compare as any).mockResolvedValueOnce(false);
    const { service, mockRedis } = await buildService({
      findUser: { id: 1, email: 'a@b.com', password: 'stored', role: 'user', uuid: 'u' },
      redisGet: null,
    });
    mockRedis.get.mockResolvedValueOnce(null);

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockRedis.incr).toHaveBeenCalledWith(
      expect.stringMatching(/^login-fail:/),
    );
  });

  it('H5: clears counter on successful login', async () => {
    const { service, mockRedis } = await buildService({
      findUser: { id: 1, email: 'a@b.com', password: 'x', role: 'user', uuid: 'u' },
      redisGet: null,
    });
    mockRedis.get.mockResolvedValueOnce(null);

    await service.login({ email: 'a@b.com', password: 'x' } as any);
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringMatching(/^login-fail:/),
    );
  });

  // ─── H3 refresh reuse detection ─────────────────────────────────

  it('H3: detects jti mismatch → revokes session + throws', async () => {
    const { service, mockDb, mockRedis } = await buildService({
      findUser: { id: 1, uuid: 'u', email: 'a@b.com', role: 'user' },
      dbJtiRow: { token: 'anything', jti: 'DB_JTI' },
    });

    await expect(
      service.refresh({
        id: 1,
        uuid: 'u',
        email: 'a@b.com',
        role: 'user',
        refreshToken: 'tok',
        jti: 'TOKEN_JTI_DIFFERENT',
      } as any),
    ).rejects.toThrow(/reuse detected/);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith('refresh:1');
  });

  // ─── C2 OAuth code exchange ─────────────────────────────────────

  it('C2: createOauthCode stores userId in Redis with TTL', async () => {
    const { service, mockRedis } = await buildService({});
    const code = await service.createOauthCode(42);
    expect(code).toMatch(/^[a-f0-9]{64}$/);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      `oauth-code:${code}`,
      60,
      '42',
    );
  });

  it('C2: exchangeOauthCode → GETDEL + return tokens for valid code', async () => {
    const { service, mockDb } = await buildService({
      redisGetdel: '42',
      findUser: { id: 42, uuid: 'u', email: 'a@b.com', role: 'user' },
    });
    mockDb.query.users.findFirst.mockResolvedValue({
      id: 42,
      uuid: 'u',
      email: 'a@b.com',
      role: 'user',
    });

    const tokens = await service.exchangeOauthCode('abc123');
    expect(tokens.accessToken).toBe('signed-token');
    expect(tokens.refreshToken).toBe('signed-token');
  });

  it('C2: exchangeOauthCode throws on invalid code', async () => {
    const { service } = await buildService({ redisGetdel: null });
    await expect(service.exchangeOauthCode('bogus')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('C2: exchangeOauthCode throws 503 when Redis down', async () => {
    const { service } = await buildService({ redisAvailable: false });
    await expect(service.exchangeOauthCode('x')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
