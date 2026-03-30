#!/usr/bin/env bash
set -euo pipefail

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

REQUIRED_VARS=(CF_API_TOKEN CF_ACCOUNT_ID CF_TUNNEL_NAME DOMAIN API_SUBDOMAIN GIT_REPO GIT_BRANCH APP_DIR DB_PASSWORD NEXT_PUBLIC_API_URL)
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

# ─── Step 3: Install cloudflared ─────────────────────
step 3 "Installing cloudflared..."
if command -v cloudflared &>/dev/null; then
  info "cloudflared already installed: $(cloudflared --version)"
else
  curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  dpkg -i /tmp/cloudflared.deb
  rm /tmp/cloudflared.deb
  info "cloudflared installed: $(cloudflared --version)"
fi

# ─── Step 4: Create CF Tunnel via API ────────────────
step 4 "Creating Cloudflare Tunnel..."
TUNNEL_SECRET=$(openssl rand -base64 32)

TUNNEL_RESPONSE=$(curl -sf -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/tunnels" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${CF_TUNNEL_NAME}\",\"tunnel_secret\":\"${TUNNEL_SECRET}\"}")

TUNNEL_ID=$(echo "$TUNNEL_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TUNNEL_ID" ] || error "Failed to create tunnel. Check CF_API_TOKEN and CF_ACCOUNT_ID."
info "Tunnel created: $TUNNEL_ID"

# Save credentials
mkdir -p /etc/cloudflared
cat > "/etc/cloudflared/${TUNNEL_ID}.json" <<EOF
{
  "AccountTag": "${CF_ACCOUNT_ID}",
  "TunnelSecret": "${TUNNEL_SECRET}",
  "TunnelID": "${TUNNEL_ID}"
}
EOF
chmod 600 "/etc/cloudflared/${TUNNEL_ID}.json"

# ─── Step 5: Create DNS CNAME records ────────────────
step 5 "Creating DNS records..."
ZONE_RESPONSE=$(curl -sf "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}")
ZONE_ID=$(echo "$ZONE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$ZONE_ID" ] || error "Could not find zone for ${DOMAIN}"

create_dns_record() {
  local name=$1
  curl -sf -X POST \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"CNAME\",\"name\":\"${name}\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"proxied\":true}"
}

create_dns_record "${DOMAIN}"
create_dns_record "${API_SUBDOMAIN}.${DOMAIN}"
info "DNS records created for ${DOMAIN} and ${API_SUBDOMAIN}.${DOMAIN}"

# ─── Step 6: Write tunnel config ─────────────────────
step 6 "Configuring tunnel routing..."
cat > /etc/cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${API_SUBDOMAIN}.${DOMAIN}
    service: http://localhost:3001
  - hostname: ${DOMAIN}
    service: http://localhost:3000
  - service: http_status:404
EOF
info "Tunnel config written"

# ─── Step 7: Install cloudflared systemd service ─────
step 7 "Starting cloudflared service..."
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
info "cloudflared service running"

# ─── Step 8: Clone repo ──────────────────────────────
step 8 "Setting up application..."
if [ -d "$APP_DIR" ]; then
  warn "$APP_DIR already exists, pulling latest..."
  cd "$APP_DIR" && git pull --ff-only origin "$GIT_BRANCH"
else
  git clone -b "$GIT_BRANCH" "$GIT_REPO" "$APP_DIR"
fi
cd "$APP_DIR"
info "Code ready at $APP_DIR"

# ─── Step 9: Setup .env files ────────────────────────
step 9 "Configuring environment..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://comichub:${DB_PASSWORD}@postgres:5432/comichub|" backend/.env
  sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://redis:6379|" backend/.env
  sed -i "s|^PORT=.*|PORT=3001|" backend/.env
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" backend/.env
  sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 48)|" backend/.env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -base64 48)|" backend/.env
  warn "Created backend/.env — review and fill remaining values:"
  warn "  nano ${APP_DIR}/backend/.env"
else
  info "backend/.env already exists"
fi

# ─── Step 10: Docker compose up ──────────────────────
step 10 "Starting Docker services..."
export DB_PASSWORD NEXT_PUBLIC_API_URL
docker compose up -d --build

# ─── Step 11: Health check ───────────────────────────
step 11 "Running health checks..."
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
info "Setup complete! Your site is live at:"
info "  Frontend: https://${DOMAIN}"
info "  API:      https://${API_SUBDOMAIN}.${DOMAIN}"
