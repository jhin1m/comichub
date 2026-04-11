#!/usr/bin/env bash
set -euo pipefail

# Zero-downtime(ish) deploy for ComicHub.
# Pulls latest code, runs migrations, rebuilds backend+frontend,
# swaps containers, health-checks, auto-rolls-back on failure.

# ─── Color helpers ─────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $(date '+%H:%M:%S') $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $(date '+%H:%M:%S') $1"; }
error() { echo -e "${RED}[✗]${NC} $(date '+%H:%M:%S') $1"; }

# ─── Step 1: Load config ──────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
[ -f "$ENV_FILE" ] || { error ".env.deploy not found"; exit 1; }
set -a; source "$ENV_FILE"; set +a
export DB_PASSWORD NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_NAME NEXT_PUBLIC_SITE_LOGO NEXT_PUBLIC_SITE_URL FRONTEND_URL DOMAIN API_SUBDOMAIN COMPOSE_PROJECT_NAME

# Guard — COMPOSE_PROJECT_NAME is required for rollback tag consistency.
[ -n "${COMPOSE_PROJECT_NAME:-}" ] || { error "COMPOSE_PROJECT_NAME must be set in .env.deploy"; exit 1; }

# ─── Step 2: Go to app dir ────────────────────────
cd "$APP_DIR" || { error "APP_DIR not found: $APP_DIR"; exit 1; }
info "Deploying from $APP_DIR (project: $COMPOSE_PROJECT_NAME)"

# ─── Step 3: Tag current images for rollback ──────
info "Tagging current images as :rollback..."
docker tag "${COMPOSE_PROJECT_NAME}-backend:latest" \
  "${COMPOSE_PROJECT_NAME}-backend:rollback" 2>/dev/null || warn "No existing backend image to tag"
docker tag "${COMPOSE_PROJECT_NAME}-frontend:latest" \
  "${COMPOSE_PROJECT_NAME}-frontend:rollback" 2>/dev/null || warn "No existing frontend image to tag"

# ─── Step 4: Pull latest code ─────────────────────
info "Pulling latest code from ${GIT_BRANCH}..."
git pull --ff-only origin "$GIT_BRANCH" || {
  error "git pull failed — possible diverged history"
  error "Fix manually: git fetch && git rebase origin/$GIT_BRANCH"
  exit 1
}

# ─── Step 5: Build new images (containers still running) ──
info "Building backend + frontend images..."
docker compose build --no-cache backend frontend

# ─── Step 6: Run DB migrations ────────────────────
# Runs against live postgres before swapping app containers.
# New schema must be backward-compatible with old app code to keep swap safe.
info "Running database migrations..."
docker compose --profile migrate run --rm --build migrate || {
  error "Migration failed — aborting deploy. Old containers still running."
  exit 1
}

# ─── Step 7: Swap containers (~3-5s downtime) ─────
info "Swapping containers..."
docker compose up -d backend frontend

# ─── Step 8: Health check ─────────────────────────
check_health() {
  local url=$1 name=$2 max_retries=12
  for i in $(seq 1 $max_retries); do
    if wget -qO- "$url" &>/dev/null; then
      info "$name is healthy"
      return 0
    fi
    sleep 5
  done
  error "$name failed health check after 60s"
  return 1
}

HEALTH_OK=true
check_health "http://localhost:3001/api/v1/health" "Backend" || HEALTH_OK=false
check_health "http://localhost:3000" "Frontend" || HEALTH_OK=false

# ─── Step 9: Rollback if unhealthy ────────────────
if [ "$HEALTH_OK" = false ]; then
  warn "Health check failed — rolling back..."
  docker tag "${COMPOSE_PROJECT_NAME}-backend:rollback" \
    "${COMPOSE_PROJECT_NAME}-backend:latest" 2>/dev/null || true
  docker tag "${COMPOSE_PROJECT_NAME}-frontend:rollback" \
    "${COMPOSE_PROJECT_NAME}-frontend:latest" 2>/dev/null || true
  docker compose up -d backend frontend
  error "Rollback complete. Check logs: docker compose logs --tail=50 backend frontend"
  error "NOTE: Database migrations are NOT rolled back. Review manually if schema changes caused the failure."
  exit 1
fi

# ─── Cleanup ───────────────────────────────────────
info "Pruning old images..."
docker image prune -f

info "Deploy successful!"
info "  Frontend: https://${DOMAIN}"
info "  API:      https://${API_SUBDOMAIN}.${DOMAIN}"
