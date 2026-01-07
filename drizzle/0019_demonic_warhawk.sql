DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'min_required_documents') THEN
        ALTER TABLE "settings" ADD COLUMN "min_required_documents" integer DEFAULT 0 NOT NULL;
    END IF;
END $$;