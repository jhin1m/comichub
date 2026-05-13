-- no-transaction
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- drizzle-kit splits statements by --> statement-breakpoint and executes each
-- individually; keeping this file to one standalone statement avoids BEGIN wrapping.
-- If the shipped drizzle-kit wraps anyway, apply manually: psql -f 0023_*.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "comments_mentioned_users_idx"
  ON "comments" USING GIN ("mentioned_user_ids");
