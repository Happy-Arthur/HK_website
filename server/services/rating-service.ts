// Fix 1: Updated server/services/rating-service.ts to properly handle ratings
import { db } from "../db";
import { reviews, facilities } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Service to handle facility ratings calculations
 */
export class RatingService {
  /**
   * Calculate and return the average rating for a facility
   * @param facilityId The facility ID to calculate rating for
   * @returns Object containing the average rating and count
   */
  async getRating(
    facilityId: number,
  ): Promise<{ rating: number | null; count: number }> {
    try {
      // First check if there are any reviews for this facility
      const reviewCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.facilityId, facilityId));

      // If no reviews, return null for rating and 0 for count
      if (reviewCount[0].count === 0) {
        return { rating: null, count: 0 };
      }

      // Otherwise calculate the average rating - with proper rounding
      const [result] = await db
        .select({
          avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 1)`,
        })
        .from(reviews)
        .where(eq(reviews.facilityId, facilityId));

      return {
        rating: result?.avgRating ?? null,
        count: reviewCount[0].count,
      };
    } catch (error) {
      console.error(
        `Error calculating rating for facility ${facilityId}:`,
        error,
      );
      return { rating: null, count: 0 };
    }
  }

  /**
   * Update the cached rating in the facilities table
   */
  async updateCachedRating(facilityId: number): Promise<void> {
    try {
      // Get the current rating
      const { rating, count } = await this.getRating(facilityId);

      // Update the facilities table with the calculated values
      await db
        .update(facilities)
        .set({
          averageRating: rating,
          totalReviews: count,
        })
        .where(eq(facilities.id, facilityId));

      console.log(
        `Updated cached rating for facility ${facilityId}: ${rating} (${count} reviews)`,
      );
    } catch (error) {
      console.error(
        `Error updating cached rating for facility ${facilityId}:`,
        error,
      );
    }
  }

  /**
   * Recalculate and update the cached ratings for all facilities
   */
  async recalculateAllRatings(): Promise<void> {
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
}

// Export a singleton instance
export const ratingService = new RatingService();
