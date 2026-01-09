ALTER TABLE "documents" DROP CONSTRAINT "documents_transaction_id_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "transaction_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;