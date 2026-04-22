import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import { REDIS_AVAILABLE } from '../../common/providers/redis.provider.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: any;
  let mockRedis: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockBcrypt: any;

  beforeEach(async () => {
    // Mock Drizzle DB
    mockDb = {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    // Mock Redis
    mockRedis = {
      get: vi.fn(),
      del: vi.fn(),
      setex: vi.fn(),
    };

    // Mock JwtService
    mockJwtService = {
      signAsync: vi.fn(),
    };

    // Mock ConfigService
    mockConfigService = {
      getOrThrow: vi.fn((key: string) => {
        const config: Record<string, string> = {
          'jwt.accessSecret': 'access-secret-key',
          'jwt.refreshSecret': 'refresh-secret-key',
        };
        return config[key];
      }),
      get: vi.fn((key: string, defaultVal?: string) => {
        const config: Record<string, string> = {
          'jwt.accessExpiry': '15m',
          'jwt.refreshExpiry': '7d',
        };
        return config[key] ?? defaultVal;
      }),
    };

    // Get bcrypt mock
    const bcryptModule = await import('bcryptjs');
    mockBcrypt = bcryptModule;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: { sendResetPassword: vi.fn() } },
        { provide: REDIS_AVAILABLE, useValue: { available: true } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register()', () => {
    it('should throw ConflictException if email already exists', async () => {
      const dto: RegisterDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      mockDb.query.users.findFirst.mockResolvedValue({
        id: 1,
        email: dto.email,
        name: 'Existing User',
      });

      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('Email already registered'),
      );
      expect(mockDb.query.users.findFirst).toHaveBeenCalledOnce();
    });

    it('should hash password and create new user', async () => {
      const dto: RegisterDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const newUser = {
        id: 1,
        uuid: 'uuid-123',
        email: dto.email,
        name: dto.name,
        role: 'user',
      };

      mockDb.query.users.findFirst.mockResolvedValue(null);
      // Chain: insert().values().returning() for users table
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newUser]),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.register(dto);

      expect(mockDb.query.users.findFirst).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'refresh:1',
        expect.any(Number),
        'refresh-token',
      );
    });

    it('should call JwtService with correct payload', async () => {
      const dto: RegisterDto = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password456',
      };

      const newUser = {
        id: 2,
        uuid: 'uuid-456',
        email: dto.email,
        name: dto.name,
        role: 'user',
      };

      mockDb.query.users.findFirst.mockResolvedValue(null);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newUser]),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token-2')
        .mockResolvedValueOnce('refresh-token-2');
      mockRedis.setex.mockResolvedValue('OK');

      await service.register(dto);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: newUser.id,
          uuid: newUser.uuid,
          email: newUser.email,
          role: newUser.role,
        }),
        expect.any(Object),
      );
    });
  });

  describe('login()', () => {
    it('should throw UnauthorizedException for unknown email', async () => {
      const dto: LoginDto = {
        email: 'unknown@example.com',
        password: 'password123',
      };

      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException if user has no password', async () => {
      const dto: LoginDto = {
        email: 'john@example.com',
        password: 'password123',
      };

      mockDb.query.users.findFirst.mockResolvedValue({
        id: 1,
        email: dto.email,
        password: null,
      });

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const dto: LoginDto = {
        email: 'john@example.com',
        password: 'wrongpassword',
      };

      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: dto.email,
        password: 'hashed-password-hash',
        role: 'user',
      };

      mockDb.query.users.findFirst.mockResolvedValue(user);
      // Simulate bcrypt.compare returning false
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should return tokens on successful login', async () => {
      const dto: LoginDto = {
        email: 'john@example.com',
        password: 'password123',
      };

      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: dto.email,
        password: 'hashed-password',
        role: 'user',
      };

      mockDb.query.users.findFirst.mockResolvedValue(user);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockRedis.setex.mockResolvedValue('OK');

      // Mock bcrypt.compare
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    it('should delete refresh token from Redis', async () => {
      const userId = 1;
      mockRedis.del.mockResolvedValue(1);

      await service.logout(userId);

      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${userId}`);
    });

    it('should handle logout even if token does not exist', async () => {
      const userId = 999;
      mockRedis.del.mockResolvedValue(0);

      await expect(service.logout(userId)).resolves.not.toThrow();
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${userId}`);
    });
  });

  describe('refresh()', () => {
    it('should throw UnauthorizedException if no stored token', async () => {
      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: 'john@example.com',
        role: 'user',
        refreshToken: 'provided-token',
      };

      mockRedis.get.mockResolvedValue(null);

      await expect(service.refresh(user)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('should throw UnauthorizedException if stored token does not match provided token', async () => {
      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: 'john@example.com',
        role: 'user',
        refreshToken: 'provided-token',
      };

      mockRedis.get.mockResolvedValue('different-token');

      await expect(service.refresh(user)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('should return new tokens if stored token matches', async () => {
      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: 'john@example.com',
        role: 'user',
        refreshToken: 'provided-token',
      };

      mockRedis.get.mockResolvedValue('provided-token');
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.refresh(user);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });
      expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${user.id}`);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should rotate refresh token on successful refresh', async () => {
      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: 'john@example.com',
        role: 'user',
        refreshToken: 'old-token',
      };

      mockRedis.get.mockResolvedValue('old-token');
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockRedis.setex.mockResolvedValue('OK');

      await service.refresh(user);

      // Should store the new refresh token with TTL
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'refresh:1',
        60 * 60 * 24 * 7, // 7 days in seconds
        'new-refresh-token',
      );
    });
  });

  describe('getMe()', () => {
    // Helpers build select-chain mocks where each call to db.select() returns
    // a fresh chain resolving to a given array. Mirrors drizzle fluent API.
    const buildSelectChain = (result: unknown[]) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    });

    it('throws NotFoundException if user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(buildSelectChain([]))
        .mockReturnValueOnce(buildSelectChain([]));

      await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
    });

    it('returns hasHistory=false, hasBookmark=false for new user', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 1,
        uuid: 'u-1',
        email: 'new@x.com',
        role: 'user',
      });
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(buildSelectChain([])) // readingHistory
        .mockReturnValueOnce(buildSelectChain([])); // follows

      const result = await service.getMe(1);

      expect(result.hasHistory).toBe(false);
      expect(result.hasBookmark).toBe(false);
    });

    it('returns hasHistory=true when reading_history exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 1,
        uuid: 'u-1',
        email: 'h@x.com',
        role: 'user',
      });
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(buildSelectChain([{ id: 42 }]))
        .mockReturnValueOnce(buildSelectChain([]));

      const result = await service.getMe(1);

      expect(result.hasHistory).toBe(true);
      expect(result.hasBookmark).toBe(false);
    });

    it('returns hasBookmark=true when follows exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 1,
        uuid: 'u-1',
        email: 'b@x.com',
        role: 'user',
      });
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(buildSelectChain([]))
        .mockReturnValueOnce(buildSelectChain([{ id: 7 }]));

      const result = await service.getMe(1);

      expect(result.hasHistory).toBe(false);
      expect(result.hasBookmark).toBe(true);
    });

    it('returns both flags true when user has history and bookmarks', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 1,
        uuid: 'u-1',
        email: 'both@x.com',
        role: 'user',
      });
      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(buildSelectChain([{ id: 99 }]))
        .mockReturnValueOnce(buildSelectChain([{ id: 100 }]));

      const result = await service.getMe(1);

      expect(result.hasHistory).toBe(true);
      expect(result.hasBookmark).toBe(true);
    });
  });

  describe('loginWithGoogle()', () => {
    it('should return tokens for google user', async () => {
      const user = {
        id: 1,
        uuid: 'uuid-123',
        email: 'user@google.com',
        role: 'user',
      };

      mockJwtService.signAsync
        .mockResolvedValueOnce('google-access-token')
        .mockResolvedValueOnce('google-refresh-token');
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.loginWithGoogle(user);

      expect(result).toEqual({
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
        expiresIn: 900,
      });
    });
  });
});
