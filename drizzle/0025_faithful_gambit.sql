ALTER TABLE "customers" ADD COLUMN "is_own_firm" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "customers_isownfirm_idx" ON "customers" USING btree ("is_own_firm");