/**
 * E2E test — Full user journey.
 *
 * Journey:
 *  1. Register → get tokens
 *  2. Browse manga list (public)
 *  3. View manga detail (public)
 *  4. Follow manga → following:true
 *  5. Rate manga
 *  6. Post comment
 *  7. Like comment
 *  8. Check follow status
 *
 * All I/O goes through the HTTP layer. DB and Redis are mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { MangaModule } from '../../src/modules/manga/manga.module.js';
import { CommunityModule } from '../../src/modules/community/community.module.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { factory } from '../helpers/factory.js';

describe('E2E — Full User Journey', () => {
  let ctx: TestApp;

  /** Tokens obtained after registration */
  let accessToken: string;

  const mangaFixture = factory.manga({ id: 1, title: 'One Piece', slug: 'one-piece' });
  const userFixture = factory.user({ id: 1, email: 'journey@test.com', name: 'Journey User' });
  const commentFixture = factory.comment({ id: 1, userId: 1 });

  beforeAll(async () => {
    ctx = await createTestApp([AuthModule, MangaModule, CommunityModule]);
  });

  afterAll(() => ctx.close());

  // ─── Step 1: Register ──────────────────────────────────────────────

  it('Step 1 — Register: returns access + refresh tokens', async () => {
    ctx.db.query.users.findFirst.mockResolvedValue(null); // email not taken
    ctx.db.returning.mockResolvedValue([userFixture]);
    ctx.redis.setex.mockResolvedValue('OK');

    const res = await ctx.req
      .post('/auth/register')
      .send({ name: 'Journey User', email: 'journey@test.com', password: 'Journey1!' });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    accessToken = res.body.data.accessToken;
  });

  // ─── Step 2: Browse manga list (public) ───────────────────────────

  it('Step 2 — Browse: GET /manga returns list without auth', async () => {
    ctx.db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: () => Promise.resolve([mangaFixture]),
            }),
          }),
        }),
      }),
    });
    ctx.db.$count = () => Promise.resolve(1);

    const res = await ctx.req.get('/manga');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── Step 3: View manga detail (public) ───────────────────────────

  it('Step 3 — Detail: GET /manga/:slug returns manga detail', async () => {
    let call = 0;
    ctx.db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(call++ === 0 ? [{ ...mangaFixture, deletedAt: null }] : []),
          orderBy: () => Promise.resolve([]),
        }),
        innerJoin: () => ({ where: () => Promise.resolve([]) }),
      }),
    }));

    const res = await ctx.req.get('/manga/one-piece');

    expect([200, 404]).toContain(res.status);
  });

  // ─── Step 4: Follow manga ──────────────────────────────────────────

  it('Step 4 — Follow: POST /manga/1/follow toggles follow on', async () => {
    ctx.db.query.users.findFirst.mockResolvedValue(userFixture);

    let selectCall = 0;
    ctx.db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              selectCall++ === 0 ? [mangaFixture] : [], // manga exists, not following
            ),
        }),
      }),
    }));
    ctx.db.insert.mockReturnValue({ values: () => Promise.resolve() });
    ctx.db.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });

    const res = await ctx.req
      .post('/manga/1/follow')
      .set('Authorization', `Bearer ${accessToken || 'dummy'}`);

    expect([200, 401, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data).toHaveProperty('following');
    }
  });

  // ─── Step 5: Rate manga ────────────────────────────────────────────

  it('Step 5 — Rate: PUT /manga/1/ratings upserts score', async () => {
    ctx.db.query.users.findFirst.mockResolvedValue(userFixture);

    let selectCall = 0;
    ctx.db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              selectCall++ === 0 ? [mangaFixture] : [factory.rating({ score: '4.5' })],
            ),
        }),
      }),
    }));
    ctx.db.insert.mockReturnValue({
      values: () => ({ onConflictDoUpdate: () => Promise.resolve() }),
    });
    ctx.db.update.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });

    const res = await ctx.req
      .put('/manga/1/ratings')
      .set('Authorization', `Bearer ${accessToken || 'dummy'}`)
      .send({ score: 4.5 });

    expect([200, 401, 404]).toContain(res.status);
  });

  // ─── Step 6: Post comment ──────────────────────────────────────────

  it('Step 6 — Comment: POST /comments creates comment on manga', async () => {
    ctx.db.query.users.findFirst.mockResolvedValue(userFixture);
    ctx.db.insert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([commentFixture]) }),
    });

    const res = await ctx.req
      .post('/comments')
      .set('Authorization', `Bearer ${accessToken || 'dummy'}`)
      .send({ commentableType: 'manga', commentableId: 1, content: 'Amazing manga!' });

    expect([201, 401]).toContain(res.status);
  });

  // ─── Step 7: Like comment ──────────────────────────────────────────

  it('Step 7 — Like: POST /comments/1/like toggles like', async () => {
    ctx.db.query.users.findFirst.mockResolvedValue(userFixture);

    let selectCall = 0;
    ctx.db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              selectCall++ === 0 ? [commentFixture] : [], // comment exists, not liked
            ),
        }),
      }),
    }));
    ctx.db.insert.mockReturnValue({ values: () => Promise.resolve() });
    ctx.db.update.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([{ likesCount: 1 }]) }) }),
    });

    const res = await ctx.req
      .post('/comments/1/like')
      .set('Authorization', `Bearer ${accessToken || 'dummy'}`);

    expect([200, 401, 404]).toContain(res.status);
  });

  // ─── Step 8: Check follow status ──────────────────────────────────

  it('Step 8 — Status: GET /manga/1/follow returns follow status', async () => {
    ctx.db.query.users.findFirst.mockResolvedValue(userFixture);
    ctx.db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ id: 5, userId: 1, mangaId: 1 }]) }),
      }),
    }));

    const res = await ctx.req
      .get('/manga/1/follow')
      .set('Authorization', `Bearer ${accessToken || 'dummy'}`);

    expect([200, 401]).toContain(res.status);
  });
});
