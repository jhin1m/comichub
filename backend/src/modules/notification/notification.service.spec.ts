import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { DiscordWebhookService } from './discord/discord-webhook.service.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';

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
  ].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const notifFixture = {
  id: 'uuid-1',
  notifiableType: 'user',
  notifiableId: 10,
  type: 'chapter.created',
  data: {},
  readAt: null,
  createdAt: new Date(),
};

describe('NotificationService', () => {
  let service: NotificationService;
  let mockDb: any;
  let mockDiscord: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        notifications: { findFirst: vi.fn() },
      },
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockDiscord = { sendNewChapter: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: DiscordWebhookService, useValue: mockDiscord },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── createForFollowers ────────────────────────────────────────────

  describe('createForFollowers()', () => {
    it('should skip insert when no followers', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await service.createForFollowers({
        mangaId: 1,
        mangaTitle: 'Test',
        chapterId: 5,
        chapterNumber: '1',
        mangaCover: null,
      });

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should insert notifications for each follower', async () => {
      mockDb.select.mockReturnValue(
        buildChain([{ userId: 10 }, { userId: 20 }]),
      );
      mockDb.insert.mockReturnValue(buildChain([]));

      await service.createForFollowers({
        mangaId: 1,
        mangaTitle: 'One Piece',
        chapterId: 5,
        chapterNumber: '100',
        mangaCover: null,
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
    });
  });

  // ─── createSingle ──────────────────────────────────────────────────

  describe('createSingle()', () => {
    it('should insert a single notification', async () => {
      mockDb.insert.mockReturnValue(buildChain([]));

      await service.createSingle(10, 'comment.replied', { commentId: 1 });

      expect(mockDb.insert).toHaveBeenCalledOnce();
    });
  });

  // ─── list ──────────────────────────────────────────────────────────

  describe('list()', () => {
    it('should return paginated notifications', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([{ cnt: 2 }]); // count
        return buildChain([notifFixture]); // rows
      });

      const result = await service.list(10, {
        page: 1,
        limit: 20,
        type: undefined,
      } as any);

      expect(result.data).toBeDefined();
      expect(result.page).toBe(1);
    });

    it('should filter by type when provided', async () => {
      mockDb.select.mockReturnValue(buildChain([{ cnt: 0 }]));

      const result = await service.list(10, {
        page: 1,
        limit: 20,
        type: 'chapter.created',
      } as any);

      expect(result.total).toBe(0);
    });
  });

  // ─── getUnreadCount ────────────────────────────────────────────────

  describe('getUnreadCount()', () => {
    it('should return count of unread notifications', async () => {
      mockDb.select.mockReturnValue(buildChain([{ cnt: 5 }]));

      const result = await service.getUnreadCount(10);

      expect(result.count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      const result = await service.getUnreadCount(10);

      expect(result.count).toBe(0);
    });
  });

  // ─── markRead ──────────────────────────────────────────────────────

  describe('markRead()', () => {
    it('should throw NotFoundException when notification not found', async () => {
      mockDb.query.notifications.findFirst.mockResolvedValue(null);

      await expect(service.markRead(10, 'uuid-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when notification belongs to another user', async () => {
      mockDb.query.notifications.findFirst.mockResolvedValue({
        ...notifFixture,
        notifiableId: 99,
      });

      await expect(service.markRead(10, 'uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should mark notification as read', async () => {
      mockDb.query.notifications.findFirst.mockResolvedValue(notifFixture);
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.markRead(10, 'uuid-1');
      expect(result.message).toBe('Marked as read');
    });
  });

  // ─── markAllRead ───────────────────────────────────────────────────

  describe('markAllRead()', () => {
    it('should mark all notifications as read', async () => {
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.markAllRead(10);
      expect(result.message).toBe('All notifications marked as read');
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  // ─── delete ────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('should throw NotFoundException when notification not found', async () => {
      mockDb.query.notifications.findFirst.mockResolvedValue(null);

      await expect(service.delete(10, 'uuid-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ForbiddenException for another user's notification", async () => {
      mockDb.query.notifications.findFirst.mockResolvedValue({
        ...notifFixture,
        notifiableId: 99,
      });

      await expect(service.delete(10, 'uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete notification and return message', async () => {
      mockDb.query.notifications.findFirst.mockResolvedValue(notifFixture);
      mockDb.delete.mockReturnValue(buildChain([]));

      const result = await service.delete(10, 'uuid-1');
      expect(result.message).toBe('Notification deleted');
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });
  });

  // ─── Event handlers ────────────────────────────────────────────────

  describe('handleNewChapter()', () => {
    it('should call createForFollowers and discord.sendNewChapter', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await service.handleNewChapter({
        mangaId: 1,
        mangaTitle: 'Test',
        chapterId: 5,
        chapterNumber: '1',
        mangaCover: null,
      });

      expect(mockDiscord.sendNewChapter).toHaveBeenCalledOnce();
    });
  });
});
