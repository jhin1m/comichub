#!/usr/bin/env bash
# Query DB for comix import progress. Emits pipe-separated summary.
# Usage: import-progress.sh                # print to stdout
#        import-progress.sh --notify       # also send Telegram notification
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.deploy"
[ -f "$ENV_FILE" ] || { echo "[✗] .env.deploy not found" >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-comichub}"
PSQL() {
  docker exec -i "${COMPOSE_PROJECT_NAME}-postgres-1" \
    psql -U comichub -d comichub -t -A -F'|' "$@" 2>/dev/null
}

SUMMARY=$(PSQL <<'SQL'
SELECT
  (SELECT COUNT(*) FROM manga_sources WHERE source='comix')     AS manga,
  (SELECT COUNT(*) FROM chapter_sources WHERE source='comix')   AS chapters,
  (SELECT COUNT(*) FROM chapter_images ci
     JOIN chapter_sources cs ON cs.chapter_id = ci.chapter_id
     WHERE cs.source='comix')                                    AS images,
  COALESCE(
    (SELECT MAX(last_synced_at)::text FROM manga_sources WHERE source='comix'),
    'never'
  ) AS last_sync,
  pg_size_pretty(pg_database_size('comichub')) AS db_size;
SQL
)

if [ -z "${SUMMARY:-}" ]; then
  echo "progress: unavailable (DB query failed)"
  exit 0
fi

IFS='|' read -r MANGA CHAPTERS IMAGES LAST_SYNC DB_SIZE <<< "$SUMMARY"

echo "manga=${MANGA} chapters=${CHAPTERS} images=${IMAGES} db=${DB_SIZE} last_sync=${LAST_SYNC}"

if [ "${1:-}" = "--notify" ]; then
  "${SCRIPT_DIR}/telegram-notify.sh" "📊 Comix progress
manga: ${MANGA}
chapters: ${CHAPTERS}
images: ${IMAGES}
db: ${DB_SIZE}
last sync: ${LAST_SYNC}" || true
fi
