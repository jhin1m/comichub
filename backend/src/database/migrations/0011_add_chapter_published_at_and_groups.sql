-- Add published_at to chapters (original publish date from source)
ALTER TABLE "chapters" ADD COLUMN "published_at" timestamp;

-- chapter_groups pivot: many-to-many between chapters and scanlation groups
CREATE TABLE IF NOT EXISTS "chapter_groups" (
  "chapter_id" integer NOT NULL REFERENCES "chapters"("id") ON DELETE CASCADE,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chapter_groups_unique_idx" ON "chapter_groups" ("chapter_id", "group_id");
CREATE INDEX IF NOT EXISTS "chapter_groups_group_id_idx" ON "chapter_groups" ("group_id");
