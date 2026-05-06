#!/usr/bin/env bash
# Hourly incremental comix.to import — pulls page 1 (newest) with --resume.
# Install via crontab: `0 * * * * /path/to/deploy/import-daily-cron.sh`
#
# flock guard prevents overlapping runs in case a previous invocation is still
# active when the next tick fires (network slowness, image-heavy batch, etc).
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/var/log/comichub"
LOG="${LOG_DIR}/import-daily-$(date +%Y%m%d).log"
LOCK_FILE="/var/lock/comichub-import-daily.lock"

mkdir -p "$LOG_DIR"

# Acquire non-blocking lock. If held → previous run still active → skip silently.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Iseconds)] Skip — previous run still active" >> "$LOG"
  exit 0
fi

echo "[$(date -Iseconds)] Incremental import starting" >> "$LOG"

"${SCRIPT_DIR}/run-import.sh" comix \
  --from 1 --to 1 --resume \
  --reset-checkpoint \
  --checkpoint-file /data/comix-daily-checkpoint.json \
  >> "$LOG" 2>&1
RC=$?

echo "[$(date -Iseconds)] Incremental import exit=$RC" >> "$LOG"

# Telegram notify only when something noteworthy happened — avoids 48 silent
# pings/day. Parse the run's tail for "Chapters: N" and "Failed: N".
TAIL=$(tail -15 "$LOG")
CH=$(echo "$TAIL" | grep -oE 'Chapters: [0-9]+' | tail -1 | grep -oE '[0-9]+' || echo 0)
FAIL=$(echo "$TAIL" | grep -oE 'Failed: [0-9]+' | tail -1 | grep -oE '[0-9]+' || echo 0)

if [ "$RC" -ne 0 ] || [ "${FAIL:-0}" -gt 0 ] || [ "${CH:-0}" -gt 0 ]; then
  "${SCRIPT_DIR}/telegram-notify.sh" "📥 Import rc=$RC ch=$CH fail=$FAIL
\`\`\`
${TAIL}
\`\`\`" || true
fi

exit $RC
