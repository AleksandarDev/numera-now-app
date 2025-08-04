ALTER TABLE "accounts" ADD COLUMN "is_open" boolean DEFAULT true NOT NULL;

-- Close accounts that have no linked transactions
UPDATE "accounts" 
SET "is_open" = false 
WHERE "id" NOT IN (
    SELECT DISTINCT "account_id" FROM "transactions" WHERE "account_id" IS NOT NULL
    UNION
    SELECT DISTINCT "credit_account_id" FROM "transactions" WHERE "credit_account_id" IS NOT NULL
    UNION
    SELECT DISTINCT "debit_account_id" FROM "transactions" WHERE "debit_account_id" IS NOT NULL
);