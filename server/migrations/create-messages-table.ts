/**
 * Migration script to create the messages table
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
  log("Starting migration to create messages table", "migration");

  try {
    // Check if the messages table already exists
    const checkTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'messages'
      );
    `);

    const tableExists = checkTableResult.rows[0].exists;
    
    if (!tableExists) {
      // Create the messages table if it doesn't exist
      await pool.query(`
        CREATE TABLE messages (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER NOT NULL REFERENCES users(id),
          receiver_id INTEGER NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      log("Messages table created successfully", "migration");
    } else {
      log("Messages table already exists, skipping creation", "migration");
    }

    log("Messages table migration completed", "migration");
    return true;
  } catch (error) {
    log(`Error creating messages table: ${error}`, "migration");
    throw error;
  }
}