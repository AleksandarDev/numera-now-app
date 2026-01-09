-- Create dashboard_layouts table for storing user dashboard widget configurations
CREATE TABLE IF NOT EXISTS "dashboard_layouts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"widgets_config" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "dashboard_layouts_userid_idx" ON "dashboard_layouts" ("user_id");
