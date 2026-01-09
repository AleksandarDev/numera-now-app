DO $$
BEGIN
    -- Only migrate if categories table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        INSERT INTO "tags" ("id", "name", "color", "user_id", "created_at")
        SELECT 
            "id",
            "name",
            NULL as "color",
            "user_id",
            NOW() as "created_at"
        FROM "categories"
        ON CONFLICT ("id") DO NOTHING;
    END IF;

    -- Only migrate if transactions.category_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'category_id') THEN
        INSERT INTO "transaction_tags" ("id", "transaction_id", "tag_id", "created_at")
        SELECT 
            gen_random_uuid()::text as "id",
            "transactions"."id" as "transaction_id",
            "transactions"."category_id" as "tag_id",
            NOW() as "created_at"
        FROM "transactions"
        WHERE "transactions"."category_id" IS NOT NULL
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END $$;
