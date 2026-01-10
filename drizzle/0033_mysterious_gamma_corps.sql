ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "account_class" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "opening_balance" integer DEFAULT 0 NOT NULL;