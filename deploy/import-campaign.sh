#!/usr/bin/env bash
# Comix.to import campaign orchestrator — parallel multi-proxy shards.
# Each shard runs a disjoint page sub-range through its own proxy IP with a
# dedicated checkpoint file and log. Shards are independent — one failure
# does not kill the others.
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
CHECKPOINT_DIR="${CHECKPOINT_DIR:-/data/comix}"
LOG_DIR="${LOG_DIR:-/var/log/comichub}"

[ -f "$ENV_FILE" ]  || { echo "[✗] .env.deploy not found"; exit 1; }
[ -f "$CONF_FILE" ] || { echo "[✗] comix-campaign.conf not found"; exit 1; }
set -a; source "$ENV_FILE"; source "$CONF_FILE"; set +a

mkdir -p "$(dirname "$PROGRESS_FILE")"
mkdir -p "$CHECKPOINT_DIR"
mkdir -p "$LOG_DIR"

notify() { "${SCRIPT_DIR}/telegram-notify.sh" "$1" || true; }
progress_summary() { "${SCRIPT_DIR}/import-progress.sh" 2>/dev/null || echo "n/a"; }
disk_pct() { df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9'; }

shard_pids=()
trap 'notify "⏸ Campaign paused (SIGINT). Killing active shards."; [ ${#shard_pids[@]} -gt 0 ] && kill "${shard_pids[@]}" 2>/dev/null; exit 130' INT TERM

# Split [from..to] into N contiguous disjoint ranges, preserving order.
# Emits one "from to" pair per line. Remainder distributed to earliest shards.
split_range() {
  local from=$1 to=$2 n=$3
  local total=$((to - from + 1))
  [ "$n" -lt 1 ] && n=1
  [ "$total" -lt "$n" ] && n=$total
  local per=$((total / n))
  local rem=$((total % n))
  local cur=$from
  for ((i=0; i<n; i++)); do
    local extra=0
    [ $i -lt $rem ] && extra=1
    local end=$((cur + per + extra - 1))
    echo "$cur $end"
    cur=$((end + 1))
  done
}

run_phase_parallel() {
  local phase_name=$1 from=$2 to=$3

  # Parse PROXY_URLS → array (comma-separated, no spaces).
  local -a proxies=()
  if [ -n "${PROXY_URLS:-}" ]; then
    IFS=',' read -ra proxies <<< "$PROXY_URLS"
  fi
  local proxy_count=${#proxies[@]}

  # Determine effective shard count.
  local effective_shards="${PARALLEL_SHARDS:-1}"
  if [ "$proxy_count" -eq 0 ]; then
    notify "⚠️ Phase ${phase_name}: PROXY_URLS empty, fallback serial (1 shard, no proxy)"
    effective_shards=1
  elif [ "$proxy_count" -lt "$effective_shards" ]; then
    notify "⚠️ Phase ${phase_name}: PROXY_URLS has only ${proxy_count} endpoints, reducing shards to ${proxy_count}"
    effective_shards=$proxy_count
  fi

  notify "📦 Phase ${phase_name} starting: pages ${from}-${to}, ${effective_shards} shard(s)"

  # Compute shard ranges.
  local -a ranges=()
  while read -r line; do ranges+=("$line"); done < <(split_range "$from" "$to" "$effective_shards")

  # Spawn shards.
  shard_pids=()
  local -a shard_logs=()
  local -a shard_ranges=()
  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  for ((i=0; i<effective_shards; i++)); do
    local shard_from shard_to
    read -r shard_from shard_to <<< "${ranges[$i]}"
    shard_ranges+=("${shard_from}-${shard_to}")
    local shard_proxy=""
    [ "$proxy_count" -gt 0 ] && shard_proxy="${proxies[$i]}"
    local shard_use_proxy=0
    [ -n "$shard_proxy" ] && shard_use_proxy=1
    local shard_checkpoint="${CHECKPOINT_DIR}/checkpoint-shard-${i}.json"
    local shard_log="${LOG_DIR}/import-shard-${i}-${ts}.log"
    shard_logs+=("$shard_log")

    echo "[S${i}] spawn pages ${shard_from}-${shard_to} proxy=$([ -n "$shard_proxy" ] && echo "configured" || echo "none") log=$shard_log"
    (
      USE_PROXY="$shard_use_proxy" \
      PROXY_URL="$shard_proxy" \
      PAGE_RETRY_MAX="${PAGE_RETRY_MAX:-3}" \
      PAGE_RETRY_BACKOFF="${PAGE_RETRY_BACKOFF:-5,15,45}" \
      "${SCRIPT_DIR}/run-import.sh" comix \
        --from "$shard_from" --to "$shard_to" --resume \
        --checkpoint-file "/data/checkpoint-shard-${i}.json" \
        --page-retry-max "${PAGE_RETRY_MAX:-3}" \
        --page-retry-backoff "${PAGE_RETRY_BACKOFF:-5,15,45}" \
        > "$shard_log" 2>&1
    ) &
    shard_pids+=($!)
  done

  # Wait all shards, collect exit codes. One failure does not kill others.
  local any_fail=0
  for ((i=0; i<effective_shards; i++)); do
    wait "${shard_pids[$i]}"
    local rc=$?
    if [ $rc -eq 0 ]; then
      notify "✅ [S${i}] done (pages ${shard_ranges[$i]})"
    else
      any_fail=1
      notify "❌ [S${i}] FAIL rc=${rc} (pages ${shard_ranges[$i]}), log: ${shard_logs[$i]}"
    fi
  done
  shard_pids=()

  # Disk gate — critical when 3× write throughput.
  local pct
  pct=$(disk_pct || echo 0)
  if [ -n "$pct" ] && [ "$pct" -ge "${DISK_ALERT_PCT}" ]; then
    notify "💾 Disk ${pct}% ≥ ${DISK_ALERT_PCT}% — STOP campaign, upgrade VPS."
    exit 1
  elif [ -n "$pct" ] && [ "$pct" -ge 70 ]; then
    notify "⚠️ Disk ${pct}% — plan VPS upgrade soon."
  fi

  # Aggregate summary.
  local stats
  stats=$(progress_summary)
  notify "🏁 Phase ${phase_name} aggregated:
${stats}"

  # Persist campaign progress (resume visibility).
  cat > "${PROGRESS_FILE}.tmp" <<EOF
{"phase":"${phase_name}","from":${from},"to":${to},"shards":${effective_shards},"any_fail":${any_fail},"updated":"$(date -Iseconds)"}
EOF
  mv "${PROGRESS_FILE}.tmp" "${PROGRESS_FILE}"

  return $any_fail
}

MODE="${1:-}"
case "$MODE" in
  phase1)
    run_phase_parallel "1" "$PHASE_1_FROM" "$PHASE_1_TO"
    ;;
  phase2)
    run_phase_parallel "2" "$PHASE_2_FROM" "$PHASE_2_TO"
    ;;
  all)
    run_phase_parallel "1" "$PHASE_1_FROM" "$PHASE_1_TO"
    run_phase_parallel "2" "$PHASE_2_FROM" "$PHASE_2_TO"
    ;;
  *)
    echo "Usage: $0 {phase1|phase2|all}"
    exit 1
    ;;
esac

notify "🏁 Campaign finished."
