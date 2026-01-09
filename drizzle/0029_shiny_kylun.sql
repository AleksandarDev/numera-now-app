DO $$
BEGIN
    -- Drop constraint only if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stripe_settings_default_category_id_categories_id_fk'
        AND table_name = 'stripe_settings'
    ) THEN
        ALTER TABLE "stripe_settings" DROP CONSTRAINT "stripe_settings_default_category_id_categories_id_fk";
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "stripe_settings" ADD COLUMN IF NOT EXISTS "default_tag_id" text;--> statement-breakpoint
DO $$
BEGIN
    -- Add constraint only if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stripe_settings_default_tag_id_tags_id_fk'
        AND table_name = 'stripe_settings'
    ) THEN
        ALTER TABLE "stripe_settings" ADD CONSTRAINT "stripe_settings_default_tag_id_tags_id_fk" FOREIGN KEY ("default_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    -- Drop column only if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stripe_settings' 
        AND column_name = 'default_category_id'
    ) THEN
        ALTER TABLE "stripe_settings" DROP COLUMN "default_category_id";
    END IF;
END $$;