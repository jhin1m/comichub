ALTER TABLE "comment_likes" ADD COLUMN "is_dislike" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "dislikes_count" integer DEFAULT 0 NOT NULL;