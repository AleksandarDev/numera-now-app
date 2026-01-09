CREATE TABLE "stripe_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_account_id" text,
	"stripe_secret_key" text,
	"webhook_secret" text,
	"default_credit_account_id" text,
	"default_debit_account_id" text,
	"default_category_id" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "stripe_payment_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "stripe_payment_url" text;--> statement-breakpoint
ALTER TABLE "stripe_settings" ADD CONSTRAINT "stripe_settings_default_credit_account_id_accounts_id_fk" FOREIGN KEY ("default_credit_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_settings" ADD CONSTRAINT "stripe_settings_default_debit_account_id_accounts_id_fk" FOREIGN KEY ("default_debit_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_settings" ADD CONSTRAINT "stripe_settings_default_category_id_categories_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_settings_userid_idx" ON "stripe_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stripe_settings_stripeaccountid_idx" ON "stripe_settings" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "transactions_stripepaymentid_idx" ON "transactions" USING btree ("stripe_payment_id");