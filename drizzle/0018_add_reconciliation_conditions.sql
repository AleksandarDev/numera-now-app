-- Add reconciliation_conditions column to settings table
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "reconciliation_conditions" text NOT NULL DEFAULT '["hasReceipt"]';
