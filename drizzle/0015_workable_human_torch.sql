CREATE TABLE "transaction_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"changed_by" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status_changed_by" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "split_group_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "split_type" text;--> statement-breakpoint
ALTER TABLE "transaction_status_history" ADD CONSTRAINT "transaction_status_history_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_status_history_transactionid_idx" ON "transaction_status_history" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_status_history_changedat_idx" ON "transaction_status_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_splitgroupid_idx" ON "transactions" USING btree ("split_group_id");