# ComicHub Project Changelog

All notable changes to the ComicHub project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
