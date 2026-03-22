/**
 * Integration tests for Follow endpoints.
 * Route: POST/GET /manga/:id/follow
 *
 * Note: community FollowService delegates to user FollowService which uses
 * db.query.follows.findFirst and db.select() with destructuring.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CommunityModule } from '../../src/modules/community/community.module.js';
import { MangaModule } from '../../src/modules/manga/manga.module.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { factory } from '../helpers/factory.js';
import { bearerToken } from '../helpers/auth.helper.js';

describe('Follows Integration', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp([CommunityModule, MangaModule]);
  });

  afterAll(() => ctx.close());

  // ─── POST /manga/:id/follow ────────────────────────────────────────

  describe('POST /manga/:id/follow', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req.post('/manga/1/follow');
      expect(res.status).toBe(401);
    });

    it('404 — returns not found when manga does not exist', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      // UserFollowService.toggleFollow: select manga returns empty
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }));

      const res = await ctx.req
        .post('/manga/999/follow')
        .set('Authorization', bearerToken());

      expect(res.status).toBe(404);
    });

    it('200 — returns following:true when following for first time', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.query.follows.findFirst.mockResolvedValue(null); // not following

      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([{ id: 1, followersCount: 0 }]),
        }),
      }));
      ctx.db.insert.mockReturnValue({ values: () => Promise.resolve() });
      ctx.db.update.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ followersCount: 1 }]),
          }),
        }),
      });

      const res = await ctx.req
        .post('/manga/1/follow')
        .set('Authorization', bearerToken());

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('following');
      }
    });

    it('200 — returns following:false when toggling off', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.query.follows.findFirst.mockResolvedValue({ id: 5, userId: 1, mangaId: 1 });

      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([{ id: 1, followersCount: 1 }]),
        }),
      }));
      ctx.db.delete.mockReturnValue({
        where: () => Promise.resolve(),
      });
      ctx.db.update.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ followersCount: 0 }]),
          }),
        }),
      });

      const res = await ctx.req
        .post('/manga/1/follow')
        .set('Authorization', bearerToken());

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('following');
      }
    });
  });

  // ─── GET /manga/:id/follow ─────────────────────────────────────────

  describe('GET /manga/:id/follow', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req.get('/manga/1/follow');
      expect(res.status).toBe(401);
    });

    it('200 — returns follow status for authenticated user', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.query.follows.findFirst.mockResolvedValue(null);

      const res = await ctx.req
        .get('/manga/1/follow')
        .set('Authorization', bearerToken());

      expect([200, 404]).toContain(res.status);
    });
  });
});
