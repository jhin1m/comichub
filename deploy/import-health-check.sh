#!/usr/bin/env bash
# Periodic health monitor for comix import campaign.
# Install via crontab: `*/30 * * * * /path/to/deploy/import-health-check.sh`
# Alerts via Telegram on: repeated 403/429, stuck checkpoint, high disk, DB down.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
[ -f "$ENV_FILE" ] || exit 0
set -a; source "$ENV_FILE"; set +a

notify() { "${SCRIPT_DIR}/telegram-notify.sh" "$1" || true; }

LOG_DIR="/var/log/comichub"
CHECKPOINT="/data/comix/comix-checkpoint.json"
DISK_ALERT_PCT="${DISK_ALERT_PCT:-85}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-comichub}"

# 1. Error-rate check — count NEW 403/429 lines since previous health run.
# Stateful: persist last-seen line count so we only alert on fresh errors.
LATEST_LOG=$(ls -1t "$LOG_DIR"/campaign-*.log 2>/dev/null | head -1 || true)
STATE_DIR="/tmp/comichub-health"
mkdir -p "$STATE_DIR"
if [ -n "${LATEST_LOG:-}" ] && [ -f "$LATEST_LOG" ]; then
  STATE_FILE="${STATE_DIR}/$(basename "$LATEST_LOG").lastline"
  LAST_LINE=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  TOTAL_LINES=$(wc -l < "$LATEST_LOG" 2>/dev/null | tr -dc '0-9' || echo 0)
  if [ "${TOTAL_LINES:-0}" -gt "${LAST_LINE:-0}" ]; then
    NEW_ERR=$(tail -n "+$((LAST_LINE + 1))" "$LATEST_LOG" 2>/dev/null | grep -cE "API (403|429)" || true)
    echo "$TOTAL_LINES" > "$STATE_FILE"
    if [ "${NEW_ERR:-0}" -gt 10 ]; then
      notify "🚨 Import health: ${NEW_ERR} new API 403/429 since last check — IP may be blocked. Consider USE_SCRAPFLY=1."
    fi
  fi
fi

# 2. Stuck checkpoint — updated >30 min ago while campaign should be running
if [ -f "$CHECKPOINT" ]; then
  NOW=$(date +%s)
  MTIME=$(stat -c %Y "$CHECKPOINT" 2>/dev/null || stat -f %m "$CHECKPOINT" 2>/dev/null || echo 0)
  AGE=$((NOW - MTIME))
  if [ "$AGE" -gt 1800 ] && pgrep -f "import-campaign.sh" > /dev/null 2>&1; then
    notify "⏱ Import health: checkpoint not updated for ${AGE}s but campaign process is running — STUCK?"
  fi
fi

# 3. Disk usage
PCT=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)
if [ -n "$PCT" ] && [ "$PCT" -ge "$DISK_ALERT_PCT" ]; then
  notify "💾 Import health: disk ${PCT}% — critical. Upgrade VPS."
fi

# 4. DB connectivity
if ! docker exec "${COMPOSE_PROJECT_NAME}-postgres-1" psql -U comichub -d comichub -c "SELECT 1" > /dev/null 2>&1; then
  notify "🔌 Import health: DB unreachable."
fi

exit 0
