-- Convert comment timestamps from `timestamp` (no tz) to `timestamptz`.
-- Bug context: postgres-js parses `timestamp` columns as UTC, but PG stored
-- Asia/Ho_Chi_Minh wall clock → values arrive at the browser 7h in the future
-- and `formatRelativeDate` returns "just now" for every recent comment.
--
-- The USING expression reinterprets existing wall-clock values as Asia/Ho_Chi_Minh
-- local time, which is what the application server's session timezone has been
-- throughout development. After this migration, postgres-js will read values
-- with correct UTC offsets and JSON serialization preserves them.
ALTER TABLE "comments"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "deleted_at" TYPE timestamptz USING "deleted_at" AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "pinned_at" TYPE timestamptz USING "pinned_at" AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "edited_at" TYPE timestamptz USING "edited_at" AT TIME ZONE 'Asia/Ho_Chi_Minh';--> statement-breakpoint
ALTER TABLE "comment_revisions"
  ALTER COLUMN "edited_at" TYPE timestamptz USING "edited_at" AT TIME ZONE 'Asia/Ho_Chi_Minh';--> statement-breakpoint
ALTER TABLE "comment_reports"
  ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "resolved_at" TYPE timestamptz USING "resolved_at" AT TIME ZONE 'Asia/Ho_Chi_Minh';
