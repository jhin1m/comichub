-- Migration: Add manga metadata fields (altTitles, originalLanguage, isNsfw, year, chapterUpdatedAt)
-- Convert titleAlt (varchar) to altTitles (jsonb array)

-- Add new columns
ALTER TABLE "manga" ADD COLUMN "alt_titles" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "manga" ADD COLUMN "original_language" varchar(10);
ALTER TABLE "manga" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;
ALTER TABLE "manga" ADD COLUMN "year" integer;
ALTER TABLE "manga" ADD COLUMN "chapter_updated_at" timestamp;

-- Migrate existing titleAlt data into altTitles array
UPDATE "manga"
SET "alt_titles" = CASE
  WHEN "title_alt" IS NOT NULL AND "title_alt" != '' THEN jsonb_build_array("title_alt")
  ELSE '[]'::jsonb
END;

-- Drop old titleAlt column
ALTER TABLE "manga" DROP COLUMN "title_alt";
