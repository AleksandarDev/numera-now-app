CREATE TABLE "settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"double_entry_mode" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "settings_userid_idx" ON "settings" USING btree ("user_id");