ALTER TABLE "transactions" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "restored_at" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "restored_by" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "restore_reason" text;--> statement-breakpoint
CREATE INDEX "transactions_deletedat_idx" ON "transactions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "transactions_deletedby_idx" ON "transactions" USING btree ("deleted_by");