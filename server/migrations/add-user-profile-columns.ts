import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration script to add profile fields to the users table
 */
async function runMigration() {
  console.log("Starting migration to add profile fields to users table");

  try {
    // Check if preferred_sports column exists
    const checkColumnResult = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'preferred_sports'
    `);

    // If column already exists, skip migration
    if (checkColumnResult.rows.length > 0) {
      console.log("Preferred sports column already exists, skipping migration");
      return;
    }

    // Add missing columns if they don't exist
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS preferred_sports TEXT[],
      ADD COLUMN IF NOT EXISTS skill_level TEXT,
      ADD COLUMN IF NOT EXISTS preferred_locations TEXT[],
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS phone_number TEXT
    `);

    console.log("Successfully added user profile columns");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

// Direct script execution is handled differently in ES modules
// This will be run when imported by server/index.ts

export { runMigration };