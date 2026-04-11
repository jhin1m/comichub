#!/usr/bin/env bash
set -euo pipefail

# First-time VPS bootstrap for ComicHub.
# Installs Docker, validates Cloudflare Origin Cert, creates DNS (orange cloud),
# clones repo, runs migrations, starts Docker Compose stack, health-checks.
#
# Does NOT manage the firewall — that is your responsibility. Requirements:
#   - inbound 443/tcp open (CF edge → origin)
#   - inbound 22/tcp (or your SSH port) open — you already have this
#   - all other inbound ports closed
# Port 80 is NOT required (CF edge handles HTTP→HTTPS).

# ─── Color helpers ────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${GREEN}[Step $1]${NC} $2"; }

# ─── Root check ───────────────────────────────────────
[ "$EUID" -eq 0 ] || error "Run as root (sudo)"

# ─── Step 1: Load + validate .env.deploy ──────────────
step 1 "Loading configuration..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
[ -f "$ENV_FILE" ] || error ".env.deploy not found at $ENV_FILE"
set -a; source "$ENV_FILE"; set +a

REQUIRED_VARS=(CF_API_TOKEN DOMAIN API_SUBDOMAIN GIT_REPO GIT_BRANCH APP_DIR DB_PASSWORD NEXT_PUBLIC_API_URL COMPOSE_PROJECT_NAME)
for var in "${REQUIRED_VARS[@]}"; do
  [ -n "${!var:-}" ] || error "Missing required variable: $var"
done
info "Config loaded (${#REQUIRED_VARS[@]} vars validated)"

# ─── Step 2: Install Docker ──────────────────────────
step 2 "Installing Docker..."
if command -v docker &>/dev/null; then
  info "Docker already installed: $(docker --version)"
else
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  info "Docker installed: $(docker --version)"
fi

# ─── Step 3: Validate Cloudflare Origin Certificate ──
step 3 "Validating Cloudflare Origin Certificate..."
CERT_DIR="${SCRIPT_DIR}/certs"
CERT_PEM="${CERT_DIR}/origin.pem"
CERT_KEY="${CERT_DIR}/origin.key"
if [ ! -f "$CERT_PEM" ] || [ ! -f "$CERT_KEY" ]; then
  error "Missing CF Origin Certificate.
  Generate at: https://dash.cloudflare.com → SSL/TLS → Origin Server → Create Certificate
  Hostnames: ${DOMAIN}, *.${DOMAIN}
  Validity:  15 years
  Save as:
    ${CERT_PEM}
    ${CERT_KEY}
  Then re-run this script."
fi
chmod 600 "$CERT_KEY"
info "Origin cert present at $CERT_DIR"

# ─── Step 4: Auto-detect VPS public IP ───────────────
step 4 "Resolving VPS public IP..."
if [ -z "${VPS_PUBLIC_IP:-}" ]; then
  VPS_PUBLIC_IP=$(curl -sf https://api.ipify.org) || error "Failed to auto-detect public IP. Set VPS_PUBLIC_IP in .env.deploy manually."
fi
info "VPS public IP: $VPS_PUBLIC_IP"

# ─── Step 5: Lookup CF zone ID ───────────────────────
step 5 "Looking up Cloudflare zone..."
ZONE_RESPONSE=$(curl -sf "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}")
ZONE_ID=$(echo "$ZONE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$ZONE_ID" ] || error "Could not find zone for ${DOMAIN}. Check CF_API_TOKEN scope: Zone:Zone:Read + Zone:DNS:Edit"
info "Zone ID: $ZONE_ID"

# ─── Step 6: Create DNS A records (idempotent) ───────
step 6 "Creating DNS A records (orange cloud, proxied)..."

# Returns 0 if record already exists
dns_record_exists() {
  local name=$1
  local response
  response=$(curl -sf "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${name}&type=A" \
    -H "Authorization: Bearer ${CF_API_TOKEN}") || return 1
  echo "$response" | grep -q '"count":[1-9]'
}

create_dns_record() {
  local name=$1
  if dns_record_exists "$name"; then
    warn "DNS A record for ${name} already exists — skipping"
    return 0
  fi
  curl -sf -X POST \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${VPS_PUBLIC_IP}\",\"proxied\":true,\"ttl\":1}" > /dev/null \
    || error "Failed to create A record for ${name}"
  info "Created A record: ${name} → ${VPS_PUBLIC_IP} (proxied)"
}

create_dns_record "${DOMAIN}"
create_dns_record "${API_SUBDOMAIN}.${DOMAIN}"

# ─── Step 7: Clone repo ──────────────────────────────
step 7 "Setting up application..."
if [ -d "$APP_DIR/.git" ]; then
  warn "$APP_DIR already exists, pulling latest..."
  cd "$APP_DIR" && git pull --ff-only origin "$GIT_BRANCH"
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone -b "$GIT_BRANCH" "$GIT_REPO" "$APP_DIR"
fi
cd "$APP_DIR"
info "Code ready at $APP_DIR"

# Copy Caddyfile + cert dir into the cloned repo (script location differs from APP_DIR)
if [ "$SCRIPT_DIR" != "${APP_DIR}/deploy" ]; then
  mkdir -p "${APP_DIR}/deploy/certs"
  cp -f "$CERT_PEM" "${APP_DIR}/deploy/certs/origin.pem"
  cp -f "$CERT_KEY" "${APP_DIR}/deploy/certs/origin.key"
  chmod 600 "${APP_DIR}/deploy/certs/origin.key"
  info "Synced certs to ${APP_DIR}/deploy/certs/"
fi

# ─── Step 8: Setup backend .env ──────────────────────
step 8 "Configuring backend environment..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://comichub:${DB_PASSWORD}@postgres:5432/comichub|" backend/.env
  sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://redis:6379|" backend/.env
  sed -i "s|^PORT=.*|PORT=3001|" backend/.env
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" backend/.env
  sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 48)|" backend/.env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -base64 48)|" backend/.env
  warn "Created backend/.env — review and fill remaining values (OAuth, S3, etc.):"
  warn "  nano ${APP_DIR}/backend/.env"
else
  info "backend/.env already exists"
fi

# ─── Step 9: Start postgres + redis ──────────────────
step 9 "Starting database services..."
export DB_PASSWORD NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_NAME NEXT_PUBLIC_SITE_LOGO NEXT_PUBLIC_SITE_URL FRONTEND_URL DOMAIN API_SUBDOMAIN COMPOSE_PROJECT_NAME
docker compose up -d --wait postgres redis
info "Postgres + Redis healthy"

# ─── Step 10: Run DB migrations ──────────────────────
step 10 "Running database migrations..."
docker compose --profile migrate run --rm migrate
info "Migrations applied"

# ─── Step 11: Build + start remaining services ──────
step 11 "Building and starting backend, frontend, caddy..."
docker compose up -d --build backend frontend caddy

# ─── Step 12: Health check ───────────────────────────
step 12 "Running health checks..."
check_health() {
  local url=$1 name=$2 retries=12
  for i in $(seq 1 $retries); do
    if wget -qO- "$url" &>/dev/null; then
      info "$name is healthy"
      return 0
    fi
    echo -n "."
    sleep 5
  done
  error "$name failed health check after 60s"
}

check_health "http://localhost:3001/api/v1/health" "Backend"
check_health "http://localhost:3000" "Frontend"

echo ""
info "Setup complete!"
info "  Frontend: https://${DOMAIN}"
info "  API:      https://${API_SUBDOMAIN}.${DOMAIN}"
echo ""
warn "Final checklist:"
warn "  1. CF SSL/TLS mode set to: Full (strict)"
warn "  2. CF 'Always Use HTTPS' enabled"
warn "  3. Origin Cert valid for ${DOMAIN} and *.${DOMAIN}"
warn "  4. Fill remaining backend/.env values (OAuth, S3) then restart: docker compose up -d --build backend"
