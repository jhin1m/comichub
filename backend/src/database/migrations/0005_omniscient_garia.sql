ALTER TABLE "manga" ADD COLUMN "alt_titles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "original_language" varchar(10);--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "demographic" varchar(20);--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "manga" ADD COLUMN "chapter_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "manga" DROP COLUMN "title_alt";