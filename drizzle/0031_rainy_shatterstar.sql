CREATE TABLE "open_finances_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"exposed_metrics" text DEFAULT '{}' NOT NULL,
	"page_title" text,
	"page_description" text,
	"date_from" timestamp,
	"date_to" timestamp,
	"allow_embedding" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "open_finances_settings_userid_idx" ON "open_finances_settings" USING btree ("user_id");