# Deployment Guide

VPS deploy via Docker Compose + Caddy reverse proxy + Cloudflare SSL.

## Architecture

```
Client → Cloudflare edge (DDoS, cache, orange-cloud proxy)
       → VPS :443 (Caddy, CF Origin Cert)
       ├── zetsu.moe       → frontend:3000 (Next.js standalone)
       └── api.zetsu.moe   → backend:3001  (NestJS)

Docker Compose services:
  ├── caddy      :443   (reverse proxy, TLS termination)
  ├── frontend   :3000  (Next.js, internal only)
  ├── backend    :3001  (NestJS, internal only)
  ├── postgres   :5432  (internal only, volume: pgdata)
  ├── redis      :6379  (internal only, volume: redisdata)
  └── migrate    (one-shot, profile-gated)
```

Backend/frontend ports bind `127.0.0.1` only. Caddy is the sole public-facing service on `:443`.
Port 80 not needed — CF edge handles HTTP→HTTPS redirect.

## Prerequisites

- Ubuntu 22.04+ VPS, 4GB+ RAM, 20GB+ disk
- Domain added to Cloudflare
- CF API token: `Zone:Zone:Read` + `Zone:DNS:Edit`
- CF Origin Certificate (15-year, see below)
- SSH + git access from VPS
- GitHub deploy key (if private repo)

## File Overview

| File | Purpose |
|---|---|
| `docker-compose.yml` | 5 services + migrate runner |
| `backend/Dockerfile` | 3-stage NestJS build |
| `frontend/Dockerfile` | 3-stage Next.js standalone build |
| `deploy/setup.sh` | One-time VPS bootstrap |
| `deploy/deploy.sh` | Subsequent deploys with auto-rollback |
| `deploy/migrate.sh` | SQL migrations via psql (hash-tracked) |
| `deploy/Caddyfile` | Reverse proxy + CF Origin Cert config |
| `deploy/.env.deploy.example` | Config template |
| `deploy/certs/` | CF Origin Cert files (gitignored) |

## First-Time Setup

### 1. Create CF Origin Certificate

1. CF dashboard → domain → **SSL/TLS** → **Origin Server** → **Create Certificate**
2. Hostnames: `yourdomain.com`, `*.yourdomain.com`
3. Validity: **15 years**
4. Save **Origin Certificate** → `origin.pem`
5. Save **Private Key** → `origin.key` (shown only once!)
6. **SSL/TLS** → **Overview** → set mode: **Full (strict)**
7. **Edge Certificates** → enable **Always Use HTTPS**

### 2. Create CF API Token

1. CF dashboard → **My Profile** → **API Tokens** → **Create Token**
2. Permissions: `Zone:Zone:Read` + `Zone:DNS:Edit`
3. Zone: your domain only

### 3. Clone + configure on VPS

```bash
# Clone repo
git clone -b main <repo-url> /var/www/comichub
cd /var/www/comichub

# Create deploy config
cp deploy/.env.deploy.example deploy/.env.deploy
nano deploy/.env.deploy
```

`.env.deploy` variables:

| Variable | Example |
|---|---|
| `CF_API_TOKEN` | (from step 2) |
| `DOMAIN` | `zetsu.moe` |
| `API_SUBDOMAIN` | `api` |
| `COMPOSE_PROJECT_NAME` | `zetsu` |
| `APP_DIR` | `/var/www/comichub` |
| `DB_PASSWORD` | (strong random) |
| `NEXT_PUBLIC_API_URL` | `https://api.zetsu.moe/api/v1` |
| `NEXT_PUBLIC_SITE_NAME` | `Zetsu` |
| `NEXT_PUBLIC_SITE_URL` | `https://zetsu.moe` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAA...` (CF Turnstile public site key — baked into FE bundle at `docker build`; rebuild required after change) |
| `FRONTEND_URL` | `https://zetsu.moe` |
| `GIT_REPO` | `git@github.com:user/repo.git` |
| `GIT_BRANCH` | `main` |
| `TELEGRAM_BOT_TOKEN` | (optional, for campaign notifications) |
| `TELEGRAM_CHAT_ID` | (optional, for campaign notifications) |
| `USE_SCRAPFLY` | `0` or `1` (enable anti-scraping proxy, default 0) |
| `SCRAPFLY_KEY` | (required if USE_SCRAPFLY=1) |

### 4. Upload certificates

```bash
mkdir -p deploy/certs
# Paste cert content (or SCP from local):
nano deploy/certs/origin.pem
nano deploy/certs/origin.key
chmod 600 deploy/certs/origin.key
```

### 5. Run setup

```bash
sudo ./deploy/setup.sh
```

Setup performs 12 steps: validate config → install Docker → validate cert → auto-detect IP → lookup CF zone → create DNS A records (proxied) → pull code → configure `backend/.env` → start postgres+redis → run migrations → build+start app → health check.

### 6. Post-setup

```bash
# Fill remaining backend env (Google OAuth, AWS S3, SMTP, Turnstile)
nano backend/.env
docker compose restart backend
```

## Subsequent Deploys

```bash
# Push code to GitHub, then on VPS:
sudo ./deploy/deploy.sh
```

Flow: tag rollback → git pull → build (no-cache) → migrate → swap containers → health check → auto-rollback if unhealthy → prune images.

### Zero-Downtime Deploy Pattern

Backend uses **readiness gates** to prevent blank pages during cold-start:

1. **Readiness Signal**: `ReadinessService` singleton blocks HTTP requests until `onApplicationBootstrap` warmup completes
2. **Health Probe**: `/api/v1/health` returns `503 Service Unavailable` (not `200`) while warming up
3. **Caddy Routing**: Active health check (`health_interval: 5s`) detects 503 and excludes unhealthy upstream during warm window (~5-10s). Prevents traffic routing to warming-up backend
4. **Warmup Window**: Cache warmup queries (rankings, genres) run once per boot. DB pool isolated from user requests during this window

**Frontend protection**: Homepage and data-dependent pages use `export const dynamic = 'force-dynamic'` to avoid ISR static prerender at build time (when backend is unavailable). This prevents empty pages from being baked into ISR cache for 180s+ after deploy.

**Why not ISR for homepage**: Docker build stage has no running backend service → fetch fails → `.catch(() => [])` would silently bake empty arrays into static cache, serving blank page to all users for minutes. Dynamic SSR instead; Redis cache layer keeps per-request cost low.

## Bulk Import Operations (Comix.to Campaign)

For multi-week import campaigns (70k+ manga), orchestration scripts in `deploy/`:

| Script | Purpose |
|--------|---------|
| `import-campaign.sh` | Main orchestrator: spawns parallel shards (one per proxy), loops batch ranges with cooldown, advisory locks prevent duplicate manga processing across shards, Telegram notifications, health monitoring |
| `import-daily-cron.sh` | Incremental daily import (pages 1-30), runs via cron after campaign |
| `import-progress.sh` | DB progress query (manga/chapter/image counts), cache stats |
| `import-health-check.sh` | Monitors log errors, stuck detection, disk usage, DB connectivity |
| `telegram-notify.sh` | Sends Telegram alerts (requires TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) |
| `comix-campaign.conf` | Phase config: batch ranges, step sizes, cooldowns, shard count (PARALLEL_SHARDS) |

### Quick Start

```bash
# 1. Fill campaign config (batch ranges, cooldowns)
nano deploy/comix-campaign.conf

# 2. Add Telegram creds to .env.deploy (optional, silent-fails if missing)
echo TELEGRAM_BOT_TOKEN="..." >> deploy/.env.deploy
echo TELEGRAM_CHAT_ID="..." >> deploy/.env.deploy

# 3. Optional: enable Scrapfly for IP block recovery
echo USE_SCRAPFLY=1 >> deploy/.env.deploy
echo SCRAPFLY_KEY="..." >> deploy/.env.deploy

# 4. Start phase 1 batch import (e.g., pages 1-100)
sudo ./deploy/import-campaign.sh phase1

# 5. Check progress anytime
./deploy/import-progress.sh

# 6. Setup daily cron after campaign completes
echo "0 3 * * * cd /var/www/comichub && ./deploy/import-daily-cron.sh >> /var/log/comichub/import-daily.log 2>&1" | sudo crontab -
```

### CLI Flags for comix-import.ts

When running via `run-import.sh comix [flags]`:
- `--from N --to M`: page range (required)
- `--resume`: skip already-imported pages (checkpoint-aware)
- `--checkpoint-file /path`: persistent progress file (atomic write)
- `--reset-checkpoint`: discard existing checkpoint
- `--jitter-min MS --jitter-max MS`: random throttle (default 400-1200ms, backward compat with other import sources)
- `--health-interval N`: re-check API health every N pages (default: off)
- `--fetch-timeout-ms MS`: hard timeout per fetch (default 30000ms, prevents TCP hangs)
- `--chapter-retry-max N`: max retries per chapter list fetch (default 3)
- `--chapter-retry-backoff SEC[,...]`: backoff seconds (default 3,10,30)
- `--image-retry-max N`: max retries per image fetch (default 3)
- `--image-retry-backoff SEC[,...]`: backoff seconds (default 3,10,30)
- `--dry`: test mode (no DB writes)

## Common Operations

```bash
cd /var/www/comichub
source deploy/.env.deploy
export DB_PASSWORD NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_NAME NEXT_PUBLIC_SITE_LOGO NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_TURNSTILE_SITE_KEY FRONTEND_URL DOMAIN API_SUBDOMAIN COMPOSE_PROJECT_NAME

# Status
docker compose ps

# Logs
docker compose logs -f backend
docker compose logs --tail=50 frontend

# Restart service
docker compose restart backend

# Rebuild single service
docker compose build --no-cache backend && docker compose up -d backend

# Run migrations manually
docker compose --profile migrate run --rm migrate

# Access PostgreSQL
docker compose exec postgres psql -U comichub -d comichub

# Access Redis
docker compose exec redis redis-cli

# Stop all
docker compose down

# Stop + delete data (DESTRUCTIVE)
docker compose down -v
```

## Rollback

deploy.sh auto-rollbacks on health check failure. Manual rollback:

```bash
docker tag ${COMPOSE_PROJECT_NAME}-backend:rollback ${COMPOSE_PROJECT_NAME}-backend:latest
docker tag ${COMPOSE_PROJECT_NAME}-frontend:rollback ${COMPOSE_PROJECT_NAME}-frontend:latest
docker compose up -d backend frontend
```

Note: DB migrations are NOT auto-rolled-back.

## Troubleshooting

| Issue | Fix |
|---|---|
| 502 from CF | `docker compose ps` — all healthy? Caddy running? |
| CORS errors | Check `FRONTEND_URL` in `backend/.env` matches domain |
| API unreachable | `wget -qO- http://localhost:3001/api/v1/health` from VPS |
| Frontend blank | `docker compose logs frontend` — check for crashes |
| Migration fail | `docker compose --profile migrate run --rm migrate` — check SQL errors |
| Backend crash | `docker compose logs backend` — check `dist/main.js` exists |
| Caddy TLS error | Verify `deploy/certs/origin.pem` + `origin.key` present, CF mode = Full (strict) |
| Build OOM | VPS needs 4GB+ RAM for concurrent BE+FE builds |
| Disk full | `docker system prune -a` (removes unused images) |

## Security

- Backend/frontend ports `127.0.0.1` only — no direct internet access
- Postgres/redis: no host port binding, internal docker network only
- Caddy: sole public listener on `:443` with CF Origin Cert
- CF orange cloud (proxied): VPS IP hidden from public DNS
- `deploy/.env.deploy` + `deploy/certs/` gitignored, never committed
- JWT secrets auto-generated via `openssl rand` during setup
