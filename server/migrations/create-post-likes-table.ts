/**
 * Migration script to create the post_likes table
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
  log("Starting migration to create post_likes table", "migration");

  try {
    // Check if the post_likes table already exists
    const checkTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'post_likes'
      );
    `);

    const tableExists = checkTableResult.rows[0].exists;
    
    if (!tableExists) {
      // Create the post_likes table if it doesn't exist
      await pool.query(`
        CREATE TABLE post_likes (
          id SERIAL,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, post_id)
        );
      `);
      log("Post likes table created successfully", "migration");
    } else {
      log("Post likes table already exists, skipping creation", "migration");
    }

    log("Post likes table migration completed", "migration");
    return true;
  } catch (error) {
    log(`Error creating post_likes table: ${error}`, "migration");
    throw error;
  }
}