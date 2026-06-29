ALTER TABLE "customer_ibans" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_ibans" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "customer_ibans" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "customer_ibans" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "customer_ibans" ADD COLUMN "restored_at" timestamp;--> statement-breakpoint
ALTER TABLE "customer_ibans" ADD COLUMN "restored_by" text;--> statement-breakpoint
ALTER TABLE "customer_ibans" ADD COLUMN "restore_reason" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "restored_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "restored_by" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "restore_reason" text;--> statement-breakpoint
CREATE INDEX "customer_ibans_isdeleted_idx" ON "customer_ibans" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "customer_ibans_deletedat_idx" ON "customer_ibans" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customer_ibans_deletedby_idx" ON "customer_ibans" USING btree ("deleted_by");--> statement-breakpoint
CREATE INDEX "customers_isdeleted_idx" ON "customers" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "customers_deletedat_idx" ON "customers" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customers_deletedby_idx" ON "customers" USING btree ("deleted_by");