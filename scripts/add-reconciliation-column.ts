import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL!);

const main = async () => {
    try {
        console.log("Adding reconciliation_conditions column to settings table...");
        await sql`ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "reconciliation_conditions" text NOT NULL DEFAULT '["hasReceipt"]'`;
        console.log("Column added successfully!");
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

main();
