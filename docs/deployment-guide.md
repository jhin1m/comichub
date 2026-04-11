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
| `FRONTEND_URL` | `https://zetsu.moe` |
| `GIT_REPO` | `git@github.com:user/repo.git` |
| `GIT_BRANCH` | `main` |

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

## Common Operations

```bash
cd /var/www/comichub
source deploy/.env.deploy
export DB_PASSWORD NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_NAME NEXT_PUBLIC_SITE_LOGO NEXT_PUBLIC_SITE_URL FRONTEND_URL DOMAIN API_SUBDOMAIN COMPOSE_PROJECT_NAME

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
