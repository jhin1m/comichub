-- C3: one pending report per (user, chapter, type). Resolved/rejected allow re-report.
-- Pre-clean: drop existing duplicate pending rows (keep oldest) to avoid index build failure.
DELETE FROM chapter_reports a
USING chapter_reports b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.chapter_id = b.chapter_id
  AND a.type = b.type
  AND a.status = 'pending'
  AND b.status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS "report_unique_pending_idx"
  ON "chapter_reports" ("user_id", "chapter_id", "type")
  WHERE status = 'pending';
