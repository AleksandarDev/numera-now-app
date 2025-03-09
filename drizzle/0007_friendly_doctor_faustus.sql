DROP INDEX "transactions_creditaccountid_idx";--> statement-breakpoint
DROP INDEX "transactions_debutaccountid_idx";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "credit_account_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "debit_account_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_account_id_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debit_account_id_accounts_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_creditaccountid_idx" ON "transactions" USING btree ("credit_account_id");--> statement-breakpoint
CREATE INDEX "transactions_debutaccountid_idx" ON "transactions" USING btree ("debit_account_id");