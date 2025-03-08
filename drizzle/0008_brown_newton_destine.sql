ALTER TABLE "transactions" ALTER COLUMN "credit_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "debit_account_id" DROP NOT NULL;