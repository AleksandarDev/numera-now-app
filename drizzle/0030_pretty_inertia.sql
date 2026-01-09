DO $$
BEGIN
    -- Disable RLS only if categories table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        ALTER TABLE "categories" DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_category_id_categories_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_categoryid_idx";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "category_id";--> statement-breakpoint
DROP TABLE IF EXISTS "categories" CASCADE;