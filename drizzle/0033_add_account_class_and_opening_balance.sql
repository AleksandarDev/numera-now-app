-- Add account_class field (nullable for backward compatibility)
ALTER TABLE "accounts" ADD COLUMN "account_class" text;
--> statement-breakpoint
-- Add opening_balance field with default value (not null since it has a default)
ALTER TABLE "accounts" ADD COLUMN "opening_balance" integer NOT NULL DEFAULT 0;
