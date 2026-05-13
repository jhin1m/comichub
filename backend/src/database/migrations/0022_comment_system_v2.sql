CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'flagged', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."comment_report_reason" AS ENUM('spam', 'harassment', 'hate_speech', 'sexual_content', 'spoiler', 'misinformation', 'other');--> statement-breakpoint
CREATE TYPE "public"."comment_report_status" AS ENUM('pending', 'resolved', 'dismissed');--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "pinned_by" integer;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "mentioned_user_ids" integer[] DEFAULT '{}'::int[] NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "moderation_status" "moderation_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "moderation_score" jsonb;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"content" text NOT NULL,
	"edited_at" timestamp DEFAULT now() NOT NULL,
	"editor_id" integer
);--> statement-breakpoint
ALTER TABLE "comment_revisions" ADD CONSTRAINT "comment_revisions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_revisions" ADD CONSTRAINT "comment_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_revisions_comment_idx" ON "comment_revisions" ("comment_id","edited_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comment_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"reporter_id" integer NOT NULL,
	"reason" "comment_report_reason" NOT NULL,
	"details" text,
	"status" "comment_report_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "comment_reports_unique_idx" ON "comment_reports" ("comment_id","reporter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_reports_status_idx" ON "comment_reports" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_pinned_idx" ON "comments" ("commentable_type","commentable_id","is_pinned");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_moderation_idx" ON "comments" ("moderation_status");
