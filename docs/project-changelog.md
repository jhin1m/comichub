# ComicHub Project Changelog

All notable changes to the ComicHub project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed - Comment Section: SWR Migration + Optimistic Post/Delete (2026-05-03)
- **SWR cache layer**: `comment-section.tsx` migrated from manual `useState`+`useEffect`+`fetchComments` to `useSWR<PaginatedComments>` gated on `!authLoading`. Cache hits on back-nav between mangas/chapters within `dedupingInterval` (60s).
- **SWR keys registry**: Added `commentListKey(type, id, page, limit, sort)` to `frontend/lib/swr/swr-keys.ts`. Default fetcher (`apiClient.get`) resolves URL-as-key directly.
- **Optimistic post**: Comment renders instantly via `mutate(...)` `optimisticData` + `populateCache: true` + `rollbackOnError`. Forces `sort=newest` + `page=1` BEFORE the optimistic write so the placeholder lands in the next-render's cache slot. Negative timestamp ID for placeholder avoids collision with PG serial PK.
- **Optimistic delete**: Comment disappears instantly; rollback restores it on API failure. Top-level uses SWR `mutate` cache mutation; replies use local-state snapshot rollback in `comment-reply-thread.tsx`.
- **Reply submission lifted**: `comment-item.tsx` no longer calls the API directly — it emits `onReplyPosted` upward. Top-level replies handled by section; nested replies handled by thread (with local optimistic insert + rollback).
- **Files**: `frontend/lib/swr/swr-keys.ts`, `frontend/components/comment/{comment-section,comment-item,comment-reply-thread}.tsx`, NEW `frontend/components/comment/comment-section.spec.tsx` (9 tests).
- **Tests**: 154/154 unit pass; `pnpm run build` clean. Code review 9.6/10.
- **Scope**: Frontend-only refactor; no API/schema changes.

### Added - Reader Bars Tap-Toggle + First-time Tip (2026-05-03)
- **Mobile-only UX**: Tap anywhere on chapter images to toggle top/bottom control bars (bars auto-hide on scroll remains disabled on mobile)
- **Unified Touch Handler**: New `useReaderTapToggle` hook distinguishes tap (bar toggle) from swipe (page pagination in manual mode). Swipe min threshold 50px; tap max duration 250ms
- **First-time Tip**: Sonner toast shows "💡 Tip: Tap the image to hide/show the control bar." (Vietnamese: "Tap image to show/hide control bars") on first visit to reader on mobile, persisted via `localStorage` key `comichub:reader-tap-tip-seen`
- **Files**: NEW `frontend/hooks/use-reader-tap-toggle.ts`, modified `chapter-reader.tsx`, `reader-top-bar.tsx`, `reader-bottom-bar.tsx`, `reader-zoom-controls.tsx`
- **Scope**: Pure UX gesture; no API/schema/backend changes. Mobile-only (≤768px)

### Restored - Homepage ISR after Blank-Page Hardening (2026-04-23)
- **Change**: `frontend/app/page.tsx` switched from `export const dynamic = 'force-dynamic'` back to `export const revalidate = 180`. Not a revert — all safety nets from 2026-04-20 remain in place.
- **Safety Net #1 (already in place, commit `1a8ff960`)**: Critical fetches (rankings, manga lists) re-throw on error and hit `error.tsx`. Only decoration fetches (comments, genres, stats) still use `.catch(() => [])`.
- **Safety Net #2 (new)**: `frontend/Dockerfile` no longer sets `INTERNAL_API_URL` at build time — `backend:3001` doesn't resolve outside the compose network. Build falls back to public `NEXT_PUBLIC_API_URL` (Caddy), reachable because `deploy.sh` builds while the old backend container is still running. Runtime SSR still uses `INTERNAL_API_URL` via compose `environment:`.
- **Impact**: First-byte TTFB for cached responses back to ~60-100ms (vs ~800ms dynamic). Response headers carry `cache-control: s-maxage=180, stale-while-revalidate=...` again. `next build` output shows `○ /` with `Revalidate 3m`.
- **Docs**: `deployment-guide.md` + `code-standards.md` + `system-architecture.md` updated — old ISR bug now documented as historical context explaining why both invariants are required together.

### Fixed - Homepage Skeleton Flash for Logged-In Users (2026-04-22)
- **Backend**: `/auth/me` now returns `hasHistory` and `hasBookmark` boolean flags via efficient EXISTS-style lookups (sub-millisecond cost)
- **Frontend SWR Layer**: Added sessionStorage persistence scoped by userId with SWR 2.4.1. `continue-reading-strip` and `follow-list-strip` refactored into shared `MediaStrip` component using SWR; new users render nothing (no skeleton), returning users render instantly from cache
- **Cache Invalidation**: Wired centralized `SWR_KEYS` across 7 mutation sites (follow-button, quick-bookmark-button, bookmark-table/list, history-tab, chapter-list, chapter-reader) with client-side flag flip on first read/bookmark (no refetch required)
- **Impact**: Zero skeleton blink on nav or initial page load for users with reading history or bookmarks

### Optimized - Docker Build pnpm Cache Mount (2026-04-20)
- **Root Cause**: Dockerfiles ran `pnpm install --frozen-lockfile` without BuildKit cache mount → every rebuild re-fetched all packages from registry, ignoring pnpm's content-addressable store advantage
- **Change**: Added `# syntax=docker/dockerfile:1.7` directive + `RUN --mount=type=cache,id=pnpm,target=/pnpm/store` with `pnpm config set store-dir /pnpm/store` to both `backend/Dockerfile` (deps + production stages) and `frontend/Dockerfile` (deps stage)
- **Impact**: ~20% faster rebuilds even with `--no-cache` (65s → 52s on backend deps stage). Larger speedup (3-5x) expected when only package.json/lock changes and layer cache busts but store cache survives
- **Compatibility**: Zero config required — BuildKit default on Docker 23+ and Compose v2. No action for deploy.sh or CI

### Fixed - Blank Website After Deploy (2026-04-20)
- **Root Cause**: Next.js ISR build-time static prerender fails when backend unavailable (Docker build stage, cold-start). `.catch(() => [])` silently baked empty page into ISR cache for 180s, affecting all users
- **Backend Readiness Gate**: Implemented `ReadinessService` singleton + `onApplicationBootstrap` hook + `finally { setReady() }` pattern. Health endpoint `/api/v1/health` returns `503 Service Unavailable` until warmup completes
- **Caddy Health Check**: Configured active health probing (5s interval, 30s fail_duration). Excludes unhealthy upstream during warmup window (~5-10s)
- **Frontend Dynamic Rendering**: Removed `revalidate = 180` ISR from homepage; switched to `export const dynamic = 'force-dynamic'` to fetch live data each request. Removed `.catch(() => [])` from 5 critical APIs (rankings, manga lists) to fail-fast instead of hiding blank page. Kept catch for decoration APIs (comments, genres, stats)
- **Docs**: Updated deployment-guide.md with zero-downtime pattern explanation; added code-standards.md rule about ISR vs dynamic rendering trade-offs

### Added - Comix.to Import Campaign Infrastructure (2026-04-15)
- **Backend Scripts**: Created `scrapfly-fetch.ts` anti-scraping proxy wrapper (opt-in via USE_SCRAPFLY=1)
- **Import Robustness**: Added configurable random jitter (400-1200ms) to `throttledFetch` and `signedFetch`, replacing fixed 250ms throttle. Backward compatible — other import sources default to 250ms
- **Checkpoint System**: Added atomic persistent checkpoint tracking (`--checkpoint-file`, `--reset-checkpoint` flags) enabling safe resume across container restarts
- **Health Checks**: Pre-flight API/signing-module validation with 3 retries + exponential backoff, per-batch re-checks (configurable)
- **Deployment Tooling**: 
  - `import-campaign.sh` — orchestrates 15-20 day batch import with configurable phase ranges, cooldowns, Telegram notifications, health gating, disk monitoring
  - `comix-campaign.conf` — phase configuration (batch ranges, step sizes, cooldowns)
  - `import-daily-cron.sh` — incremental daily import wrapper (runs after campaign completes)
  - `import-progress.sh` — DB progress monitoring (manga/chapter/image counts from comix source)
  - `import-health-check.sh` — cron health monitor (error tracking, stuck detection, disk/DB connectivity)
  - `telegram-notify.sh` — Telegram alert helper (graceful silent-fail if token missing)
- **Database**: Verified all critical indexes present (`chapter_images`, `chapter_sources`, `manga_sources`) — no migrations needed
- **Environment**: Added to `.env.deploy.example`: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, USE_SCRAPFLY, SCRAPFLY_KEY
- **Dependencies**: Added `scrapfly-sdk@^0.9.0` to backend devDependencies

### Added - Forgot Password + Cloudflare Turnstile (2026-04-02)
- **Backend Auth**: Implemented password reset flow with 15min expiring tokens stored hashed in Redis, email delivery via Resend SMTP with nodemailer
- **Backend Security**: Added Cloudflare Turnstile bot protection guard to login/register/forgot-password/reset-password endpoints with graceful dev-mode bypass
- **Backend Endpoints**: Created POST `/auth/forgot-password` (generic response prevents email enumeration) and POST `/auth/reset-password` (single-use token validation)
- **Frontend Auth**: Created `/forgot-password` page for email submission and `/reset-password?token=xxx` page for password reset with URL token extraction
- **Frontend Components**: Integrated Turnstile widget into login/register forms and new password reset forms with auto-reset after submission
- **Email Integration**: Configured SMTP vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM) for Resend SMTP provider
- **UX**: Added "Forgot password?" link to login page, success states show confirmation message instead of redirect, error handling with inline messages
- **Security**: Token hashed with SHA256 before Redis storage, bcrypt password hashing (12 rounds), refresh token revocation on password change, rate limiting (3 forgot/10min, 5 reset/10min)

### Added - Manga Card Badge System (2026-03-31)
- **Backend**: Added `contentRating` and `isHot` fields to `MangaListItem` return type across 4 list query endpoints: `findAll()`, `findMangaByGroup()`, `getHotManga()`, `queryRanking()`, and search endpoint `searchManga()`
- **Frontend**: Implemented priority-based badge system on manga cards with max 2 badges: Content Rating (18+/S) > HOT > NEW (7 days) > Status (END/HIATUS/DROP)
- **Styling**: Stacked badge layout (top-left, vertical), color-coded by priority (red/warning/success/info), uppercase labels, Rajdhani font
- **Backward Compatibility**: Badge logic handles undefined fields gracefully during cache expiration periods

### Changed - Content Rating Unification (2026-03-31)
- **Unification**: Migrated from dual `isNsfw` boolean + `contentRating` enum to single source of truth: `contentRating`
- **Normalizer**: Created centralized `normalizeContentRating()` utility in `backend/src/common/utils/content-rating.util.ts`
- **Import Adapters**: Updated MangaBaka, WeebDex adapters and legacy scripts (comix, weebdex, mangabaka, import-utils) to use shared normalizer
- **Backend Filtering**: Replaced `isNsfw` boolean filters with `contentRating` enum checks (`notInArray(contentRating, NSFW_RATINGS)`)
- **Default Value**: Changed `contentRating` default from `'safe'` to `'suggestive'` (conservative fallback for missing source data)
- **NSFW Mapping**: Updated Comix `is_nsfw: true` mapping from `'suggestive'` to `'erotica'` for correct filtering
- **Frontend Types**: Updated `MangaDetail` type: `isNsfw: boolean` → `contentRating: 'safe'|'suggestive'|'erotica'|'pornographic'`
- **Database**: Dropped `isNsfw` column (migration 0014), backfilled existing data into `contentRating`
- **API Filters**: Added NSFW filtering to `findRandom` endpoint, aligned all list/detail endpoints to use contentRating
- **Post-Review Fixes**: Aligned default values across normalizer/importer/DTO, fixed NSFW true→erotica mapping, removed unnecessary spreads

### Added - Frontend Testing Infrastructure
- **Vitest** unit & component test runner with happy-dom environment
- **Testing Library** for React component testing with accessible queries
- **MSW v2** for network-level API mocking (https://mswjs.io)
- **Playwright** E2E tests for 4 critical user journeys (auth, reading, interaction, profile)
- Co-located test files (`*.spec.ts` / `*.spec.tsx`) matching backend convention
- 137 Vitest tests across 29 test files (5.1s runtime)
- 14 Playwright E2E tests across 4 spec files (runnable with backend)
- Test coverage: `lib/` 93%, `contexts/` 83%, `hooks/` 62%, components partial
- Key coverage areas: utils 100%, notification-grouping 100%, api-client 87%, auth-context 90%
- Test infrastructure includes:
  - `vitest.config.ts` with v8 coverage provider
  - `tests/setup.ts` with global MSW + cleanup lifecycle
  - `tests/mocks/handlers.ts` with 6 API endpoint mocks
  - `tests/mocks/next-*.ts` for Next.js module mocking
  - `tests/test-utils.tsx` with provider wrapper utility
  - `playwright.config.ts` with chromium + HTML reporting

**Test Commands:**
- `pnpm test` — Run all unit + component tests (Vitest)
- `pnpm test:watch` — Watch mode for TDD
- `pnpm test:cov` — Coverage report with v8 provider
- `pnpm test:e2e` — Run E2E tests (requires running frontend + backend)
- `pnpm test:e2e:ui` — E2E tests in Playwright UI mode

**Coverage Targets Met:**
- `lib/` 93% (utils, api-client, notification-grouping, notification-types)
- `contexts/` 83% (auth-context, preferences-context)
- `hooks/` 62% (use-auth, use-preferences-params, use-notification-stream)

**Phase Completion:**
- Phase 01: Test Infrastructure Setup ✅
- Phase 02: Unit Tests (90 tests, ~15s) ✅
- Phase 03: Component Integration Tests (63 tests) ✅
- Phase 04: E2E Playwright Tests (15 tests, requires backend) ✅

---

## [Previous Releases - Placeholder]

### 2026-03-26
- Backend: Comprehensive codebase review (42 issues resolved)
- Backend: Preferences optimization (skip PUT/GET on reload for logged-in users)
- Backend: Comic import module with source tracking schema
- Frontend: Lazy search for artists/authors instead of bulk fetch
- Backend: Real-time SSE notification system
