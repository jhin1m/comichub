# System Architecture

High-level architecture of ComicHub — monorepo with NestJS backend + Next.js 16 frontend. Deployed via Docker Compose on a single VPS behind Cloudflare.

## Topology

```
Client → Cloudflare (edge, DDoS, cache, orange-cloud)
       → VPS :443 (Caddy, TLS via CF Origin Cert)
       ├── zetsu.moe      → frontend  :3000 (Next.js standalone)
       └── api.zetsu.moe  → backend   :3001 (NestJS)

Internal services (bound to 127.0.0.1, not public):
  ├── postgres :5432 (single-VPS, no network SSL required)
  ├── redis    :6379
  └── migrate  (one-shot, profile-gated)
```

- 2 proxy hops: **Cloudflare → Caddy → Node**. App must know this for correct `req.ip` attribution.
- Prod origin: `https://zetsu.moe`. No staging env.
- DB on same VPS as app → network encryption not required (see SSL opt-in below).

## Request Pipeline (Backend)

```
HTTP → Caddy → Express (NestJS)
         │
         ├─ helmet                 # security headers (HSTS, XFO, nosniff, CSP in prod)
         ├─ cors (allowlist)       # explicit origin list, credentials: true
         ├─ trust proxy = 2        # real client IP from XFF
         ├─ ThrottlerGuard         # 300 req/min/IP global
         ├─ JwtAuthGuard           # default-auth; @Public() opts out
         ├─ RedisCacheInterceptor  # public-GET response cache
         └─ TransformInterceptor   # { success, data, message } envelope
```

API prefix: `/api/v1`. All routes require auth by default.

## Security Posture (Sprint B Baseline — 2026-04-20)

### Edge & Transport
| Control | Implementation |
|---|---|
| TLS | Caddy + Cloudflare Origin Cert (15y), CF SSL mode: Full (strict) |
| HTTP headers | `helmet()` — HSTS, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy |
| CSP | Enabled in production only; disabled in dev/test (would break Swagger UI) |
| CORS | Explicit allowlist (never `origin: true`), `credentials: true` |

**CORS allowlist (per env):**
| Env | Origins |
|---|---|
| production | `https://zetsu.moe`, `https://www.zetsu.moe` (override via `CORS_ORIGINS=...`) |
| development | `http://localhost:3000` |
| test | reflect `*`, no credentials |

### Proxy Trust
`app.set('trust proxy', <TRUST_PROXY_HOPS>)` — default **2** (CF → Caddy). Effect:
- `req.ip` = real client IP (last trusted XFF entry)
- ThrottlerGuard rate-limits by client IP, not Cloudflare IP
- Dev diagnostic endpoint exposes `req.ip` / `req.ips` / XFF for manual verification (`NODE_ENV !== 'production'` only)

**Warning:** If Caddy config changes (e.g., stops appending XFF), hop count becomes wrong → client can spoof IP. Re-verify via diagnostic endpoint after infra changes.

### Database
- `ssl` flag: **opt-in** via `DATABASE_SSL=require`. Default off because DB runs on same VPS as app. Flip on when DB moves off-host.
- Pool: `max: 10`, `idle_timeout: 20s`, `connect_timeout: 10s` (postgres.js driver)
- Migrations: Drizzle-kit, applied via `pnpm run db:migrate`

### Auth
- JWT access (short TTL) + refresh (7d) + Google OAuth
- **OAuth flow (C2 hardened):** Google callback returns a one-time `code` in query string (NOT tokens in URL fragment). Frontend POSTs `/auth/google/exchange` to swap code → tokens. 60s TTL, single-use via Redis `GETDEL`.
  - Legacy fragment fallback gated by `OAUTH_LEGACY_FRAGMENT=1` env flag during FE rollout window.
- **Refresh token family (H3):** each refresh carries `jti` + `family_id`. Replay of revoked `jti` → entire family revoked → 401 + `security.refresh-reuse` audit log.
- **Silent Google linking blocked (H6):** if incoming Google identity has no matching `googleId` but email matches an existing local account → 409 `ACCOUNT_EXISTS_NO_LINK`. User must log in with password and link from settings.
- **Per-email lockout (H5):** Redis key `login-fail:<sha256(email)>` — 10 failures / 15min → 403 hard lock. Emails hashed to avoid PII-in-cache. Redis down → fallback to per-IP throttle only.
- **JWT secret fail-fast:** `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` must be ≥32 bytes in any non-test env. Missing/short → process exits at boot (no silent fallback).

### Input Validation & Output Sanitization
- All DTOs validated via `class-validator` (global `ValidationPipe`, `whitelist: true`, `forbidNonWhitelisted: true`)
- Forms: zod + react-hook-form on frontend
- **Comment HTML (C4):** `sanitize-html` with tight allowlist. Span class restricted to `['spoiler', 'highlight', 'mention']` — arbitrary Tailwind classes stripped. Anchor `rel` = `noopener nofollow noreferrer`.
- **Turnstile (H4):** fail-closed in production. Network error → 403. Dev: log + pass. Emergency override: `TURNSTILE_FAIL_OPEN=true`.

### Community Anti-Abuse
- **Report rate limit (C3):** `@Throttle({ limit: 3, ttl: 60000 })` per-user on `POST /chapters/:id/report`.
- **Report dedupe:** partial unique index `(user_id, chapter_id, type) WHERE status='pending'` + app-level pre-check → 409 on retry.

### Content-Rating Filters: Preference ≠ Access Control
Invariant: the `NSFW_RATINGS` filter is a **discovery preference**, not an access gate.
- Applies to list/discovery endpoints (`GET /manga` default, `GET /manga/random`) so unauthenticated browsing doesn't surface adult covers.
- **Never** applied to direct-intent detail lookups (`GET /manga/:slug`). A direct URL is explicit intent — blocking it with a silent 404 confused users and broke SSR/share links.
- Real adult-content access control (age verification, etc.) is a separate future initiative and must live behind an explicit gate, not a discovery filter.

### SSRF Defense (H11)
Shared utility `common/utils/safe-http.util.ts`:
- Scheme allowlist: `https:` only
- DNS pre-resolution → reject private/loopback/link-local (IPv4: `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`; IPv6: `::1`, `fc00::/7`, `fe80::/10`)
- `redirect: 'manual'` — re-validate host + IP on each hop
- Max 3 hops
- 30s timeout, 20MB body cap

Used by: `ImageMirrorJob.downloadImage`, any import adapter that fetches upstream-controlled URLs.

## Caching (3-Layer)

```
Request → [L1 HTTP interceptor] → [L2 Redis service cache] → [L3 in-memory Map] → DB
```

| Layer | Scope | Key | TTL |
|---|---|---|---|
| L1 `RedisCacheInterceptor` | public GET only (skips authed users) | `cache:<url>` | per-route `@CacheTTL()` |
| L2 service-level Redis | hot reads (rankings, taxonomy) | varies | 180–3600s |
| L3 in-memory `Map` | taxonomy (benefits authed users bypassing L1) | `taxonomy:*` | 10min, 100 entries |

**TTL summary:** manga 180s · ranking 300s (HTTP) / 900s (service) · search 120s · taxonomy 600s · stats 3600s. Homepage ISR 180s, detail ISR 300s.

**Invalidation:**
- Event-driven: `chapter.created`, `manga.updated` → targeted `DEL`
- Cron: `rankings:*` flushed every 5 min
- Counter flush: view buffers flushed to DB every 5 min via `CounterFlushJob` (guarded by `redisStatus.available` — no-ops when Redis down)

## Search (pg_trgm)

Typo-tolerant, diacritic-insensitive full-text search powered by PostgreSQL trigram indexes.

- **Extensions:** `pg_trgm` (trigram similarity), `unaccent` (diacritic folding).
- **Normalized columns:** `manga.search_title`, `manga.search_alt` — `GENERATED ALWAYS AS (...) STORED` via `normalize_title(text) → lower(unaccent(...))` (IMMUTABLE SQL wrapper; stock `unaccent()` is STABLE and cannot be used in generated columns).
- **Indexes:** GIN `gin_trgm_ops` on both columns, built `CREATE INDEX CONCURRENTLY` (non-blocking, in a separate no-transaction migration `0021`).
- **Query (fuzzy path, `q` > 3 chars):** `search_title %> :q OR search_alt %> :q` with per-query `SET LOCAL pg_trgm.word_similarity_threshold` (env-tunable `SEARCH_WORD_SIM_THRESHOLD`, default `0.25`, range `[0.1, 1.0]`). Wrapped in `db.transaction()` so `SET LOCAL` scope is per-request.
- **Short-query fallback (`q` ≤ 3 chars):** ILIKE on the same normalized columns — GIN trigram still accelerates substring match; `%>` unreliable at this length.
- **Ranking (blended):** `word_similarity(q, title)*2 + word_similarity(q, alt)*1.5 + ln(1+views)*0.1 + freshness_bonus` (30-day window). Relevance wins over user-selected sort when `q` present.
- **Suggest cache:** Redis TTL `90s` (down from `300s` — trading staleness for freshness now that DB is fast).
- **Out of scope (future):** `manga_aliases` child table with per-alias weighting; CJK tokenizer (zhparser / pgroonga); synonyms / query expansion; pgvector semantic search.

## Graceful Degradation (Redis Optional)

- `REDIS_AVAILABLE` token (`RedisStatus`) injected where Redis-dependent behavior must degrade
- `stubRedisClient()` provides no-op implementations (`get`, `set`, `del`, `incr`, `expire`, `scan`, `getdel`, …) when Redis unreachable
- Affected paths:
  - **View tracking:** Redis up → buffer in Redis, flushed by cron. Down → direct `views + 1` SQL increment.
  - **Refresh tokens:** Redis up → Redis + DB dual-write. Down → DB-only via `refresh_tokens` table.
  - **Login lockout:** Redis up → per-email counter. Down → warn + fallback to per-IP throttle.
  - **OAuth code exchange:** requires Redis (60s TTL). Down → OAuth login temporarily unavailable; logged as `security.oauth-redis-down`.

## Module Map (Backend)

| Module | Responsibility |
|---|---|
| `auth` | JWT access/refresh, Google OAuth, lockout, refresh-token family |
| `user` | Profiles, admin CRUD, reading history |
| `manga` | Manga/chapters/images, artists/authors/genres/groups, view tracking, rankings |
| `community` | Comments, ratings, follows, reports, stickers |
| `search` | Fuzzy search via pg_trgm GIN on normalized generated columns (typo + diacritic tolerant, CJK substring) |
| `notification` | In-app notification events |
| `sitemap` | Static sitemap generation |
| `jobs` | Cron: counter-flush, cache-invalidation, cache-warmup, view-counter-reset |
| `import` | Multi-source import adapters (Comix.to, WeebDex, Atsumaru, MangaBaka) |
| `common` | Guards, interceptors, DTOs, shared utils (`safe-http`, `private-ip`) |

## Frontend (Next.js 16)

- App Router, React Server Components where possible
- Radix UI primitives + Tailwind v4
- Forms: zod + react-hook-form
- API client: `lib/api-client.ts` — axios with auto JWT refresh queue + envelope unwrap
- Auth state: Context + `useAuth` hook
- **Readiness gate:** Caddy active health check (5s interval) excludes warming-up backend from upstream pool during cold-start.
- **ISR safety:** homepage `revalidate=180`, detail `revalidate=300`. Build-time prerender reaches backend via public `NEXT_PUBLIC_API_URL` (build stage doesn't join compose network). Critical fetches throw on error so outages never bake a blank page into ISR cache; decoration fetches (`.catch(() => [])`) tolerate partial failures. See `docs/deployment-guide.md` → "ISR build-time prerender".

## Deployment

See `docs/deployment-guide.md` for step-by-step. Summary: `sudo ./deploy/deploy.sh` → tag rollback → git pull → build → migrate → swap containers → health check → auto-rollback on failure.

## Related Documents

- [Security Operations](./security-operations.md) — env checklist, secret rotation, incident response
- [Deployment Guide](./deployment-guide.md) — VPS setup, subsequent deploys
- [Code Standards](./code-standards.md) — conventions, module layout
- [Project Changelog](./project-changelog.md) — release notes

## Change Log

| Date | Change |
|---|---|
| 2026-04-23 | Fuzzy search (pg_trgm): replaced ILIKE `%q%` with trigram word_similarity on generated normalized columns (`search_title`, `search_alt`). Diacritic-insensitive via `unaccent`, CJK substring via trigram n-grams. Env: `SEARCH_WORD_SIM_THRESHOLD` (default 0.25). Suggest Redis TTL 300s → 90s. |
| 2026-04-20 | Sprint B security baseline: Helmet, CORS allowlist, trust-proxy=2, JWT fail-fast, OAuth code exchange, refresh-family, lockout, Turnstile fail-closed, SSRF util, sanitize-html whitelist, Redis graceful degradation |
