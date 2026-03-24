ALTER TABLE "user_content_preferences" RENAME COLUMN "excluded_genre_ids" TO "excluded_genre_slugs";--> statement-breakpoint
ALTER TABLE "user_content_preferences" RENAME COLUMN "highlighted_genre_ids" TO "highlighted_genre_slugs";
