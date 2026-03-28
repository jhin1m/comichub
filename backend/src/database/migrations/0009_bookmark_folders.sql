-- Create bookmark_folders table
CREATE TABLE "bookmark_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add folder_id column to follows table
ALTER TABLE "follows" ADD COLUMN "folder_id" integer;--> statement-breakpoint

-- Create indexes for bookmark_folders
CREATE UNIQUE INDEX "bookmark_folders_user_slug_idx" ON "bookmark_folders" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "bookmark_folders_user_idx" ON "bookmark_folders" USING btree ("user_id");--> statement-breakpoint

-- Create index for follows.folder_id
CREATE INDEX "follows_folder_idx" ON "follows" USING btree ("folder_id");--> statement-breakpoint

-- Add foreign keys
ALTER TABLE "bookmark_folders" ADD CONSTRAINT "bookmark_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_folder_id_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."bookmark_folders"("id") ON DELETE set null ON UPDATE no action;
