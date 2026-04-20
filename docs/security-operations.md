# Security Operations

Operational checklist for deploying, configuring, and maintaining ComicHub's security posture. Baseline established 2026-04-20 (Sprint B audit remediation).

See [System Architecture § Security Posture](./system-architecture.md#security-posture-sprint-b-baseline--2026-04-20) for the what and why. This doc is the how.

## Pre-Deploy Checklist

Complete every item before promoting a build to production.

### 1. Environment Variables

**Required — backend boots only if all set correctly:**

| Variable | Constraint | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enables CSP, fail-closed Turnstile, strict JWT validation |
| `DATABASE_URL` | valid postgres URL | DB connection |
| `JWT_ACCESS_SECRET` | **≥32 bytes** | Access token signing. Boot fails otherwise. |
| `JWT_REFRESH_SECRET` | **≥32 bytes**, different from access | Refresh token signing |
| `FRONTEND_URL` | `https://zetsu.moe` | OAuth redirect target |

Generate secrets:
```bash
openssl rand -hex 32  # 64 hex chars = 32 bytes
```

**Recommended — rely on defaults unless override needed:**

| Variable | Default | When to set |
|---|---|---|
| `CORS_ORIGINS` | `https://zetsu.moe,https://www.zetsu.moe` in prod | Add staging/preview domains |
| `TRUST_PROXY_HOPS` | `2` (CF → Caddy) | Change if topology changes |
| `JWT_ACCESS_EXPIRY` | `15m` | Shorten for higher-risk deployments |
| `JWT_REFRESH_EXPIRY` | `7d` | Shorten to reduce stolen-token blast radius |

**Conditional — set only if feature used:**

| Variable | When to set |
|---|---|
| `DATABASE_SSL=require` | DB is on different host than app (default off — same-VPS) |
| `REDIS_URL` | Redis enabled (optional; app degrades gracefully if absent) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth enabled |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile enabled |
| `TURNSTILE_FAIL_OPEN=true` | **Emergency only** — disables fail-closed behavior during CF outage |
| `OAUTH_LEGACY_FRAGMENT=1` | During FE rollout window; remove after FE ships code-exchange flow |
| `ALLOW_PRIVATE_IMAGE_HOSTS=1` | Dev only — allows private-IP image sources |

**Never commit:** any of the above to git. `deploy/.env.deploy` and `backend/.env` are gitignored.

### 2. Database Migrations

Apply all pending migrations before starting the app:

```bash
docker compose --profile migrate run --rm migrate
# or locally
cd backend && pnpm run db:migrate
```

Sprint B migrations (must be applied):
- `0018_add_report_pending_unique_index.sql` — report dedupe (C3)
- `0019_add_refresh_token_jti.sql` — refresh family reuse detection (H3)

Migrations are additive and safe to re-apply.

### 3. Infrastructure Verification

**After first deploy with new config, verify:**

```bash
# Security headers present
curl -I https://api.zetsu.moe/api/v1/health
# Expect: strict-transport-security, x-content-type-options, x-frame-options: DENY, referrer-policy

# CORS rejects unknown origin
curl -I -X OPTIONS https://api.zetsu.moe/api/v1/auth/login \
     -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST"
# Expect: no Access-Control-Allow-Origin header

# CORS accepts allowed origin
curl -I -X OPTIONS https://api.zetsu.moe/api/v1/auth/login \
     -H "Origin: https://zetsu.moe" \
     -H "Access-Control-Request-Method: POST"
# Expect: Access-Control-Allow-Origin: https://zetsu.moe, Access-Control-Allow-Credentials: true

# Trust-proxy resolves real client IP (dev-only diagnostic endpoint)
curl https://localhost:3001/api/v1/diagnostic/ip -H "X-Forwarded-For: 1.2.3.4, 10.0.0.1, 10.0.0.2"
# In prod: endpoint disabled. In dev/staging: req.ip should show 1.2.3.4 (last 2 trusted)
```

### 4. Frontend Coordination

Before flipping `OAUTH_LEGACY_FRAGMENT=1` off, confirm frontend has shipped:
- `/auth/callback` reads `?code=` from query string (not URL fragment)
- `/auth/callback` POSTs `/auth/google/exchange` with `{ code }` → receives tokens normally
- Comment renderer whitelists only `spoiler / highlight / mention` span classes (matches backend sanitize rules)

## Secret Rotation

### JWT Secrets — Quarterly or On Suspected Compromise

Rotation invalidates all active sessions. Users re-login.

```bash
# 1. Generate new secrets
NEW_ACCESS=$(openssl rand -hex 32)
NEW_REFRESH=$(openssl rand -hex 32)

# 2. Update deploy/.env.deploy on VPS
# (edit file — no git commit)

# 3. Rolling restart
docker compose restart backend

# 4. Notify users via status page if downtime matters
```

**Do not** keep old secret as fallback — single-value config only. Pre-announce maintenance window if user-visible logout is a concern.

### Database Password — Annually

```bash
# 1. Create new role or ALTER existing
docker compose exec postgres psql -U comichub -c "ALTER USER comichub WITH PASSWORD 'new_password';"

# 2. Update DB_PASSWORD in deploy/.env.deploy + backend/.env

# 3. Restart backend
docker compose restart backend

# 4. Verify connectivity
curl https://api.zetsu.moe/api/v1/health
```

### Cloudflare Origin Certificate — Every 10 Years (15y Validity Buffer)

Calendar reminder: set for year 10 after issue. See `docs/deployment-guide.md § Create CF Origin Certificate`.

### Google OAuth Client Secret — On Suspected Compromise

Regenerate in Google Cloud Console → update `GOOGLE_CLIENT_SECRET` in backend env → restart.

## Incident Response

### Stolen Refresh Token (User Reports)

```bash
# Revoke entire family for the user
docker compose exec postgres psql -U comichub -d comichub -c "
  UPDATE refresh_tokens
  SET revoked_at = NOW()
  WHERE user_id = <USER_ID>
    AND revoked_at IS NULL;
"
# Also clear Redis cache
docker compose exec redis redis-cli DEL "refresh:<USER_ID>"
```

User must re-login. All their devices logged out.

### Suspected Credential Stuffing

Check per-email lockout metrics:
```bash
docker compose exec redis redis-cli --scan --pattern "login-fail:*" | wc -l
```

If abnormally high, consider:
- Temporarily tightening threshold (env-configurable, redeploy)
- Enabling Turnstile on additional routes
- Blocking offending IP ranges at Cloudflare WAF

### Turnstile Outage

Log pattern: `Turnstile verification failed, allowing request` flooded → CF Turnstile API down.

Temporary override (accept risk of bypass):
```bash
# In backend/.env
TURNSTILE_FAIL_OPEN=true
docker compose restart backend
```

Remove flag immediately after CF recovers.

### SSRF Attempt Detected

Log pattern: `safeHttpsFetch rejected: private IP <ip>` or `max redirects exceeded`.

- Investigate origin: was the URL from an import adapter? Which upstream source?
- If pattern persistent, quarantine the source and audit its adapter.
- No code change needed — the guard works.

### Report Spam / Abuse

Throttle hit: `@Throttle` returns 429 for 4th report/min/user. Check logs for user IDs with sustained 429s → potential harassment or bot.

Manual ban:
```sql
UPDATE users SET status = 'banned', banned_at = NOW() WHERE id = <USER_ID>;
```

## Monitoring Signals

Watch these logs / metrics. Thresholds are starting points — tune after baseline.

| Signal | Source | Action threshold |
|---|---|---|
| `security.refresh-reuse` events | structured log | any occurrence → investigate (token theft or bug) |
| JWT verification failures | structured log | >10/min sustained → possible brute force |
| OAuth exchange failures | structured log | spike → FE bug or attack |
| Turnstile fail rate | metric | >5% → CF issue or bot surge |
| Per-email lockout count | Redis key count | >50 unique keys → credential stuffing |
| SSRF rejections | log pattern | >0 from trusted import sources → adapter bug |
| `503 Service Unavailable` on `/health` | Caddy health check | >30s → failed boot / stuck warmup |
| Redis connection errors | app log | ongoing → cache degraded; degrade path active |

## Policy Summary

| Control | Policy |
|---|---|
| JWT secret length | ≥32 bytes, rotated quarterly |
| JWT access TTL | 15 minutes (default) |
| JWT refresh TTL | 7 days (default), revoked on reuse |
| Login lockout | 10 failures / 15 min per email (sha256-keyed) |
| Report rate | 3 / minute / user on report submission |
| Report dedupe | one pending report per (user, chapter, type) |
| OAuth account link | explicit — silent link blocked |
| TLS | enforced at Cloudflare + Caddy; HSTS in prod |
| Private-network egress | blocked via `safeHttpsFetch` |
| Comment HTML | allowlist only; span class restricted to 3 tokens |

## Related

- [System Architecture](./system-architecture.md) — the "what" behind these controls
- [Deployment Guide](./deployment-guide.md) — env var setup, cert creation
- Audit reports: `plans/reports/ck-security-*.md`

## Change Log

| Date | Change |
|---|---|
| 2026-04-20 | Initial version — Sprint B baseline (15 items remediated) |
