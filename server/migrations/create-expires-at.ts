// server/migrations/create-expires-at.ts
// Run this script to add the missing expires_at column to the check_ins table

import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Migration script to add the expires_at column to the check_ins table
 * and to make sure facility ratings are properly set up
 */
async function runMigration() {
  console.log("Starting database migration...");

  try {
    // 1. Add expires_at column to check_ins table if it doesn't exist
    console.log("Attempting to add expires_at column to check_ins table...");
    try {
      await db.execute(
        sql`ALTER TABLE check_ins ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 hour';`,
      );
      console.log("✅ Added expires_at column successfully");
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log("ℹ️ expires_at column already exists, skipping");
      } else {
        console.error("❌ Error adding expires_at column:", err.message);
        // Continue with other migrations even if this one fails
      }
    }

    // 2. Make sure average_rating and total_reviews columns exist in facilities table
    console.log("Checking facility rating columns...");

    // Add average_rating column
    try {
      await db.execute(
        sql`ALTER TABLE facilities ADD COLUMN average_rating DOUBLE PRECISION;`,
      );
      console.log("✅ Added average_rating column successfully");
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log("ℹ️ average_rating column already exists, skipping");
      } else {
        console.error("❌ Error adding average_rating column:", err.message);
      }
    }

    // Add total_reviews column
    try {
      await db.execute(
        sql`ALTER TABLE facilities ADD COLUMN total_reviews INTEGER DEFAULT 0;`,
      );
      console.log("✅ Added total_reviews column successfully");
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log("ℹ️ total_reviews column already exists, skipping");
      } else {
        console.error("❌ Error adding total_reviews column:", err.message);
      }
    }

    // 3. Populate existing check-ins with proper expiry times
    console.log("Updating existing check-ins with expiry times...");
    try {
      await db.execute(
        sql`UPDATE check_ins SET expires_at = created_at + INTERVAL '1 hour' WHERE expires_at IS NULL OR expires_at = created_at;`,
      );
      console.log("✅ Updated check-ins with expiry times");
    } catch (err) {
      if (
        err.message &&
        err.message.includes('column "expires_at" does not exist')
      ) {
        console.log(
          "⚠️ Cannot update expires_at as the column creation failed",
        );
      } else {
        console.error("❌ Error updating check-in expiry times:", err.message);
      }
    }

    // 4. Update facility ratings
    console.log("Updating facility ratings...");
    try {
      await db.execute(sql`
        UPDATE facilities f
        SET 
          average_rating = subquery.avg_rating,
          total_reviews = subquery.review_count
        FROM (
          SELECT 
            facility_id, 
            ROUND(AVG(rating)::numeric, 1) as avg_rating,
            COUNT(*) as review_count
          FROM reviews
          GROUP BY facility_id
        ) as subquery
        WHERE f.id = subquery.facility_id
      `);
      console.log("✅ Updated facility ratings successfully");
    } catch (err) {
      console.error("❌ Error updating facility ratings:", err.message);
    }

    console.log("✅ Database migration completed");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
  }
}

// Execute the migration
runMigration()
  .then(() => {
    console.log("Migration script completed, you can now restart the server");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error during migration:", err);
    process.exit(1);
  });
