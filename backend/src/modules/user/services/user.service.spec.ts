import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

// Mock sharp and AWS SDK at module level
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('img')),
  }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = vi.fn().mockResolvedValue({});
  },
  PutObjectCommand: class {
    constructor(public args: any) {}
  },
}));

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'update',
    'set',
    'delete',
    'innerJoin',
  ].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const userFixture = {
  id: 10,
  uuid: 'uuid-user',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed',
  avatar: null,
  role: 'user',
  xp: 0,
  level: 1,
  bannedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  googleId: null,
  profile: null,
};

describe('UserService', () => {
  let service: UserService;
  let mockDb: any;
  let mockConfig: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        users: { findFirst: vi.fn() },
        userProfiles: { findFirst: vi.fn() },
      },
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      $count: vi.fn().mockResolvedValue(0),
    };

    mockConfig = {
      get: vi
        .fn()
        .mockImplementation((key: string, fallback?: any) => fallback ?? ''),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getMe ───────────────────────────────────────────────────────────

  describe('getMe()', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      await expect(service.getMe(10)).rejects.toThrow(NotFoundException);
    });

    it('should return user profile without password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(userFixture);
      const result = await service.getMe(10);
      expect(result).not.toHaveProperty('password');
      expect(result.profile).toBeNull();
    });

    it('should return profile fields when profile exists', async () => {
      const withProfile = {
        ...userFixture,
        profile: { bio: 'Hello', website: null, twitter: null, discord: null },
      };
      mockDb.query.users.findFirst.mockResolvedValue(withProfile);
      const result = await service.getMe(10);
      expect(result.profile?.bio).toBe('Hello');
    });
  });

  // ─── getPublicProfile ─────────────────────────────────────────────────

  describe('getPublicProfile()', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      await expect(service.getPublicProfile('uuid-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user is deleted', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        ...userFixture,
        deletedAt: new Date(),
      });
      await expect(service.getPublicProfile('uuid-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return public profile with followsCount', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(userFixture);
      mockDb.select.mockReturnValue(buildChain([{ cnt: 5 }]));

      const result = await service.getPublicProfile('uuid-user');
      expect(result.uuid).toBe('uuid-user');
      expect(result.followsCount).toBe(5);
    });
  });

  // ─── updateProfile ────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      await expect(service.updateProfile(10, { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update name when provided', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(userFixture) // existence check
        .mockResolvedValueOnce(userFixture); // getMe call
      mockDb.update.mockReturnValue(buildChain([]));

      await service.updateProfile(10, { name: 'New Name' });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should insert profile when no existing profile', async () => {
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(userFixture) // existence check
        .mockResolvedValueOnce(userFixture); // getMe call at end
      mockDb.query.userProfiles = {
        findFirst: vi.fn().mockResolvedValue(null),
      };
      mockDb.insert.mockReturnValue(buildChain([]));

      await service.updateProfile(10, { bio: 'Hello world' });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update existing profile', async () => {
      const existingProfile = { userId: 10, bio: 'old' };
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(userFixture)
        .mockResolvedValueOnce(userFixture);
      mockDb.query.userProfiles = {
        findFirst: vi.fn().mockResolvedValue(existingProfile),
      };
      mockDb.update.mockReturnValue(buildChain([]));

      await service.updateProfile(10, { bio: 'New bio' });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ─── listUsers ────────────────────────────────────────────────────────

  describe('listUsers()', () => {
    it('should return paginated users without search', async () => {
      mockDb.select.mockReturnValue(buildChain([{ id: 1 }]));
      mockDb.$count.mockResolvedValue(1);

      const result = await service.listUsers({
        page: 1,
        limit: 20,
        offset: 0,
        search: '',
      } as any);
      expect(result.data).toBeDefined();
      expect(result.page).toBe(1);
    });

    it('should filter by search term', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      mockDb.$count.mockResolvedValue(0);

      const result = await service.listUsers({
        page: 1,
        limit: 20,
        offset: 0,
        search: 'john',
      } as any);
      expect(result.total).toBe(0);
    });
  });

  // ─── getUserById ─────────────────────────────────────────────────────

  describe('getUserById()', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      await expect(service.getUserById(999)).rejects.toThrow(NotFoundException);
    });

    it('should return user without password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(userFixture);
      const result = await service.getUserById(10);
      expect(result).not.toHaveProperty('password');
    });
  });

  // ─── banUser ─────────────────────────────────────────────────────────

  describe('banUser()', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      await expect(
        service.banUser(999, { bannedUntil: '2030-01-01' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should ban user until given date', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(userFixture);
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.banUser(10, {
        bannedUntil: '2030-01-01T00:00:00.000Z',
      });
      expect(result.message).toMatch(/banned until/);
    });

    it('should unban user when no date provided', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(userFixture);
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.banUser(10, {});
      expect(result.message).toBe('User unbanned');
    });
  });

  // ─── deleteUser ───────────────────────────────────────────────────────

  describe('deleteUser()', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      await expect(service.deleteUser(999)).rejects.toThrow(NotFoundException);
    });

    it('should soft delete user', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(userFixture);
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.deleteUser(10);
      expect(result.message).toBe('User deleted');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
