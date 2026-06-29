ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "restored_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "restored_by" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "restore_reason" text;--> statement-breakpoint
CREATE INDEX "documents_deletedat_idx" ON "documents" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "documents_deletedby_idx" ON "documents" USING btree ("deleted_by");