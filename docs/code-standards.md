# Code Standards — ComicHub

## Overview

Unified coding standards for ComicHub monorepo: NestJS backend + Next.js 16 frontend.

**Key Principles:** YAGNI, KISS, DRY. Sacrifice grammar for concision. Code should be readable first, pretty second.

---

## Shared Standards

### File Naming
- **TypeScript/JavaScript**: kebab-case with descriptive names (`user-service.ts`, `comment-form.tsx`)
- **Python/Shell**: snake_case (`seed_database.py`, `build-release.sh`)
- **Test files**: Co-located `*.spec.ts` or `*.spec.tsx` next to source (e.g., `utils.ts` → `utils.spec.ts`)
- **File size**: Keep individual files under 200 lines; split complex logic into modules
- **Goal**: LLM tools (Grep, Glob, Search) should understand file purpose from name alone

### Code Comments
- Self-documenting code > comments
- Comments explain **why**, not what
- Mark technical debt: `TODO: comment`, `FIXME: description`
- Avoid AI references in commits/comments

### Imports
- Group imports: external → relative → types
- Prefer named imports over default; re-exports for convenience
- Use path aliases (`@/*` for root imports)

### Error Handling
- Use try-catch with appropriate logging
- Propagate meaningful error messages
- Avoid swallowing errors silently

---

## Backend Standards (NestJS + Drizzle + PostgreSQL)

### Architecture
- **Modular design**: Each domain is a module (`auth/`, `manga/`, `user/`, etc.)
- **Service layer**: Business logic in `*.service.ts` files, injected into controllers
- **Database**: Drizzle ORM with PostgreSQL. Schema files in `src/database/schema/`
- **Response envelope**: All responses wrapped as `{ success, data, message }`
- **Guards & interceptors**: Applied globally; decorators override (`@Public()`, `@Roles()`)

### API Conventions
- **Prefix**: `/api/v1` on all endpoints
- **Auth**: JWT access/refresh tokens + Google OAuth
- **Rate limiting**: 60 req/min global throttler
- **Methods**: RESTful (GET, POST, PUT, DELETE, PATCH)
- **Validation**: Class validators in DTOs

### Testing (Backend)
- **Framework**: Vitest + SWC
- **Test files**: `*.spec.ts` co-located with source
- **Setup**: Global setup in `tests/setup.ts`
- **Database**: Use test database or in-memory alternatives
- **Coverage**: Target 80%+ on core logic
- **Run**: `pnpm test`, `pnpm test:watch`, `pnpm test:cov`, `pnpm test:e2e`

### Naming Conventions
- **Services**: `{domain}.service.ts` (e.g., `manga.service.ts`)
- **Controllers**: `{domain}.controller.ts`
- **Modules**: `{domain}.module.ts`
- **DTOs**: `{action}.dto.ts` (e.g., `create-manga.dto.ts`, `update-user.dto.ts`)
- **Guards/Interceptors**: `{purpose}.{type}.ts` (e.g., `jwt-auth.guard.ts`)
- **Database**: Schema in `schema/{domain}.ts`

---

## Frontend Standards (Next.js 16 + React 19 + Tailwind CSS v4 + Radix UI)

### Architecture
- **App Router**: Next.js 16 with `/app` directory structure
- **Components**: React Server Components by default; `'use client'` for interactivity
- **State**: Context API for auth + preferences; React hooks for local state
- **API client**: `lib/api-client.ts` (axios with JWT auto-refresh + envelope unwrapping)
- **Styling**: Tailwind CSS v4 with dark-only theme (no light mode)

### Component Organization
- **Shared UI**: `components/ui/` — Radix UI primitives + custom styling
- **Feature components**: Grouped by domain (`components/auth/`, `components/comment/`, etc.)
- **Pure components**: Prefer composition over inheritance
- **Props**: Use typed interfaces, avoid spreading unknown props

### Styling
- **Colors**: Use CSS variables or Tailwind classes, never hardcode hex
- **Icons**: Lucide React (size: 14/18/24px, stroke: 1.5px)
- **Spacing**: 8px grid (4, 8, 12, 16, 24, 32, 48, 64, 96, 128)
- **Typography**: Rajdhani (headings), Inter (body)
- **Responsive**: Mobile-first approach

### Forms
- **Validation**: zod v4 + react-hook-form
- **All forms must use zod schemas**
- **Submission**: Handle errors gracefully, show loading states
- **Feedback**: Use sonner toasts (never `alert()`)

### API Integration
- **Client**: `lib/api-client.ts` with axios + JWT refresh queue
- **Endpoints**: All under `/api/v1`
- **Error handling**: Catch and display meaningful messages
- **Loading states**: Show spinners, disable buttons during requests

### SEO & Metadata
- **Utility**: `lib/seo.tsx` provides `buildMeta()`, `JsonLd()`, and JSON-LD builders
- **Metadata**: Use `buildMeta()` for all pages (title, description, OG, Twitter, canonical)
- **Auth/Private Pages**: Set `noIndex: true` to prevent indexing (login, profile, bookmarks, settings)
- **JSON-LD**: Embed structured data (WebSite, Organization, CreativeWork, BreadcrumbList) via `<JsonLd>` component
- **Zero Dependencies**: Uses Next.js built-in Metadata API — no external packages required

### Page Rendering Strategy (ISR vs Dynamic)
- **Pages with server-side API calls**: Use `export const dynamic = 'force-dynamic'` (avoid ISR)
  - **Why**: ISR static prerender at build time may fail when backend unavailable (Docker build, cold-start deploy). Empty page gets baked into cache for 180s+
  - **Example**: Homepage with rankings/manga lists. Dynamic SSR is safe because Redis cache layer keeps per-request cost acceptable
  - **Exception**: Only use ISR for truly static data (design assets, documentation) or data fetched via external APIs (not dependent on own backend)
- **Critical data fallback pattern**: Remove `.catch(() => [])` from APIs that should fail-fast (rankings, manga lists). Let errors propagate to `error.tsx` instead of rendering empty state
  - **Why**: Readiness gate prevents traffic during cold-start, so 5xx errors should trigger `error.tsx` UI, not hide data
  - **Acceptable catch use**: Decoration-only data (comments widget, genre sidebar, stats card). These can render empty without breaking page structure
- **Summary**: Prefer dynamic rendering + fast errors over ISR + silent fallbacks for data-critical pages

### File Naming
- **Components**: PascalCase file matching export (e.g., `LoginForm.tsx`)
- **Utils/Hooks**: kebab-case (e.g., `use-auth.ts`, `format-date.ts`)
- **Styles**: Inline Tailwind via `className` prop; no separate CSS files
- **Test files**: `*.spec.ts` / `*.spec.tsx` co-located

### Naming Conventions
- **Components**: `PascalCase` (e.g., `LoginForm`, `CommentEditor`)
- **Hooks**: `useXxx` (e.g., `useAuth`, `useNotificationStream`)
- **Context**: `*Context.tsx` (e.g., `AuthContext.tsx`, `PreferencesContext.tsx`)
- **Utils**: kebab-case (e.g., `format-date.ts`, `cn.ts`)
- **API files**: `{domain}.api.ts` (e.g., `manga.api.ts`, `comment.api.ts`)

---

## Frontend Testing Standards

### Overview
Comprehensive testing strategy with Vitest (unit + component), Testing Library, MSW, and Playwright.

### Test Framework Stack
- **Unit/Component**: Vitest + happy-dom environment
- **Component Testing**: `@testing-library/react` with accessible queries
- **API Mocking**: MSW v2 (network-level mocking)
- **E2E**: Playwright (chromium)
- **Coverage**: v8 provider with HTML reports
- **Global Setup**: MSW server lifecycle, cleanup, next.js mocks

### Test File Convention
- **Location**: Co-located `*.spec.ts` or `*.spec.tsx` next to source file
- **Scope**:
  - `lib/*.spec.ts` — Pure utility functions, no React
  - `hooks/*.spec.ts` — React hooks with `renderHook`
  - `contexts/*.spec.tsx` — Context providers with wrapper + `renderHook`
  - `components/**/*.spec.tsx` — Component integration tests with `render`
  - `tests/e2e/*.spec.ts` — Full-stack E2E journeys
- **Pattern**: Match export name for easy navigation (e.g., `LoginForm.tsx` → `login-form.spec.tsx`)

### Test Structure & Patterns

#### Unit Tests (lib/)
```typescript
import { describe, it, expect } from 'vitest';
import { functionName } from './function-name';

describe('functionName', () => {
  it('happy path description', () => {
    expect(functionName(input)).toBe(expected);
  });

  it('edge case description', () => {
    expect(functionName(edgeInput)).toThrow();
  });
});
```

#### Hook Tests (hooks/)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCustomHook } from './use-custom-hook';
import { Provider } from '@/contexts/provider';

const wrapper = ({ children }) => <Provider>{children}</Provider>;

describe('useCustomHook', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useCustomHook(), { wrapper });
    expect(result.current).toEqual(expected);
  });
});
```

#### Component Tests (components/)
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('submits valid form', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});
```

#### E2E Tests (tests/e2e/)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign In')).toBeVisible();
  });

  test('login with valid credentials redirects', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });
});
```

### Query Priority
Prefer in this order (accessibility hierarchy):
1. `getByRole` — most accessible (buttons, headings, links)
2. `getByLabelText` — form inputs with labels
3. `getByText` — headings, paragraphs, visible text
4. `getByPlaceholderText` — inputs without labels
5. Avoid: `getByTestId`, `querySelector` — brittle, not accessible

### API Mocking with MSW
- **Setup**: `tests/mocks/handlers.ts` defines all endpoints
- **Global lifecycle**: `tests/setup.ts` starts/stops server
- **Runtime overrides**: Use `server.use()` in tests for conditional responses
- **Envelope format**: Matches backend's `{ success, data, message }`
- **No real network calls** in test environment

### Coverage Requirements
- **lib/**: 80%+ (utility functions, formatters, grouping logic)
- **contexts/**: 80%+ (auth, preferences state management)
- **hooks/**: 60%+ (custom React hooks)
- **components/**: Measured but not gated (focus on critical user journeys)
- **Exclusions**: Types, UI wrappers (Radix primitives), generated files

### Test Commands
```bash
# Unit + Component tests
pnpm test              # Run all tests once
pnpm test:watch        # Watch mode for TDD
pnpm test:cov          # Coverage report (v8, HTML)

# E2E tests (requires running frontend + backend)
pnpm test:e2e          # Headless E2E
pnpm test:e2e:ui       # Playwright UI mode
```

### Async Patterns
- **async/await** for promise chains
- **waitFor()** for polling assertions
- **vi.useFakeTimers()** for debounce/timeout tests
- **act()** automatically handled by Testing Library

### Common Mocks
- **Next.js**: `next/navigation` (useRouter, useSearchParams), `next/image` (Image component)
- **Fetch-based**: `@microsoft/fetch-event-source` (SSE streams)
- **External libs**: Mock as needed per test file requirements

### Test Data
- **Fixtures**: Use MSW handlers for API responses
- **Credentials**: Test tokens hardcoded (`'test-access-token'`, etc.)
- **Database**: No real DB calls; all APIs intercepted
- **User state**: Mock via MSW or context providers

### Best Practices
- ✅ Test user behavior, not implementation details
- ✅ Write readable test names (describe what happens)
- ✅ Keep tests deterministic (no timing-dependent failures)
- ✅ Use provider wrappers for context-dependent components
- ✅ Clean up after tests (MSW auto-resets, happy-dom clears DOM)
- ❌ Don't use `setTimeout` in tests (use `vi.useFakeTimers()`)
- ❌ Don't test Radix UI internals (just verify visibility)
- ❌ Don't make real network calls (MSW intercepts)
- ❌ Don't hardcode waits (use `waitFor()` with assertions)

### Performance
- **Target**: Full test suite <30s (unit + component)
- **happy-dom**: 3-5x faster than jsdom, sufficient for most components
- **Parallel execution**: Single worker for consistent state

---

## Git & Version Control

### Commit Messages
- **Format**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- **Examples**:
  - `feat: add user profile page`
  - `fix: resolve JWT refresh race condition`
  - `test: add unit tests for utils`
  - `docs: update testing standards`
- **Rules**:
  - No AI references
  - Focused on actual code changes
  - Keep concise (subject <50 chars)

### Pre-Commit Checklist
- [ ] Code compiles/runs
- [ ] Tests pass locally
- [ ] Lint errors fixed
- [ ] No secrets committed (API keys, .env, credentials)
- [ ] Files under 200 lines (split if needed)

### Pull Requests
- Link related issues
- Describe changes clearly
- Include test coverage
- Request review from teammates

---

## Environment & Configuration

### Backend (.env)
- `DATABASE_URL` — PostgreSQL connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — Token signing keys
- `REDIS_URL` (optional) — Cache layer
- `AWS_S3_*` (optional) — File storage
- `GOOGLE_CLIENT_*` (optional) — OAuth

### Frontend (.env)
- `NEXT_PUBLIC_API_URL` — Backend API URL (default: `http://localhost:8080/api/v1`)

### TypeScript
- **Module resolution**: `nodenext` (backend), `bundler` (frontend)
- **Path aliases**: `@/*` → `./src/` (backend), `./` (frontend)
- **Strict mode**: `true` everywhere

---

## Documentation

### Files to Maintain
- `./docs/project-changelog.md` — All significant changes
- `./docs/code-standards.md` — This file
- `./docs/design-guidelines.md` — UI/UX standards
- `./docs/system-architecture.md` — High-level system design
- `./docs/development-roadmap.md` — Project phases & milestones

### Update Triggers
- Feature completion → update roadmap progress
- Major refactor → update architecture docs
- Breaking changes → document in changelog
- Design updates → sync design-guidelines

---

## Review Checklist

Before merging code:
- [ ] Tests pass (unit + component + E2E if affected)
- [ ] Coverage targets met (80% on core logic)
- [ ] No linting errors
- [ ] Follows naming conventions
- [ ] No file >200 lines
- [ ] Error handling in place
- [ ] Comments explain **why** (not what)
- [ ] No hardcoded secrets or credentials
- [ ] Docs updated if breaking changes
