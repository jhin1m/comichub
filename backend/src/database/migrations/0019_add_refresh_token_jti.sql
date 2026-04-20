-- H3: add jti to refresh_tokens for reuse detection.
-- Nullable for backfill — existing rows stay valid until next rotation populates jti.
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "jti" text;
