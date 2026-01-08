CREATE TABLE IF NOT EXISTS "customer_ibans" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"iban" text NOT NULL,
	"bank_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'customer_ibans_customer_id_customers_id_fk'
	) THEN
		ALTER TABLE "customer_ibans" ADD CONSTRAINT "customer_ibans_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_ibans_customerid_idx" ON "customer_ibans" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_ibans_iban_idx" ON "customer_ibans" USING btree ("iban");