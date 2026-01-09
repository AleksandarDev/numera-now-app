CREATE TABLE "dashboard_layouts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"widgets_config" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dashboard_layouts_userid_idx" ON "dashboard_layouts" USING btree ("user_id");