CREATE UNIQUE INDEX "chapter_images_chapter_page_idx" ON "chapter_images" USING btree ("chapter_id","page_number");--> statement-breakpoint
CREATE INDEX "chapter_images_chapter_order_idx" ON "chapter_images" USING btree ("chapter_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_manga_slug_idx" ON "chapters" USING btree ("manga_id","slug");