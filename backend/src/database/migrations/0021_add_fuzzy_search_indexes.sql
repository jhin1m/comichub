-- no-transaction
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- drizzle-kit splits statements by --> statement-breakpoint and executes each
-- individually; keeping this file to two standalone statements avoids BEGIN wrapping.
-- If the shipped drizzle-kit wraps anyway, apply this file manually: psql -f 0021_*.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "manga_search_title_trgm_idx"
  ON "manga" USING GIN ("search_title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "manga_search_alt_trgm_idx"
  ON "manga" USING GIN ("search_alt" gin_trgm_ops);
