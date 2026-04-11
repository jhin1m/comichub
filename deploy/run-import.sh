#!/usr/bin/env bash
set -euo pipefail

# Run import scripts inside a temporary container with devDeps + TypeScript source.
# Uses the backend build stage (has tsx, drizzle, all deps).
#
# Usage:
#   ./deploy/run-import.sh comix                           # default args
#   ./deploy/run-import.sh comix --from 1 --to 5           # custom pages
#   ./deploy/run-import.sh weebdex --lang vi               # pass any flags
#   ./deploy/run-import.sh mangabaka --dry                  # dry run
#   ./deploy/run-import.sh atsumaru
#   ./deploy/run-import.sh seed                             # seed database

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Load config
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
[ -f "$ENV_FILE" ] || error ".env.deploy not found"
set -a; source "$ENV_FILE"; set +a

APP_DIR="${APP_DIR:-/var/www/comichub}"
cd "$APP_DIR" || error "APP_DIR not found: $APP_DIR"

SOURCE="${1:-}"
[ -n "$SOURCE" ] || error "Usage: $0 <source> [args...]
  Sources: comix, weebdex, mangabaka, atsumaru, seed"
shift

# Build import image from backend build stage (cached if no changes)
IMAGE="${COMPOSE_PROJECT_NAME}-import"
info "Building import image (build stage)..."
docker build --target build -t "$IMAGE" ./backend -q

# Determine command
if [ "$SOURCE" = "seed" ]; then
  CMD="npx tsx --env-file=.env src/database/seed/seed.ts $*"
else
  CMD="npx tsx --tsconfig tsconfig.json src/scripts/${SOURCE}-import.ts $*"
fi

info "Running: $CMD"
DOCKER_TTY=""
[ -t 0 ] && DOCKER_TTY="-it"
docker run --rm $DOCKER_TTY \
  --network "${COMPOSE_PROJECT_NAME}_default" \
  -e DATABASE_URL="postgresql://comichub:${DB_PASSWORD}@postgres:5432/comichub" \
  -e REDIS_URL="redis://redis:6379" \
  "$IMAGE" sh -c "$CMD"
