# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComicHub is a manga/comic reading platform — monorepo with a NestJS backend API and a Next.js 16 frontend.

## Commands

### Backend (`cd backend`)

```bash
pnpm install                  # install deps
pnpm run build                # nest build
pnpm run start:dev            # dev server with watch (port 8080)
pnpm run lint                 # eslint
pnpm run lint:fix             # eslint --fix
pnpm run test                 # vitest run (unit tests)
pnpm run test:watch           # vitest in watch mode
pnpm run test -- src/modules/manga/services/manga.service.spec.ts  # single test file
pnpm run test:cov             # coverage report
pnpm run test:e2e             # e2e tests (separate vitest config)
pnpm run db:generate          # drizzle-kit generate migrations
pnpm run db:migrate           # drizzle-kit apply migrations
pnpm run db:studio            # drizzle-kit studio (DB browser)
pnpm run db:seed              # seed database via tsx
```

### Frontend (`cd frontend`)

```bash
pnpm install
pnpm run dev                  # next dev
pnpm run build                # next build (type-checks included)
```

No lint or test scripts configured in frontend yet.

## Architecture

### Backend (NestJS + Drizzle + PostgreSQL)

- **API prefix**: `/api/v1` — all endpoints are under this prefix
- **Global guards**: `ThrottlerGuard` (60 req/min) and `JwtAuthGuard` applied via `APP_GUARD`. All routes require auth by default; use `@Public()` decorator to opt out.
- **Response envelope**: `TransformInterceptor` wraps all responses in `{ success, data, message }` format
- **Database**: PostgreSQL via Drizzle ORM with `postgres.js` driver. Inject DB with `@Inject(DRIZZLE)` using the `DrizzleDB` type from `drizzle.provider.ts`
- **Schema**: Drizzle schema files in `src/database/schema/` — exported through barrel `index.ts`. Migrations output to `src/database/migrations/`
- **Redis**: Optional — app degrades gracefully via `stubRedisClient()` when unavailable. See caching section below.
- **Auth**: JWT access/refresh tokens + Google OAuth. Refresh tokens dual-written to Redis + `refresh_tokens` DB table (DB fallback when Redis down). JWT payload: `{ sub: number, uuid: string, email: string, role: 'admin' | 'user' }`
- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths)
- **Module resolution**: `nodenext` — all local imports use `.js` extension
- **Test framework**: Vitest with SWC plugin. Test files: `*.spec.ts` co-located with source. Setup: `tests/setup.ts`. Integration tests in `tests/integration/`
- **Manga URLs**: Hybrid shortId-slug format `/manga/{shortId}-{slug}` (e.g., `/manga/ZLYs-one-piece`). Backend: `MangaService.findByIdentifier()` resolves both formats (id-first, slug-fallback). Frontend: `getMangaUrl({ id, slug })` builds URLs. Backward compatible with legacy slug-only URLs.

**Backend modules:**
| Module | Purpose |
|---|---|
| `auth` | JWT auth, Google OAuth, login/register/refresh |
| `user` | User CRUD, profiles, admin user management, reading history |
| `manga` | Manga, chapters, chapter images, artists/authors/genres/groups, view tracking, rankings. `MangaListItem` responses include `shortId: string` field. |
| `community` | Comments, ratings, follows, reports, stickers |
| `search` | Full-text search with query DTOs |
| `notification` | In-app notification events |
| `sitemap` | Static sitemap generation |
| `jobs` | Cron jobs: counter-flush, cache-invalidation, cache-warmup, view-counter-reset |

**Key decorators:**
- `@Public()` — skip JWT auth
- `@CurrentUser()` — extract user from request (or `@CurrentUser('sub')` for specific field)
- `@Roles('admin')` — role-based access
- `@CacheTTL(seconds)` — cache duration for Redis interceptor

### Caching

**3-layer cache: HTTP interceptor → Redis service cache → in-memory (taxonomy only)**

- `RedisCacheInterceptor` caches public GET responses (skips authenticated users). Key: `cache:<url>`, TTL via `@CacheTTL(seconds)`.
- `REDIS_AVAILABLE` token (inject `RedisStatus`) — check `redisStatus.available` before Redis-dependent logic.
- View tracking: Redis up → buffer in Redis (flushed by `CounterFlushJob` every 5 min). Redis down → direct DB `sql\`views + 1\`` increment.
- `TaxonomyService` has in-memory `Map` cache (10 min TTL, 100 max entries) — benefits authenticated users who bypass HTTP cache.
- Cache invalidation: event-driven (`chapter.created`, `manga.updated`) + cron-based (`rankings:*` every 5 min).

**When adding new features:**
- New public GET endpoint → add `@CacheTTL(seconds)` + `@UseInterceptors(RedisCacheInterceptor)` if data is not realtime
- New service using Redis → inject `REDIS_AVAILABLE` if fallback behavior is needed when Redis is down
- New frontend page with stable data → add `export const revalidate = seconds` for ISR
- No caching needed for: authenticated-only endpoints, admin endpoints, realtime data (chat, notifications)

**Current TTLs:** manga 180s, ranking 300s, search 120s, taxonomy 600s, stats 3600s, ranking service 900s. Homepage ISR 180s, detail page ISR 300s.

### Frontend (Next.js 16 + Tailwind CSS v4 + Radix UI)

- **Next.js 16** with App Router — check `node_modules/next/dist/docs/` for API changes from training data
- **UI components**: Radix UI primitives + custom Tailwind styling. Shared UI in `components/ui/`. See `docs/design-guidelines.md` for full spec.
- **Forms**: zod + react-hook-form for validation. All forms must use zod schemas.
- **Toasts**: sonner — use `toast.success()` / `toast.error()` for transient feedback. Never `alert()`.
- **Design**: Dark-only theme. Rajdhani headings, Inter body. Color tokens as Tailwind theme classes — never hardcode hex.
- **API client**: `lib/api-client.ts` — axios instance with auto JWT refresh queue and response envelope unwrapping
- **Auth state**: React Context (`contexts/auth.context.tsx`) with `useAuth` hook
- **API URL**: `NEXT_PUBLIC_API_URL` env var, defaults to `http://localhost:8080/api/v1`
- **Images**: S3 remote patterns configured for amazonaws.com

### Environment Variables

Backend requires: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. Optional: `REDIS_URL`, `AWS_S3_*`, `GOOGLE_CLIENT_*`. See `backend/.env.example`.

Frontend requires: `NEXT_PUBLIC_API_URL`.
