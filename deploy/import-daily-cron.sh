#!/usr/bin/env bash
# Daily incremental comix.to import — pulls pages 1-30 (newest) with --resume.
# Install via crontab after campaign completes: `0 3 * * * /path/to/deploy/import-daily-cron.sh`
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/var/log/comichub"
LOG="${LOG_DIR}/import-daily-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

echo "[$(date -Iseconds)] Daily incremental import starting" >> "$LOG"

"${SCRIPT_DIR}/run-import.sh" comix \
  --from 1 --to 30 --resume \
  --reset-checkpoint \
  --checkpoint-file /data/comix-daily-checkpoint.json \
  >> "$LOG" 2>&1
RC=$?

echo "[$(date -Iseconds)] Daily import exit=$RC" >> "$LOG"

# Notify (tail stats summary)
TAIL=$(tail -10 "$LOG")
"${SCRIPT_DIR}/telegram-notify.sh" "📅 Daily import rc=$RC
\`\`\`
${TAIL}
\`\`\`" || true

exit $RC
