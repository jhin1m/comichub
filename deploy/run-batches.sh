#!/usr/bin/env bash
# Chạy import-campaign.sh theo batch nhỏ (mặc định 15 pages × 3 shard).
# Stop-on-fail: dừng ngay nếu 1 batch exit != 0 để review.
#
# Usage:
#   ./deploy/run-batches.sh [FROM] [END] [STEP] [COOLDOWN_SEC]
#   ./deploy/run-batches.sh 101 700 15 60
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FROM="${1:-101}"
END="${2:-700}"
STEP="${3:-15}"
COOLDOWN="${4:-60}"

if [ "$FROM" -gt "$END" ]; then
  echo "[✗] FROM ($FROM) > END ($END)"; exit 1
fi

total=$(( (END - FROM + STEP) / STEP ))
current=$FROM
batch_num=0

echo "=== run-batches: ${FROM}-${END}, step=${STEP}, cooldown=${COOLDOWN}s, total=${total} ==="

while [ "$current" -le "$END" ]; do
  batch_num=$((batch_num + 1))
  batch_end=$((current + STEP - 1))
  [ "$batch_end" -gt "$END" ] && batch_end=$END

  echo ""
  echo "=== [${batch_num}/${total}] Batch pages ${current}-${batch_end} starting at $(date -Iseconds) ==="

  if ! "${SCRIPT_DIR}/import-campaign.sh" batch "$current" "$batch_end"; then
    echo "[✗] Batch ${current}-${batch_end} FAILED — stop-on-fail triggered"
    exit 1
  fi

  echo "=== [${batch_num}/${total}] Batch ${current}-${batch_end} done at $(date -Iseconds) ==="

  current=$((batch_end + 1))
  if [ "$current" -le "$END" ]; then
    echo "... cooldown ${COOLDOWN}s before next batch ..."
    sleep "$COOLDOWN"
  fi
done

echo ""
echo "=== ALL batches done: ${FROM}-${END} ==="
