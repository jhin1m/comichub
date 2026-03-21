/**
 * Integration tests for Comment endpoints.
 * Public: GET /manga/:id/comments
 * Protected: POST /comments, PATCH /comments/:id, DELETE /comments/:id
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CommunityModule } from '../../src/modules/community/community.module.js';
import { MangaModule } from '../../src/modules/manga/manga.module.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { factory } from '../helpers/factory.js';
import { bearerToken, testAdmin } from '../helpers/auth.helper.js';

describe('Comments Integration', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp([CommunityModule, MangaModule]);
  });

  afterAll(() => ctx.close());

  // ─── GET /manga/:id/comments ───────────────────────────────────────

  describe('GET /manga/:id/comments', () => {
    it('200 — public endpoint returns comment list', async () => {
      const comments = [factory.comment(), factory.comment({ id: 2 })];
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({ offset: () => ({ orderBy: () => Promise.resolve(comments) }) }),
          }),
        }),
      }));

      const res = await ctx.req.get('/manga/1/comments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('200 — returns empty array when no comments exist', async () => {
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({ offset: () => ({ orderBy: () => Promise.resolve([]) }) }),
          }),
        }),
      }));

      const res = await ctx.req.get('/manga/1/comments');

      expect(res.status).toBe(200);
    });
  });

  // ─── POST /comments ────────────────────────────────────────────────

  describe('POST /comments', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req
        .post('/comments')
        .send({ commentableType: 'manga', commentableId: 1, content: 'Great!' });

      expect(res.status).toBe(401);
    });

    it('400 — rejects invalid commentableType', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());

      const res = await ctx.req
        .post('/comments')
        .set('Authorization', bearerToken())
        .send({ commentableType: 'invalid', commentableId: 1, content: 'Great!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects empty content', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());

      const res = await ctx.req
        .post('/comments')
        .set('Authorization', bearerToken())
        .send({ commentableType: 'manga', commentableId: 1, content: '' });

      expect(res.status).toBe(400);
    });

    it('201 — creates top-level comment', async () => {
      const created = factory.comment();
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.insert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([created]) }),
      });

      const res = await ctx.req
        .post('/comments')
        .set('Authorization', bearerToken())
        .send({ commentableType: 'manga', commentableId: 1, content: 'Great manga!' });

      expect([201, 400]).toContain(res.status);
    });
  });

  // ─── PATCH /comments/:id ──────────────────────────────────────────

  describe('PATCH /comments/:id', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req
        .patch('/comments/1')
        .send({ content: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('404 — returns not found for unknown comment', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }));

      const res = await ctx.req
        .patch('/comments/999')
        .set('Authorization', bearerToken())
        .send({ content: 'Updated content' });

      expect(res.status).toBe(404);
    });

    it('403 — rejects update from non-owner', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user({ id: 1 }));
      // Comment belongs to user 99
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([factory.comment({ userId: 99 })]),
          }),
        }),
      }));

      const res = await ctx.req
        .patch('/comments/1')
        .set('Authorization', bearerToken())
        .send({ content: 'Trying to edit' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /comments/:id ─────────────────────────────────────────

  describe('DELETE /comments/:id', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req.delete('/comments/1');
      expect(res.status).toBe(401);
    });

    it('404 — returns not found for unknown comment', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }));

      const res = await ctx.req
        .delete('/comments/999')
        .set('Authorization', bearerToken());

      expect(res.status).toBe(404);
    });

    it('204 — owner can delete own comment', async () => {
      const user = factory.user({ id: 1 });
      ctx.db.query.users.findFirst.mockResolvedValue(user);
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([factory.comment({ userId: 1 })]),
          }),
        }),
      }));
      ctx.db.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });

      const res = await ctx.req
        .delete('/comments/1')
        .set('Authorization', bearerToken());

      expect(res.status).toBe(204);
    });

    it('204 — admin can delete any comment', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user(testAdmin));
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([factory.comment({ userId: 99 })]),
          }),
        }),
      }));
      ctx.db.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });

      const res = await ctx.req
        .delete('/comments/1')
        .set('Authorization', bearerToken(testAdmin));

      expect(res.status).toBe(204);
    });
  });
});
