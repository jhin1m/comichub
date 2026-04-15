# ComicHub Project Changelog

All notable changes to the ComicHub project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
