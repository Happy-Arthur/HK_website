/**
 * Migration script to add groupId column to events table
 */
import pkg from 'pg';
const { Pool } = pkg;
import { log } from "../vite";

// Get database connection string from environment
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function runMigration() {
  log("Starting migration to add groupId to events table", "migration");

  try {
    // Check if the group_id column already exists in the events table
    const checkColumnResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'events'
        AND column_name = 'group_id'
      );
    `);

    const columnExists = checkColumnResult.rows[0].exists;
    
    if (!columnExists) {
      // Add the group_id column to the events table
      await pool.query(`
        ALTER TABLE events 
        ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;
      `);
      
      log("Added group_id column to events table successfully", "migration");
    } else {
      log("group_id column already exists in events table, skipping creation", "migration");
    }

    log("Event group_id migration completed", "migration");
    return true;
  } catch (error) {
    log(`Error adding group_id to events table: ${error}`, "migration");
    throw error;
  }
}