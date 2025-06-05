/**
 * Migration script to add approval status and search source fields to facilities and events tables
 * This supports the web search integration functionality
 */

import pg from 'pg';
import { db } from '../db';
import { facilities, events } from '@shared/schema';
import { sql } from 'drizzle-orm';

const { Pool } = pg;

/**
 * Helper function to check if a column exists in a table
 */
async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    // Access the database client directly to check column existence
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [tableName, columnName]);
    
    await pool.end();
    
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in table ${tableName}:`, error);
    return false;
  }
}

/**
 * Main migration function
 */
export async function runMigration() {
  console.log('Starting migration to add web search approval columns...');
  
  try {
    // Check if the columns already exist in the facilities table
    const facilityApprovalStatusExists = await checkColumnExists('facilities', 'approval_status');
    const facilitySearchSourceExists = await checkColumnExists('facilities', 'search_source');
    
    if (!facilityApprovalStatusExists) {
      console.log('Adding approval_status column to facilities table...');
      await db.execute(sql`
        ALTER TABLE facilities 
        ADD COLUMN approval_status TEXT DEFAULT 'approved'
      `);
      console.log('Successfully added approval_status column to facilities table');
    } else {
      console.log('approval_status column already exists in facilities table');
    }
    
    if (!facilitySearchSourceExists) {
      console.log('Adding search_source column to facilities table...');
      await db.execute(sql`
        ALTER TABLE facilities 
        ADD COLUMN search_source TEXT
      `);
      console.log('Successfully added search_source column to facilities table');
    } else {
      console.log('search_source column already exists in facilities table');
    }
    
    // Check if the columns already exist in the events table
    const eventApprovalStatusExists = await checkColumnExists('events', 'approval_status');
    const eventSearchSourceExists = await checkColumnExists('events', 'search_source');
    
    if (!eventApprovalStatusExists) {
      console.log('Adding approval_status column to events table...');
      await db.execute(sql`
        ALTER TABLE events 
        ADD COLUMN approval_status TEXT DEFAULT 'approved'
      `);
      console.log('Successfully added approval_status column to events table');
    } else {
      console.log('approval_status column already exists in events table');
    }
    
    if (!eventSearchSourceExists) {
      console.log('Adding search_source column to events table...');
      await db.execute(sql`
        ALTER TABLE events 
        ADD COLUMN search_source TEXT
      `);
      console.log('Successfully added search_source column to events table');
    } else {
      console.log('search_source column already exists in events table');
    }
    
    console.log('Migration completed successfully!');
    
    // For existing records, set approval_status to 'approved' if it's null
    console.log('Updating existing records with default approval status...');
    
    await db.execute(sql`
      UPDATE facilities 
      SET approval_status = 'approved' 
      WHERE approval_status IS NULL
    `);
    
    await db.execute(sql`
      UPDATE events 
      SET approval_status = 'approved' 
      WHERE approval_status IS NULL
    `);
    
    console.log('Successfully updated existing records');
    
    return true;
  } catch (error) {
    console.error('Error running migration:', error);
    return false;
  }
}