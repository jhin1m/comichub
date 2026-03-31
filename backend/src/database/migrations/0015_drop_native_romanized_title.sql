-- Backfill: append non-null native_title/romanized_title into alt_titles (deduplicated)
UPDATE "manga"
SET "alt_titles" = (
  SELECT jsonb_agg(DISTINCT val)
  FROM (
    SELECT val FROM jsonb_array_elements_text("alt_titles") AS val
    UNION
    SELECT "native_title" WHERE "native_title" IS NOT NULL AND "native_title" <> ''
    UNION
    SELECT "romanized_title" WHERE "romanized_title" IS NOT NULL AND "romanized_title" <> ''
  ) AS combined
)
WHERE "native_title" IS NOT NULL OR "romanized_title" IS NOT NULL;--> statement-breakpoint

-- Drop the redundant columns
ALTER TABLE "manga" DROP COLUMN IF EXISTS "native_title";--> statement-breakpoint
ALTER TABLE "manga" DROP COLUMN IF EXISTS "romanized_title";
