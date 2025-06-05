// server/migrations/execute-sql.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

async function executeSQL() {
  console.log("Starting database schema migration...");

  try {
    // Add average_rating column
    console.log("Attempting to add average_rating column...");
    try {
      await db.execute(
        sql`ALTER TABLE facilities ADD COLUMN average_rating DOUBLE PRECISION;`,
      );
      console.log("✅ Added average_rating column successfully");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("ℹ️ average_rating column already exists, skipping");
      } else {
        console.error("❌ Error adding average_rating column:", err.message);
        throw err;
      }
    }

    // Add total_reviews column
    console.log("Attempting to add total_reviews column...");
    try {
      await db.execute(
        sql`ALTER TABLE facilities ADD COLUMN total_reviews INTEGER DEFAULT 0;`,
      );
      console.log("✅ Added total_reviews column successfully");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("ℹ️ total_reviews column already exists, skipping");
      } else {
        console.error("❌ Error adding total_reviews column:", err.message);
        throw err;
      }
    }

    // Update the ratings
    console.log("Updating facility ratings...");
    try {
      const result = await db.execute(sql`
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
      throw err;
    }

    console.log("✅ Database migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

// Run the SQL execution
executeSQL()
  .then(() => console.log("Migration script completed"))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
