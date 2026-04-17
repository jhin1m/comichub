#!/usr/bin/env bash
# Send Telegram notification. Silent-fail if creds missing or API error.
# Usage: telegram-notify.sh "message text"
# Env:   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
set -u

MSG="${1:-}"
[ -z "$MSG" ] && exit 0
[ -z "${TELEGRAM_BOT_TOKEN:-}" ] && exit 0
[ -z "${TELEGRAM_CHAT_ID:-}" ] && exit 0

curl -s --max-time 10 -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  --data-urlencode text="${MSG}" > /dev/null 2>&1 || true
