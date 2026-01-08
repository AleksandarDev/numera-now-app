import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// Load env file only in local development (Vercel provides env vars directly)
if (process.env.VERCEL !== '1') {
    config({ path: '.env' });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

const main = async () => {
    const isProduction = process.env.VERCEL_ENV === 'production';
    const isPreview = process.env.VERCEL_ENV === 'preview';
    const branchName = process.env.VERCEL_GIT_COMMIT_REF || 'local';

    console.log(`🔄 Running migrations...`);
    console.log(`   Environment: ${process.env.VERCEL_ENV || 'local'}`);
    console.log(`   Branch: ${branchName}`);

    if (isPreview) {
        console.log(`   📌 Using Neon preview branch (via Vercel integration)`);
    } else if (isProduction) {
        console.log(`   🚀 Migrating production database`);
    }

    try {
        await migrate(db, { migrationsFolder: 'drizzle' });
        console.log('✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    }
};

main();
