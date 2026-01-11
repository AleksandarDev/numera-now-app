CREATE TABLE "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"user_id" text NOT NULL,
	"gocardless_account_id" text NOT NULL,
	"iban" text,
	"name" text,
	"owner_name" text,
	"currency" text DEFAULT 'EUR',
	"linked_account_id" text,
	"last_sync_at" timestamp,
	"last_transaction_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requisition_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"institution_name" text NOT NULL,
	"institution_logo" text,
	"agreement_id" text,
	"agreement_expires_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gocardless_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"secret_id" text,
	"secret_key" text,
	"access_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"default_credit_account_id" text,
	"default_debit_account_id" text,
	"default_tag_id" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "gocardless_transaction_id" text;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gocardless_settings" ADD CONSTRAINT "gocardless_settings_default_credit_account_id_accounts_id_fk" FOREIGN KEY ("default_credit_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gocardless_settings" ADD CONSTRAINT "gocardless_settings_default_debit_account_id_accounts_id_fk" FOREIGN KEY ("default_debit_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gocardless_settings" ADD CONSTRAINT "gocardless_settings_default_tag_id_tags_id_fk" FOREIGN KEY ("default_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_connectionid_idx" ON "bank_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_userid_idx" ON "bank_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_gocardlessaccountid_idx" ON "bank_accounts" USING btree ("gocardless_account_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_linkedaccountid_idx" ON "bank_accounts" USING btree ("linked_account_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_isactive_idx" ON "bank_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "bank_connections_userid_idx" ON "bank_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bank_connections_requisitionid_idx" ON "bank_connections" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "bank_connections_institutionid_idx" ON "bank_connections" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "bank_connections_status_idx" ON "bank_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gocardless_settings_userid_idx" ON "gocardless_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_gocardlesstransactionid_idx" ON "transactions" USING btree ("gocardless_transaction_id");