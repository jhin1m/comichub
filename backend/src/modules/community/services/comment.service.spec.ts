import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentService } from './comment.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'set',
    'update',
    'insert',
    'values',
    'delete',
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const baseComment = {
  id: 1,
  userId: 10,
  commentableType: 'manga',
  commentableId: 1,
  parentId: null,
  content: 'Great manga!',
  likesCount: 0,
  depth: 0,
  deletedAt: null,
};

describe('CommentService', () => {
  let service: CommentService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: EventEmitter2, useValue: { emit: vi.fn() } },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── create ────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a top-level manga comment', async () => {
      const created = { ...baseComment, id: 5 };
      mockDb.insert.mockReturnValue(buildChain([created]));

      const result = await service.create(10, {
        commentableType: 'manga' as any,
        commentableId: 1,
        content: 'Great manga!',
      });

      expect(result).toMatchObject({ id: 5, content: 'Great manga!' });
      expect(mockDb.insert).toHaveBeenCalledOnce();
    });

    it('should throw BadRequestException when nesting exceeds MAX_DEPTH (3)', async () => {
      // validateDepth now uses db.execute with a recursive CTE
      mockDb.execute = vi.fn().mockResolvedValue([{ depth: 3 }]);

      await expect(
        service.create(10, {
          commentableType: 'manga' as any,
          commentableId: 1,
          content: 'Too deep',
          parentId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when comment does not exist', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(
        service.update(999, 10, { content: 'edit' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own comment', async () => {
      mockDb.select.mockReturnValue(
        buildChain([{ ...baseComment, userId: 99 }]),
      );

      await expect(service.update(1, 10, { content: 'edit' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should update comment content when user owns it', async () => {
      const updated = { ...baseComment, content: 'edited content' };
      mockDb.select.mockReturnValue(buildChain([baseComment]));
      mockDb.update.mockReturnValue(buildChain([updated]));

      const result = await service.update(1, 10, { content: 'edited content' });
      expect(result.content).toBe('edited content');
    });
  });

  // ─── remove ────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when comment not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.remove(999, 10, 'user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when non-owner non-admin tries to delete', async () => {
      mockDb.select.mockReturnValue(
        buildChain([{ ...baseComment, userId: 99 }]),
      );

      await expect(service.remove(1, 10, 'user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft-delete comment when user is owner', async () => {
      mockDb.select.mockReturnValue(buildChain([baseComment]));
      mockDb.update.mockReturnValue(buildChain([]));

      await expect(service.remove(1, 10, 'user')).resolves.not.toThrow();
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it('should allow admin to delete any comment', async () => {
      mockDb.select.mockReturnValue(
        buildChain([{ ...baseComment, userId: 99 }]),
      );
      mockDb.update.mockReturnValue(buildChain([]));

      await expect(service.remove(1, 10, 'admin')).resolves.not.toThrow();
    });
  });

  // ─── toggleLike ────────────────────────────────────────────────────

  describe('toggleLike()', () => {
    it('should throw NotFoundException when comment does not exist', async () => {
      mockDb.select.mockReturnValue(buildChain([]));

      await expect(service.toggleLike(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should add like when user has not liked yet', async () => {
      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([baseComment]); // findOrFail
        if (selectCall === 2) return buildChain([]); // no existing reaction
        return buildChain([{ likesCount: 1, dislikesCount: 0 }]); // final counts
      });
      mockDb.insert.mockReturnValue(buildChain([]));
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.toggleLike(1, 10);
      expect(result.liked).toBe(true);
      expect(result.likesCount).toBe(1);
    });

    it('should remove like when user has already liked', async () => {
      const existingLike = {
        id: 5,
        userId: 10,
        commentId: 1,
        isDislike: false,
      };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return buildChain([baseComment]); // findOrFail
        if (selectCall === 2) return buildChain([existingLike]); // existing like
        return buildChain([{ likesCount: 0, dislikesCount: 0 }]); // final counts
      });
      mockDb.delete.mockReturnValue(buildChain([]));
      mockDb.update.mockReturnValue(buildChain([]));

      const result = await service.toggleLike(1, 10);
      expect(result.liked).toBe(false);
    });
  });
});
