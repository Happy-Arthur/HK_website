// Fix 2: Updated server/services/checkin-service.ts to handle the missing expires_at column
import { db } from "../db";
import { checkIns, users, facilities } from "@shared/schema";
import { eq, and, gt, desc, sql } from "drizzle-orm";

// Define check-in duration in milliseconds (1 hour)
const CHECK_IN_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Service to handle facility check-ins with an in-memory approach
 * that works even if the database schema doesn't have the expiresAt column
 */
export class CheckInService {
  // In-memory storage to track check-in expiry
  private activeCheckIns = new Map<number, Map<number, Date>>();

  /**
   * Creates a new check-in
   * @param userId User ID attempting to check in
   * @param facilityId Facility ID to check in at
   * @returns The created check-in or null if validation failed
   */
  async createCheckIn(userId: number, facilityId: number) {
    // Validate inputs
    if (!userId || !facilityId) {
      console.error("Invalid user ID or facility ID for check-in");
      return null;
    }

    try {
      // Check if facility exists
      const facility = await db
        .select()
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1);

      if (!facility.length) {
        throw new Error(`Facility with ID ${facilityId} not found`);
      }

      // Get current timestamp
      const now = new Date();
      const expiryTime = new Date(now.getTime() + CHECK_IN_DURATION_MS);

      // Step 1: Find and remove all existing check-ins for this user from the database
      try {
        console.log(
          `Removing previous check-ins for user ${userId} from database`,
        );
        await db.delete(checkIns).where(eq(checkIns.userId, userId));
      } catch (error) {
        console.error("Error while removing existing check-ins:", error);
        // Continue anyway - don't let this stop the new check-in
      }

      // Step 2: Remove any active check-ins for this user from memory
      this.removeUserCheckIns(userId);

      try {
        // Try to create check-in with expiresAt
        const [newCheckIn] = await db
          .insert(checkIns)
          .values({
            userId,
            facilityId,
            createdAt: now,
            // If expiresAt exists in schema, this will succeed
            expiresAt: expiryTime,
          })
          .returning();

        // Store expiry in memory
        this.storeCheckInExpiry(userId, facilityId, expiryTime);

        console.log(
          `User ${userId} checked in at facility ${facilityId}, expires at ${expiryTime.toISOString()}`,
        );

        return {
          ...newCheckIn,
          expiresAt: expiryTime,
        };
      } catch (error) {
        // If error mentions expiresAt column doesn't exist, try without it
        if (error.message && error.message.includes("expires_at")) {
          console.log(
            "Database schema doesn't have expiresAt column, creating check-in without it",
          );

          // Create check-in without expiresAt field
          const [fallbackCheckIn] = await db
            .insert(checkIns)
            .values({
              userId,
              facilityId,
              createdAt: now,
            })
            .returning();

          // Still track expiry in memory
          this.storeCheckInExpiry(userId, facilityId, expiryTime);

          console.log(
            `Created check-in without expiresAt column for user ${userId} at facility ${facilityId}`,
          );

          // Return the check-in with the calculated expiry time
          return {
            ...fallbackCheckIn,
            expiresAt: expiryTime,
          };
        } else {
          // If it's some other error, rethrow it
          throw error;
        }
      }
    } catch (error) {
      console.error("Error during check-in:", error);
      return null;
    }
  }

  /**
   * Store a check-in expiry in memory
   */
  private storeCheckInExpiry(
    userId: number,
    facilityId: number,
    expiryTime: Date,
  ) {
    // Initialize facility map if needed
    if (!this.activeCheckIns.has(facilityId)) {
      this.activeCheckIns.set(facilityId, new Map());
    }

    // Store user's check-in expiry
    this.activeCheckIns.get(facilityId)!.set(userId, expiryTime);
  }

  /**
   * Remove all active check-ins for a user
   */
  private removeUserCheckIns(userId: number) {
    // Check all facilities
    for (const [facilityId, userMap] of this.activeCheckIns.entries()) {
      if (userMap.has(userId)) {
        userMap.delete(userId);
        console.log(
          `Removed previous check-in for user ${userId} at facility ${facilityId}`,
        );
      }
    }
  }

  /**
   * Get active check-ins for a facility with user information
   * @param facilityId The facility ID to get check-ins for
   * @returns Array of check-ins with user information
   */
  async getActiveCheckIns(facilityId: number) {
    try {
      const now = new Date();

      // First try using the in-memory approach
      const userExpiryMap = this.activeCheckIns.get(facilityId) || new Map();

      // Filter to active users
      const activeUserIds = [...userExpiryMap.entries()]
        .filter(([_, expiry]) => expiry > now)
        .map(([userId]) => userId);

      // If we have some active check-ins in memory
      if (activeUserIds.length > 0) {
        try {
          // Get user information for active check-ins
          const userInfo = await db
            .select({
              id: users.id,
              username: users.username,
              fullName: users.fullName,
            })
            .from(users)
            .where(sql`${users.id} IN (${activeUserIds.join(",")})`);

          // Format the result
          return userInfo.map((user) => {
            const expiryTime = userExpiryMap.get(user.id)!;
            return {
              userId: user.id,
              facilityId,
              username: user.username,
              fullName: user.fullName,
              displayName: user.fullName || user.username,
              expiresAt: expiryTime,
              // Calculate remaining time in minutes
              remainingMinutes: Math.max(
                0,
                Math.floor((expiryTime.getTime() - now.getTime()) / 60000),
              ),
            };
          });
        } catch (error) {
          console.error("Error fetching user info for check-ins:", error);
        }
      }

      // Fallback to DB query for recent check-ins
      console.log("No active check-ins in memory, querying database");

      // Get recent check-ins from the database (within the last hour)
      const recentCheckIns = await db
        .select({
          id: checkIns.id,
          userId: checkIns.userId,
          createdAt: checkIns.createdAt,
          username: users.username,
          fullName: users.fullName,
        })
        .from(checkIns)
        .innerJoin(users, eq(checkIns.userId, users.id))
        .where(
          and(
            eq(checkIns.facilityId, facilityId),
            gt(
              checkIns.createdAt,
              new Date(now.getTime() - CHECK_IN_DURATION_MS),
            ),
          ),
        )
        .orderBy(desc(checkIns.createdAt))
        .limit(10);

      // Format the results
      return recentCheckIns.map((checkIn) => {
        const expiryTime = new Date(
          checkIn.createdAt.getTime() + CHECK_IN_DURATION_MS,
        );
        const isActive = expiryTime > now;

        return {
          userId: checkIn.userId,
          facilityId,
          username: checkIn.username,
          fullName: checkIn.fullName,
          displayName: checkIn.fullName || checkIn.username,
          expiresAt: expiryTime,
          remainingMinutes: isActive
            ? Math.max(
                0,
                Math.floor((expiryTime.getTime() - now.getTime()) / 60000),
              )
            : 0,
        };
      });
    } catch (error) {
      console.error(
        `Error getting check-ins for facility ${facilityId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Initialize from existing check-ins (optional)
   */
  async loadExistingCheckIns() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - CHECK_IN_DURATION_MS);

      // Get recent check-ins (last 2 hours to capture any that might still be valid)
      const recentCheckIns = await db
        .select({
          userId: checkIns.userId,
          facilityId: checkIns.facilityId,
          createdAt: checkIns.createdAt,
        })
        .from(checkIns)
        .where(gt(checkIns.createdAt, oneHourAgo));

      // Process each check-in
      for (const checkIn of recentCheckIns) {
        // Calculate expiry (1 hour after creation)
        const expiryTime = new Date(
          checkIn.createdAt.getTime() + CHECK_IN_DURATION_MS,
        );

        // Only store if not expired
        if (expiryTime > now) {
          this.storeCheckInExpiry(
            checkIn.userId,
            checkIn.facilityId,
            expiryTime,
          );
        }
      }

      console.log(
        `Loaded ${recentCheckIns.length} recent check-ins from database`,
      );
    } catch (error) {
      console.error("Error loading existing check-ins:", error);
    }
  }
}

// Export a singleton instance
export const checkInService = new CheckInService();
