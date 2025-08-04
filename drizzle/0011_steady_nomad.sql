CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pin" text,
	"vat_number" text,
	"address" text,
	"contact_email" text,
	"contact_telephone" text,
	"user_id" text NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "payee" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payee_customer_id" text;--> statement-breakpoint
CREATE INDEX "customers_userid_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_pin_idx" ON "customers" USING btree ("pin");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payee_customer_id_customers_id_fk" FOREIGN KEY ("payee_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_payeecustomerid_idx" ON "transactions" USING btree ("payee_customer_id");