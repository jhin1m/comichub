-- Backfill: rows with is_nsfw=true but content_rating='safe' → set to 'suggestive'
UPDATE "manga" SET "content_rating" = 'suggestive' WHERE "is_nsfw" = true AND "content_rating" = 'safe';--> statement-breakpoint

-- Change default from 'safe' to 'suggestive'
ALTER TABLE "manga" ALTER COLUMN "content_rating" SET DEFAULT 'suggestive';--> statement-breakpoint

-- Drop the redundant boolean column
ALTER TABLE "manga" DROP COLUMN IF EXISTS "is_nsfw";
