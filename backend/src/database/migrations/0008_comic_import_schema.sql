-- Add new enums
CREATE TYPE "public"."import_source" AS ENUM('mangabaka', 'comick', 'weebdex');--> statement-breakpoint
CREATE TYPE "public"."content_rating" AS ENUM('safe', 'suggestive', 'erotica', 'pornographic');--> statement-breakpoint

-- Expand manga_status enum (must be outside transaction in Postgres)
ALTER TYPE "public"."manga_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint

-- Add columns to manga table
ALTER TABLE "manga" ADD COLUMN "content_rating" "content_rating" NOT NULL DEFAULT 'safe';--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "native_title" varchar(500);--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "romanized_title" varchar(500);--> statement-breakpoint

-- Add columns to genres table
ALTER TABLE "genres" ADD COLUMN "group" varchar(20) NOT NULL DEFAULT 'genre';--> statement-breakpoint

-- Add columns to chapters table
ALTER TABLE "chapters" ADD COLUMN "language" varchar(10) NOT NULL DEFAULT 'vi';--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "volume" varchar(20);--> statement-breakpoint

-- Update chapters unique constraint: drop old (manga_id, number), add new (manga_id, number, language)
DROP INDEX IF EXISTS "chapters_manga_number_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_manga_number_lang_idx" ON "chapters" USING btree ("manga_id","number","language");--> statement-breakpoint

-- Add columns to chapter_images table
ALTER TABLE "chapter_images" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "chapter_images" ADD COLUMN "height" integer;--> statement-breakpoint

-- Create manga_sources table
CREATE TABLE "manga_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"manga_id" integer NOT NULL,
	"source" "import_source" NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"external_slug" varchar(300),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create chapter_sources table
CREATE TABLE "chapter_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"source" "import_source" NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create manga_links table
CREATE TABLE "manga_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"manga_id" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"external_id" varchar(100),
	"url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign keys
ALTER TABLE "manga_sources" ADD CONSTRAINT "manga_sources_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_sources" ADD CONSTRAINT "chapter_sources_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_links" ADD CONSTRAINT "manga_links_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Indexes for new tables
CREATE UNIQUE INDEX "manga_sources_source_ext_id_idx" ON "manga_sources" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "manga_sources_manga_id_idx" ON "manga_sources" USING btree ("manga_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_sources_source_ext_id_idx" ON "chapter_sources" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "chapter_sources_chapter_id_idx" ON "chapter_sources" USING btree ("chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manga_links_manga_type_idx" ON "manga_links" USING btree ("manga_id","type");
