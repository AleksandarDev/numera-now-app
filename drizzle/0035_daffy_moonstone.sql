ALTER TABLE "tags" ADD COLUMN "tag_type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
CREATE INDEX "tags_tagtype_idx" ON "tags" USING btree ("tag_type");