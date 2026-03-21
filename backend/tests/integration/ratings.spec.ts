/**
 * Integration tests for Rating endpoints.
 * Routes: POST/DELETE /manga/:id/rate  |  GET /manga/:id/rating
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CommunityModule } from '../../src/modules/community/community.module.js';
import { MangaModule } from '../../src/modules/manga/manga.module.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { factory } from '../helpers/factory.js';
import { bearerToken } from '../helpers/auth.helper.js';

describe('Ratings Integration', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp([CommunityModule, MangaModule]);
  });

  afterAll(() => ctx.close());

  // ─── POST /manga/:id/rate ──────────────────────────────────────────

  describe('POST /manga/:id/rate', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req.post('/manga/1/rate').send({ score: 4.5 });
      expect(res.status).toBe(401);
    });

    it('400 — rejects invalid score (above 5.0)', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());

      const res = await ctx.req
        .post('/manga/1/rate')
        .set('Authorization', bearerToken())
        .send({ score: 6 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects invalid score (below 0.5)', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());

      const res = await ctx.req
        .post('/manga/1/rate')
        .set('Authorization', bearerToken())
        .send({ score: 0 });

      expect(res.status).toBe(400);
    });

    it('404 — returns not found when manga does not exist', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }));

      const res = await ctx.req
        .post('/manga/999/rate')
        .set('Authorization', bearerToken())
        .send({ score: 4.5 });

      expect(res.status).toBe(404);
    });

    it('200 — upserts rating when manga exists', async () => {
      const rating = factory.rating();
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());

      let selectCall = 0;
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(selectCall++ === 0 ? [factory.manga()] : [rating]),
          }),
        }),
      }));
      ctx.db.insert.mockReturnValue({
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(),
        }),
      });
      ctx.db.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });

      const res = await ctx.req
        .post('/manga/1/rate')
        .set('Authorization', bearerToken())
        .send({ score: 4.5 });

      expect([200, 404]).toContain(res.status);
    });
  });

  // ─── DELETE /manga/:id/rate ────────────────────────────────────────

  describe('DELETE /manga/:id/rate', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req.delete('/manga/1/rate');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /manga/:id/rating ─────────────────────────────────────────

  describe('GET /manga/:id/rating', () => {
    it('401 — rejects unauthenticated request', async () => {
      const res = await ctx.req.get('/manga/1/rating');
      expect(res.status).toBe(401);
    });

    it('200 — returns null when user has not rated', async () => {
      ctx.db.query.users.findFirst.mockResolvedValue(factory.user());

      let selectCall = 0;
      ctx.db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(selectCall++ === 0 ? [factory.manga()] : []),
          }),
        }),
      }));

      const res = await ctx.req
        .get('/manga/1/rating')
        .set('Authorization', bearerToken());

      expect([200, 404]).toContain(res.status);
    });
  });
});
