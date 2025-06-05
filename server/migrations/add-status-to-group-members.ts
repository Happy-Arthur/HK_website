import { db } from "../db";
import { sql } from "drizzle-orm";

async function addStatusColumnToGroupMembers() {
  try {
    console.log("Starting migration: Adding status column to group_members table");
    
    // Check if the column already exists
    const checkColumnExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'group_members' 
      AND column_name = 'status'
    `);
    
    // Fix: properly check the rows property
    if (checkColumnExists.rows.length === 0) {
      console.log("Status column does not exist, adding it now");
      
      // Add the status column with 'approved' as default value
      await db.execute(sql`
        ALTER TABLE group_members 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'
      `);
      
      console.log("Successfully added status column to group_members table");
    } else {
      console.log("Status column already exists in group_members table");
    }
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

// Export for use in server/index.ts
export const runMigration = addStatusColumnToGroupMembers;

// Only run as standalone script directly
if (process.argv[1] === import.meta.url) {
  addStatusColumnToGroupMembers()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}