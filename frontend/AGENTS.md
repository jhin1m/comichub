# Frontend — CLAUDE.md

Next.js 16 + React 19 + Tailwind CSS v4 + Radix UI. Read this before editing anything under `frontend/`.

## ⚠️ This is NOT the Next.js you know

Next.js 16 has breaking changes from earlier versions — APIs, conventions, and file structure may differ from your training data. **Before writing Next.js-specific code** (routing, RSC, caching, fetch behavior, metadata, dynamic params), check `node_modules/next/dist/docs/` for the current spec. Heed deprecation notices.

## Commands

```bash
pnpm install
pnpm run dev                  # next dev (port 3000)
pnpm run dev:turbo            # next dev --turbopack (4GB heap)
pnpm run build                # next build (includes type-check)
pnpm run start                # next start
pnpm run test                 # vitest run (unit)
pnpm run test:watch
pnpm run test:cov             # coverage
pnpm run test:e2e             # playwright test
pnpm run test:e2e:ui          # playwright UI mode
```

After UI changes that touch interactive flows, run `pnpm run dev`, exercise the feature in a browser, **and** run `pnpm run test:e2e` for the affected flow. Type-check + unit tests are necessary but not sufficient — they verify code correctness, not feature correctness.

## Architecture

- **App Router**, React Server Components by default. Add `"use client"` only when needed (interactivity, browser APIs, Context).
- **Routes live under `app/`**. Layouts cascade. Loading/error boundaries via `loading.tsx` / `error.tsx`.
- **API client**: `lib/api-client.ts` — axios instance with auto JWT refresh queue and response-envelope unwrap. Don't bypass with raw `fetch` for backend calls.
- **Auth state**: React Context (`contexts/auth.context.tsx`) + `useAuth` hook (`hooks/use-auth.ts`).
- **API URL**: `NEXT_PUBLIC_API_URL`, default `http://localhost:8080/api/v1`.
- **Image hosts**: S3 remote patterns configured in `next.config.ts`.
- **ISR**: homepage `revalidate=180`, manga detail `revalidate=300`. Critical fetches throw on error so outages don't bake blank pages into ISR cache; decoration fetches use `.catch(() => [])` to tolerate partial failures.

## Directory Map

```
app/                  routes (auth, browse, manga, profile, settings, ...)
components/
  ui/                 shared primitives (button, dialog, etc. — Radix-based)
  auth, bookmark, browse, comment, detail, home, layout, manga,
  notification, profile, reader, settings   feature-grouped components
contexts/             React Context providers (auth, ...)
hooks/                custom hooks (use-auth, use-reader-keyboard, ...)
lib/
  api-client.ts       axios + JWT refresh queue + envelope unwrap
  api/                per-resource API wrappers
  reader/             reader-specific helpers
  swr/                SWR config / fetchers
  utils.ts            generic helpers
  preferences-cookie.ts   user preference cookie helpers
  notification-grouping.ts notification-types.ts seo.tsx
tests/                playwright e2e specs
types/                shared TS types
```

## Design System (mandatory)

See `docs/design-guidelines.md` for the full spec. Non-negotiables:

- **Dark-only theme** — no light mode toggle.
- **Typography**: Rajdhani for headings, Inter for body.
- **Color**: use Tailwind theme tokens (`bg-card`, `text-muted-foreground`, `border-border`, ...). NEVER hardcode hex / rgb / arbitrary colors.
- **Components**: build on Radix primitives + `components/ui/` wrappers. Don't import Radix directly into feature components.
- **Forms**: zod schemas + `react-hook-form` with `@hookform/resolvers`. Every form needs a zod schema.
- **Toasts**: `sonner` — `toast.success()` / `toast.error()` / `toast.info()` for transient feedback.
- **Rich text**: `@tiptap/react` with starter-kit + image + placeholder extensions.
- **Carousels**: `embla-carousel-react`.

### Phosphor Icons

- Always import from `@phosphor-icons/react` with the `*Icon` suffix:
  ```tsx
  import { HouseIcon, BookOpenIcon, GearIcon } from "@phosphor-icons/react";
  ```
- Rename-only diffs that add the `Icon` suffix are intentional migration — don't undo them.

## Forbidden Patterns

- **No `alert()` / `window.confirm()` / browser modal dialogs** — use `toast.*` for transient feedback, Radix `Dialog` for confirmations.
- **No hardcoded colors** — Tailwind theme tokens only.
- **No raw `fetch()` to the backend** — use `lib/api-client.ts` so JWT refresh + envelope unwrap stay consistent. Raw `fetch` is fine for non-backend URLs (third-party, static assets).
- **No chapter page thumbnails in nav UI** — page previews leak spoilers. Chapter list/dropdown shows metadata only.
- **No `enhanced-*.tsx` / `*-v2.tsx` files** — modify in place.
- **No new top-level dependency** without checking it isn't a duplicate of something already present (we have axios, swr, zod, react-hook-form, dompurify, embla, tiptap — reuse before adding).
- **`"use client"` discipline** — don't sprinkle it. Server-render whatever can be server-rendered.

## Testing (Vitest + Playwright)

- Unit: `*.spec.ts` / `*.spec.tsx` co-located with source. Run via `pnpm run test`.
- E2E: `tests/` (Playwright). Config in `playwright.config.ts`. Run via `pnpm run test:e2e`.
- For component tests prefer testing user-visible behavior over implementation details.
- Don't mock the API client when an MSW-style intercept would more faithfully exercise the real flow.

## SEO

- `lib/seo.tsx` for shared metadata helpers.
- Sitemap is generated by the backend `/sitemap` module — frontend doesn't own sitemap routes.

## Common Recipes

### Add a new page
1. Create `app/<route>/page.tsx`. Default to RSC; add `"use client"` only if you need it.
2. Server-fetch via the appropriate `lib/api/*` module.
3. Stable / cacheable data → `export const revalidate = <seconds>`.
4. Critical data: throw on error (don't bake blank into ISR). Decoration data: `.catch(() => [])` fallback.
5. Add a Playwright spec under `tests/` covering the golden path.

### Add a form
1. Define zod schema (co-located or in `lib/schemas/` if reused).
2. `useForm({ resolver: zodResolver(schema) })`.
3. Submit handler calls a function from `lib/api/*` (which uses `api-client`).
4. On success: `toast.success(...)`; on error: surface server validation messages where possible.

### Add a feature component
1. Group under the matching `components/<feature>/` directory.
2. Reuse `components/ui/*` primitives. If a primitive doesn't exist, add it under `components/ui/` with Radix bindings.
3. Server component first; mark `"use client"` only when necessary.
4. Co-locate `*.spec.tsx` for non-trivial logic.
