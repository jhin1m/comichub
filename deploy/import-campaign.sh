#!/usr/bin/env bash
# Comix.to import campaign orchestrator.
# Loops batches of pages with random cooldowns, disk checks, consecutive-failure gate,
# Telegram notifications, and resumable campaign progress.
#
# Usage:
#   ./deploy/import-campaign.sh phase1      # pages 1-100 (hot manga)
#   ./deploy/import-campaign.sh phase2      # pages 101-700 (bulk)
#   ./deploy/import-campaign.sh all         # phase1 then phase2
#
# Env (from .env.deploy): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, USE_PROXY, PROXY_URL, PROXY_URLS
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
CONF_FILE="${SCRIPT_DIR}/comix-campaign.conf"
PROGRESS_FILE="${CAMPAIGN_PROGRESS_FILE:-/data/comix/campaign-progress.json}"
CHECKPOINT_FILE="${CHECKPOINT_FILE:-/data/comix/comix-checkpoint.json}"

[ -f "$ENV_FILE" ]  || { echo "[✗] .env.deploy not found"; exit 1; }
[ -f "$CONF_FILE" ] || { echo "[✗] comix-campaign.conf not found"; exit 1; }
set -a; source "$ENV_FILE"; source "$CONF_FILE"; set +a

mkdir -p "$(dirname "$PROGRESS_FILE")"
mkdir -p "$(dirname "$CHECKPOINT_FILE")"

notify() { "${SCRIPT_DIR}/telegram-notify.sh" "$1" || true; }
progress_summary() { "${SCRIPT_DIR}/import-progress.sh" 2>/dev/null || echo "n/a"; }

trap 'notify "⏸ Campaign paused (SIGINT). Last batch may be mid-run."; exit 130' INT TERM

disk_pct() { df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9'; }

run_batch() {
  local from=$1 to=$2
  local tag="pages ${from}-${to}"
  notify "🚀 Batch starting: ${tag}"
  echo "[$(date -Iseconds)] Running ${tag}"

  "${SCRIPT_DIR}/run-import.sh" comix \
    --from "$from" --to "$to" --resume \
    --checkpoint-file "/data/comix-checkpoint.json"
  local rc=$?

  echo "[$(date -Iseconds)] ${tag} exit=$rc"
  return $rc
}

run_phase() {
  local phase_name=$1 from=$2 to=$3 step=$4 cd_min=$5 cd_max=$6
  local consecutive_fail=0
  local batch_from batch_to

  notify "📦 Phase ${phase_name} starting: pages ${from}-${to}, step ${step}"

  for ((batch_from=from; batch_from<=to; batch_from+=step)); do
    batch_to=$((batch_from + step - 1))
    [ $batch_to -gt $to ] && batch_to=$to

    run_batch "$batch_from" "$batch_to"
    local rc=$?

    case $rc in
      0)
        consecutive_fail=0
        local stats
        stats=$(progress_summary)
        notify "✅ Batch done: pages ${batch_from}-${batch_to}
${stats}"
        ;;
      2)
        notify "⚠️ Health check FAILED at pages ${batch_from}-${batch_to}. Pausing ${HEALTH_FAIL_PAUSE}s."
        sleep "${HEALTH_FAIL_PAUSE}"
        consecutive_fail=$((consecutive_fail + 1))
        ;;
      *)
        consecutive_fail=$((consecutive_fail + 1))
        notify "❌ Batch FAILED (rc=$rc) pages ${batch_from}-${batch_to}. Consecutive fails: ${consecutive_fail}"
        ;;
    esac

    if [ $consecutive_fail -ge "${MAX_CONSECUTIVE_FAILURES}" ]; then
      notify "🛑 STOPPING: ${consecutive_fail} consecutive failures. Investigate logs."
      exit 1
    fi

    # Disk check
    local pct
    pct=$(disk_pct || echo 0)
    if [ -n "$pct" ] && [ "$pct" -ge "${DISK_ALERT_PCT}" ]; then
      notify "💾 Disk ${pct}% — STOPPING campaign. Upgrade VPS then resume."
      exit 1
    elif [ -n "$pct" ] && [ "$pct" -ge 70 ]; then
      notify "⚠️ Disk ${pct}% — plan VPS upgrade soon."
    fi

    # Persist campaign progress (for resume visibility)
    cat > "${PROGRESS_FILE}.tmp" <<EOF
{"phase":"${phase_name}","last_batch_to":${batch_to},"consecutive_fail":${consecutive_fail},"updated":"$(date -Iseconds)"}
EOF
    mv "${PROGRESS_FILE}.tmp" "${PROGRESS_FILE}"

    if [ $batch_to -lt $to ]; then
      local cooldown=$((cd_min + RANDOM % (cd_max - cd_min)))
      echo "[$(date -Iseconds)] Cooldown ${cooldown}s..."
      sleep "$cooldown"
    fi
  done

  notify "🎉 Phase ${phase_name} complete (pages ${from}-${to})"
}

MODE="${1:-}"
case "$MODE" in
  phase1)
    run_phase "1" "$PHASE_1_FROM" "$PHASE_1_TO" "$STEP_P1" "$COOLDOWN_P1_MIN" "$COOLDOWN_P1_MAX"
    ;;
  phase2)
    run_phase "2" "$PHASE_2_FROM" "$PHASE_2_TO" "$STEP_P2" "$COOLDOWN_P2_MIN" "$COOLDOWN_P2_MAX"
    ;;
  all)
    run_phase "1" "$PHASE_1_FROM" "$PHASE_1_TO" "$STEP_P1" "$COOLDOWN_P1_MIN" "$COOLDOWN_P1_MAX"
    run_phase "2" "$PHASE_2_FROM" "$PHASE_2_TO" "$STEP_P2" "$COOLDOWN_P2_MIN" "$COOLDOWN_P2_MAX"
    ;;
  *)
    echo "Usage: $0 {phase1|phase2|all}"
    exit 1
    ;;
esac

notify "🏁 Campaign finished."
