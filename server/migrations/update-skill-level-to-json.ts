import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration script to change skill_level from a string to a JSON object
 * that stores skill levels for each sport
 */
export async function runSkillLevelMigration() {
  console.log("Starting migration to update skill_level to JSON format");

  try {
    // Check if skill_level column exists and is not a JSON type
    const checkColumnResult = await db.execute(sql`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'skill_level'
    `);

    if (checkColumnResult.rows.length === 0) {
      console.log("skill_level column doesn't exist, skipping migration");
      return;
    }

    const dataType = (checkColumnResult.rows[0].data_type as string).toLowerCase();
    if (dataType === 'json' || dataType === 'jsonb') {
      console.log("skill_level is already JSON type, skipping migration");
      return;
    }

    // Backup existing data
    console.log("Backing up existing skill level data...");
    const users = await db.execute(sql`
      SELECT id, skill_level FROM users WHERE skill_level IS NOT NULL
    `);

    // Alter the column to be JSON type
    await db.execute(sql`
      ALTER TABLE users 
      ALTER COLUMN skill_level TYPE JSONB USING 
      CASE 
        WHEN skill_level IS NULL THEN NULL
        ELSE jsonb_build_object('overall', skill_level)
      END
    `);

    console.log("Successfully changed skill_level to JSON type");

  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

// Single export above is sufficient