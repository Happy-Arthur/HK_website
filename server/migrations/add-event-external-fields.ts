/**
 * Migration script to add website, imageUrl, and location fields to the events table
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { log } from '../vite';

async function runMigration() {
  try {
    log('Starting migration to add external fields to events table...', 'migration');

    // Check if website column exists
    const websiteExists = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'website';
    `);

    if (websiteExists.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE events ADD COLUMN website TEXT;
      `);
      log('Added website column to events table', 'migration');
    } else {
      log('website column already exists in events table', 'migration');
    }

    // Check if image_url column exists
    const imageUrlExists = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'image_url';
    `);

    if (imageUrlExists.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE events ADD COLUMN image_url TEXT;
      `);
      log('Added image_url column to events table', 'migration');
    } else {
      log('image_url column already exists in events table', 'migration');
    }

    // Check if location column exists
    const locationExists = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'location';
    `);

    if (locationExists.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE events ADD COLUMN location JSONB;
      `);
      log('Added location column to events table', 'migration');
    } else {
      log('location column already exists in events table', 'migration');
    }

    log('Migration completed successfully!', 'migration');
  } catch (error) {
    log(`Error during migration: ${error}`, 'migration');
    throw error;
  }
}

export { runMigration };