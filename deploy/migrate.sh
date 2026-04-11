#!/bin/sh
set -e

# Apply pending SQL migrations via psql.
# Tracks applied migrations by hash in drizzle.__drizzle_migrations
# to stay compatible with drizzle-kit's schema. Idempotent — safe to re-run.

PSQL="psql -h postgres -U comichub -d comichub"

# Create tracking schema + table (IF NOT EXISTS = idempotent)
$PSQL -q -c "
  CREATE SCHEMA IF NOT EXISTS drizzle;
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint NOT NULL
  );
"

applied=0
skipped=0

for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  tag=$(basename "$f" .sql)
  hash=$(md5sum "$f" | cut -d' ' -f1)

  # Skip if already applied (by hash)
  count=$($PSQL -tAc "SELECT COUNT(*) FROM drizzle.__drizzle_migrations WHERE hash = '$hash';")
  if [ "$count" != "0" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  echo "Applying: $tag"
  # Remove drizzle's statement-breakpoint markers and execute
  sed 's/--> statement-breakpoint//g' "$f" | $PSQL -q 2>&1
  if [ $? -ne 0 ]; then
    echo "FAILED: $tag"
    exit 1
  fi

  # Record as applied
  $PSQL -q -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$hash', $(date +%s)000);"
  applied=$((applied + 1))
done

echo "Migrations complete: $applied applied, $skipped skipped"
