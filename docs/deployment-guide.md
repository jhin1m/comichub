# Deployment Guide

ComicHub deploys to Ubuntu VPS via Docker Compose + Cloudflare Tunnel (no Nginx/reverse proxy needed).

## Architecture

```
Internet → Cloudflare CDN/WAF → CF Tunnel → cloudflared (systemd)
  ├── domain.com       → localhost:3000 (Next.js)
  └── api.domain.com   → localhost:3001 (NestJS)

Docker Compose:
  ├── frontend  :3000  (Next.js standalone)
  ├── backend   :3001  (NestJS)
  ├── postgres  :5432  (volume: pgdata)
  └── redis     :6379  (volume: redisdata)
```

All app ports bind to `127.0.0.1` — external traffic goes through Cloudflare Tunnel only.

## Prerequisites

- Ubuntu 22.04/24.04 VPS (minimum 2GB RAM, 20GB disk)
- Cloudflare account with domain added
- Cloudflare API token with permissions: `Zone:DNS:Edit`, `Account:Cloudflare Tunnel:Edit`
- SSH access to VPS as root
- Git repo accessible from VPS (SSH key or deploy key)

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates 4 services + volumes |
| `backend/Dockerfile` | 3-stage NestJS build (deps → build → prod) |
| `frontend/Dockerfile` | 3-stage Next.js standalone build |
| `deploy/setup.sh` | One-time VPS provisioning |
| `deploy/deploy.sh` | Subsequent deploys with auto-rollback |
| `deploy/.env.deploy.example` | Config template |

## First-Time Setup

### 1. Prepare config

```bash
# On VPS
mkdir -p /var/www && cd /var/www
git clone <repo-url> manga && cd manga

# Copy and fill deploy config
cp deploy/.env.deploy.example deploy/.env.deploy
nano deploy/.env.deploy
```

Required variables in `.env.deploy`:

| Variable | Description | Example |
|----------|-------------|---------|
| `CF_API_TOKEN` | Cloudflare API token | `abc123...` |
| `CF_ACCOUNT_ID` | Cloudflare account ID | `def456...` |
| `CF_TUNNEL_NAME` | Tunnel name | `comichub` |
| `DOMAIN` | Root domain | `comichub.com` |
| `API_SUBDOMAIN` | API subdomain prefix | `api` |
| `GIT_REPO` | Git clone URL | `git@github.com:user/comichub.git` |
| `GIT_BRANCH` | Branch to deploy | `main` |
| `APP_DIR` | App install path | `/var/www/manga` |
| `DB_PASSWORD` | PostgreSQL password | (strong random string) |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL | `https://api.comichub.com/api/v1` |
| `FRONTEND_URL` | For backend CORS | `https://comichub.com` |

### 2. Run setup

```bash
sudo bash deploy/setup.sh
```

This script performs 11 steps:
1. Validates `.env.deploy` variables
2. Installs Docker + Docker Compose plugin
3. Installs cloudflared
4. Creates Cloudflare Tunnel via API
5. Creates DNS CNAME records (root + api subdomain)
6. Writes tunnel ingress config
7. Installs cloudflared as systemd service
8. Clones repo to `APP_DIR`
9. Creates `backend/.env` from template (auto-generates JWT secrets)
10. Builds and starts Docker Compose services
11. Health checks backend + frontend

### 3. Post-setup

```bash
# Review and fill remaining backend env vars (Google OAuth, AWS S3, etc.)
nano /var/www/manga/backend/.env

# Restart backend to pick up changes
cd /var/www/manga && docker compose restart backend
```

## Subsequent Deploys

```bash
sudo bash /var/www/manga/deploy/deploy.sh
```

Deploy flow:
1. Tags current images as `:rollback`
2. Pulls latest code (`git pull --ff-only`)
3. Builds new images (containers keep running)
4. Swaps containers (`docker compose up -d`) — ~3-5s downtime
5. Health checks backend + frontend
6. **Auto-rollback** if health check fails (restores `:rollback` tags)
7. Prunes old images

## Docker Services

### Environment Variables

The `docker-compose.yml` reads from shell env + `backend/.env`:

| Variable | Source | Used By |
|----------|--------|---------|
| `DB_PASSWORD` | Shell env (from `.env.deploy`) | postgres, backend |
| `NEXT_PUBLIC_API_URL` | Shell env (from `.env.deploy`) | frontend build arg |
| `FRONTEND_URL` | Shell env (from `.env.deploy`) | backend CORS |
| `DATABASE_URL` | Compose `environment:` override | backend |
| `REDIS_URL` | Compose `environment:` override | backend |
| Other backend vars | `backend/.env` via `env_file:` | backend |

### Health Checks

| Service | Endpoint | Interval | Start Period |
|---------|----------|----------|--------------|
| postgres | `pg_isready -U comichub` | 10s | — |
| redis | `redis-cli ping` | 10s | — |
| backend | `GET /api/v1/health` | 30s | 40s |
| frontend | `GET /` | 30s | 30s |

### Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data persistence |
| `redisdata` | `/data` | Redis data persistence |

## Common Operations

```bash
cd /var/www/manga

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs --tail=50

# Restart single service
docker compose restart backend

# Rebuild single service
docker compose build backend && docker compose up -d backend

# Run database migrations
docker compose exec backend node dist/database/migrate.js

# Access PostgreSQL
docker compose exec postgres psql -U comichub -d comichub

# Access Redis
docker compose exec redis redis-cli

# Check service status
docker compose ps

# Stop all services
docker compose down

# Stop and remove volumes (DESTRUCTIVE — deletes DB data)
docker compose down -v
```

## Cloudflare Tunnel Management

```bash
# Check tunnel status
systemctl status cloudflared

# Restart tunnel
systemctl restart cloudflared

# View tunnel config
cat /etc/cloudflared/config.yml

# View tunnel logs
journalctl -u cloudflared -f
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| 502 Bad Gateway | `docker compose ps` — services running? |
| CORS errors | `FRONTEND_URL` in `backend/.env` matches actual domain? |
| API unreachable | `curl localhost:3001/api/v1/health` from VPS |
| Frontend blank | `curl localhost:3000` from VPS |
| DB connection error | `docker compose logs backend` — check `DATABASE_URL` |
| Tunnel not routing | `systemctl status cloudflared` + check `/etc/cloudflared/config.yml` |
| Build fails | `docker compose build --no-cache` + check Dockerfile |
| Disk full | `docker system prune -a` (removes all unused images) |

## Security Notes

- All app ports (`3000`, `3001`) bound to `127.0.0.1` — not accessible from internet directly
- PostgreSQL and Redis also bound to `127.0.0.1`
- Cloudflare handles TLS termination, DDoS protection, WAF
- `deploy/.env.deploy` contains secrets — `chmod 600` and never commit
- JWT secrets auto-generated during setup via `openssl rand`
- Tunnel credentials stored at `/etc/cloudflared/` with `chmod 600`
