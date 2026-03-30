-- Add group_id to chapter_images so same chapter can have images from multiple scanlation groups
ALTER TABLE "chapter_images" ADD COLUMN "group_id" integer REFERENCES "groups"("id") ON DELETE SET NULL;

-- Replace old unique index with one that includes group_id
DROP INDEX IF EXISTS "chapter_images_chapter_page_idx";
-- NULLS NOT DISTINCT ensures (chapter_id, page_number, NULL) is also unique (PG 15+)
CREATE UNIQUE INDEX "chapter_images_chapter_page_group_idx" ON "chapter_images" ("chapter_id", "page_number", "group_id") NULLS NOT DISTINCT;

-- Index for querying images by group
CREATE INDEX "chapter_images_group_idx" ON "chapter_images" ("group_id");
