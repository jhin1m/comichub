#!/usr/bin/env bash
# Aggregate comix import progress across shard checkpoints + DB truth.
# Multi-shard mode: reads /data/comix/checkpoint-shard-*.json.
# Legacy fallback: /data/comix/comix-checkpoint.json (single-file pre-parallel).
# Optional DB summary: --db flag adds authoritative counts from Postgres.
# Usage:
#   import-progress.sh                 # checkpoint aggregate to stdout
#   import-progress.sh --notify        # also send Telegram notification
#   import-progress.sh --db            # append DB totals
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
[ -f "$ENV_FILE" ] && { set -a; source "$ENV_FILE"; set +a; }

CHECKPOINT_DIR="${CHECKPOINT_DIR:-/data/comix}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-comichub}"

NOTIFY=0
WITH_DB=0
for arg in "$@"; do
  case "$arg" in
    --notify) NOTIFY=1 ;;
    --db)     WITH_DB=1 ;;
  esac
done

# ── Collect checkpoint files ─────────────────────────────────────
shopt -s nullglob
shard_files=( "${CHECKPOINT_DIR}"/checkpoint-shard-*.json )
legacy_file="${CHECKPOINT_DIR}/comix-checkpoint.json"
files=()
if [ ${#shard_files[@]} -gt 0 ]; then
  files=( "${shard_files[@]}" )
elif [ -f "$legacy_file" ]; then
  files=( "$legacy_file" )
fi

have_jq=1
command -v jq >/dev/null 2>&1 || have_jq=0

summary=""
if [ ${#files[@]} -eq 0 ]; then
  summary="No checkpoints found in $CHECKPOINT_DIR"
elif [ "$have_jq" -eq 0 ]; then
  summary="jq not installed — cannot parse checkpoints. Install: apt-get install -y jq"
else
  total_imp=0; total_skp=0; total_fld=0
  total_chp=0; total_img=0
  failed_all=""
  shard_lines=""
  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    imp=$(jq -r '.stats.imported // 0' "$f")
    skp=$(jq -r '.stats.skipped // 0' "$f")
    fld=$(jq -r '.stats.failed // 0' "$f")
    chp=$(jq -r '.stats.chapters // 0' "$f")
    img=$(jq -r '.stats.images // 0' "$f")
    fp=$(jq -r '(.stats.failedPages // []) | join(",")' "$f")
    last=$(jq -r '.lastCompletedPage // 0' "$f")
    name=$(basename "$f" .json)
    shard_lines+="  ${name}: imp=${imp} skp=${skp} fld=${fld} ch=${chp} img=${img} last=${last}"
    [ -n "$fp" ] && shard_lines+=" failedPages=[${fp}]"
    shard_lines+=$'\n'
    total_imp=$((total_imp + imp))
    total_skp=$((total_skp + skp))
    total_fld=$((total_fld + fld))
    total_chp=$((total_chp + chp))
    total_img=$((total_img + img))
    [ -n "$fp" ] && failed_all+="${fp},"
  done
  summary="${shard_lines}TOTAL: imp=${total_imp} skp=${total_skp} fld=${total_fld} ch=${total_chp} img=${total_img}"
  [ -n "$failed_all" ] && summary+=$'\n'"Failed pages across shards: ${failed_all%,}"
fi

# ── Optional DB summary ───────────────────────────────────────────
db_line=""
if [ "$WITH_DB" -eq 1 ]; then
  db_raw=$(docker exec -i "${COMPOSE_PROJECT_NAME}-postgres-1" \
    psql -U comichub -d comichub -t -A -F'|' 2>/dev/null <<'SQL' || true
SELECT
  (SELECT COUNT(*) FROM manga_sources WHERE source='comix'),
  (SELECT COUNT(*) FROM chapter_sources WHERE source='comix'),
  pg_size_pretty(pg_database_size('comichub'));
SQL
  )
  if [ -n "$db_raw" ]; then
    IFS='|' read -r m c s <<< "$db_raw"
    db_line="DB: manga=${m} chapters=${c} size=${s}"
  fi
fi

echo "$summary"
[ -n "$db_line" ] && echo "$db_line"

if [ "$NOTIFY" -eq 1 ]; then
  msg="📊 Comix progress"$'\n'"$summary"
  [ -n "$db_line" ] && msg+=$'\n'"$db_line"
  "${SCRIPT_DIR}/telegram-notify.sh" "$msg" || true
fi
