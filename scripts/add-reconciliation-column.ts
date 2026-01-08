import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env' });

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

const main = async () => {
    try {
        console.log(
            'Adding reconciliation_conditions column to settings table...',
        );
        await sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "reconciliation_conditions" text NOT NULL DEFAULT '["hasReceipt"]'`;
        console.log('Column added successfully!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

main();
