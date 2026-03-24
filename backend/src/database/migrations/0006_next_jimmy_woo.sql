CREATE TABLE "user_content_preferences" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"hide_nsfw" boolean DEFAULT true NOT NULL,
	"excluded_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_demographics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_genre_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlighted_genre_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_content_preferences" ADD CONSTRAINT "user_content_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;