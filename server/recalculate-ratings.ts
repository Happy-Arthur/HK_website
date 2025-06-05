// Code to recalculate all ratings
import { db } from "./db";
import { facilities, reviews } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function recalculateAllRatings() {
  try {
    // Update all facilities with calculated ratings
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

    console.log("All facility ratings recalculated successfully");
  } catch (error) {
    console.error("Error recalculating ratings:", error);
  }
}

// Run the recalculation
recalculateAllRatings();
