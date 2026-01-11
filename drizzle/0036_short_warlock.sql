CREATE TABLE "accounting_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"closed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "system_role" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "closing_period_id" text;--> statement-breakpoint
CREATE INDEX "accounting_periods_userid_idx" ON "accounting_periods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounting_periods_status_idx" ON "accounting_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounting_periods_startdate_idx" ON "accounting_periods" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "accounting_periods_enddate_idx" ON "accounting_periods" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "accounts_systemrole_idx" ON "accounts" USING btree ("system_role");--> statement-breakpoint
CREATE INDEX "transactions_closingperiodid_idx" ON "transactions" USING btree ("closing_period_id");