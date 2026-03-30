#!/usr/bin/env bash
set -euo pipefail

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
export DB_PASSWORD NEXT_PUBLIC_API_URL

# ─── Step 2: Go to app dir ────────────────────────
cd "$APP_DIR" || { error "APP_DIR not found: $APP_DIR"; exit 1; }
info "Deploying from $APP_DIR"

# ─── Step 3: Tag current images for rollback ──────
info "Tagging current images as :rollback..."
docker tag "${COMPOSE_PROJECT_NAME:-comichub}-backend:latest" \
  "${COMPOSE_PROJECT_NAME:-comichub}-backend:rollback" 2>/dev/null || true
docker tag "${COMPOSE_PROJECT_NAME:-comichub}-frontend:latest" \
  "${COMPOSE_PROJECT_NAME:-comichub}-frontend:rollback" 2>/dev/null || true

# ─── Step 4: Pull latest code ─────────────────────
info "Pulling latest code from ${GIT_BRANCH}..."
git pull --ff-only origin "$GIT_BRANCH" || {
  error "git pull failed — possible diverged history"
  error "Fix manually: git fetch && git rebase origin/$GIT_BRANCH"
  exit 1
}

# ─── Step 5: Build new images (containers still running)
info "Building new images..."
docker compose build --no-cache

# ─── Step 6: Swap containers (~3-5s downtime) ─────
info "Swapping containers..."
docker compose up -d

# ─── Step 7: Health check ─────────────────────────
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

# ─── Step 8: Rollback if unhealthy ────────────────
if [ "$HEALTH_OK" = false ]; then
  warn "Health check failed — rolling back..."
  docker tag "${COMPOSE_PROJECT_NAME:-comichub}-backend:rollback" \
    "${COMPOSE_PROJECT_NAME:-comichub}-backend:latest" 2>/dev/null || true
  docker tag "${COMPOSE_PROJECT_NAME:-comichub}-frontend:rollback" \
    "${COMPOSE_PROJECT_NAME:-comichub}-frontend:latest" 2>/dev/null || true
  docker compose up -d
  error "Rollback complete. Check logs: docker compose logs --tail=50"
  exit 1
fi

# ─── Cleanup ───────────────────────────────────────
info "Pruning old images..."
docker image prune -f

info "Deploy successful!"
info "  Frontend: https://${DOMAIN}"
info "  API:      https://${API_SUBDOMAIN}.${DOMAIN}"
