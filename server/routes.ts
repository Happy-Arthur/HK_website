import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import {
  insertReviewSchema,
  insertCheckInSchema,
  insertEventRsvpSchema,
  insertEventSchema,
  insertCourtAvailabilitySchema,
  facilityTypes,
  districts,
  checkIns, 
  users, 
  facilities,
  User,
  reviews,
  eventRsvps,
  courtAvailability,
} from "@shared/schema";
import * as schema from "@shared/schema";
import jwt from "jsonwebtoken";
import { ratingService } from "./services/rating-service";
import { checkInService } from "./services/checkin-service";
import { locationService } from "./services/location-service";
import { mapService } from "./services/map-service";
import { registerImportRoutes } from "./routes/import-routes";
import { registerAdminRoutes } from "./routes/admin-routes";
import { registerChallengeRoutes } from "./challenges";
import { registerExternalSearchRoutes } from "./routes/external-search-routes";
import { registerCommunityRoutes } from "./routes/community-routes";
import { registerWebSearchRoutes } from "./routes/web-search-routes";
import { registerGroupEventRoutes } from "./routes/group-events-routes";
import { registerGroupAdminRoutes } from "./routes/group-admin-routes";
import { registerAchievementsRoutes } from "./routes/achievements-routes";
import nearbyPlacesRoutes from "./routes/nearby-places";
import { sql } from "drizzle-orm";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { groups, groupMembers, postLikes, posts } from "@shared/schema";

// Helper function to check if two users are members of the same group
async function checkSameGroupMembership(currentUserId?: number, targetUserId?: number): Promise<boolean> {
  if (!currentUserId || !targetUserId) {
    return false;
  }
  
  try {
    // Get groups where currentUser is a member
    const currentUserGroups = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, currentUserId),
          eq(groupMembers.status, "approved") // Only consider approved memberships
        )
      );
    
    if (currentUserGroups.length === 0) {
      return false;
    }
    
    const groupIds = currentUserGroups.map(g => g.groupId);
    
    // Check if targetUser is also in any of these groups
    const sharedGroups = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, targetUserId),
          inArray(groupMembers.groupId, groupIds),
          eq(groupMembers.status, "approved") // Only consider approved memberships
        )
      );
    
    return sharedGroups.length > 0;
  } catch (error) {
    console.error("Error checking group membership:", error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug endpoint for auth testing
  app.get("/api/admin/debug", isAuthenticated, (req: Request, res: Response) => {
    // Check if the user is an admin
    const isAdmin = req.user && req.user.isAdmin === true;
    
    // Return detailed diagnostic info about the user
    res.status(200).json({
      authenticated: true,
      isAdmin,
      user: {
        id: req.user?.id || "unknown",
        username: req.user?.username || "unknown",
        email: req.user?.email || "unknown",
        fullName: req.user?.fullName || "unknown",
      },
      userDetails: req.user,
      message: isAdmin 
        ? "Admin access confirmed" 
        : "Authenticated but not an admin",
    });
  });
  // Add a simple test route
  app.get("/api/hello", (req, res) => {
    res.send("Hello from Hong Kong Sports Hub API!");
  });

  // Set up authentication routes
  setupAuth(app);
  
  // Add a new endpoint to check authentication status
  app.get("/api/auth-status", (req: Request, res: Response) => {
    try {
      const token = req.cookies.auth_token;
      
      if (!token) {
        return res.status(200).json({
          authenticated: false,
          message: "No auth token found"
        });
      }
      
      const AUTH_TOKEN_KEY = "hong_kong_sports_hub_jwt_secret_key";
      try {
        const decoded = jwt.verify(token, AUTH_TOKEN_KEY) as any;
        return res.status(200).json({
          authenticated: true,
          user: {
            id: decoded.id,
            username: decoded.username,
            fullName: decoded.fullName || "",
            email: decoded.email || "",
            isAdmin: decoded.isAdmin || false
          }
        });
      } catch (err) {
        return res.status(200).json({
          authenticated: false,
          message: "Invalid or expired token",
          error: typeof err === 'object' && err !== null ? err.toString() : 'Token verification failed'
        });
      }
    } catch (err) {
      console.error("Error in auth-status endpoint:", err);
      return res.status(500).json({ 
        error: "Server error checking authentication status",
        message: typeof err === 'object' && err !== null ? err.toString() : 'Unknown error'
      });
    }
  });
  
  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the token from cookies
      const token = req.cookies.auth_token;

      if (!token) {
        console.log("No auth token found in requests");
        return res
          .status(401)
          .json({ message: "Unauthorized - No auth token" });
      }

      // Verify the token - using the same key from auth.ts
      const AUTH_TOKEN_KEY = "hong_kong_sports_hub_jwt_secret_key";
      const decoded = jwt.verify(token, AUTH_TOKEN_KEY) as any;

      // Make sure there's a user object on the request
      if (!req.user) {
        // If no user object exists, create one based on the token
        req.user = {
          id: decoded.id,
          username: decoded.username,
          fullName: decoded.fullName || "",
          email: decoded.email || "",
          createdAt: decoded.createdAt || new Date(),
        };
        console.log(
          `User set in requireAuth: ${req.user.username} (ID: ${req.user.id})`,
        );
      }

      // Additional check to make sure user ID exists
      if (!req.user.id) {
        console.error("User ID missing in authenticated request");
        return res
          .status(401)
          .json({ message: "Unauthorized - Invalid user ID" });
      }

      next();
    } catch (error) {
      console.error("Authentication error in requireAuth middleware:", error);
      return res.status(401).json({ message: "Unauthorized - Token invalid" });
    }
  };
  
  // Register import routes
  registerImportRoutes(app, requireAuth);
  
  // Register admin routes
  registerAdminRoutes(app, requireAuth);
  
  // Register external search routes
  registerExternalSearchRoutes(app, requireAuth);
  
  // Register community routes for connections, posts, and groups
  registerCommunityRoutes(app, requireAuth);
  
  // Register group event routes with proper permission checks
  registerGroupEventRoutes(app, requireAuth);
  
  // Register group admin routes for group management operations
  registerGroupAdminRoutes(app, requireAuth);
  
  // Register web search routes with admin approval workflow
  registerWebSearchRoutes(app, requireAuth);
  
  // Register achievement routes for user gamification system
  registerAchievementsRoutes(app);
  
  // Register challenge routes for community challenges
  registerChallengeRoutes(app, requireAuth);
  
  // Register nearby places routes for Google Places integration
  app.use("/api/nearby-places", nearbyPlacesRoutes);
  
  // User profile update route
  app.post("/api/user/profile", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const userId = req.user.id;
      
      // Profile update schema validation
      const profileSchema = z.object({
        fullName: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phoneNumber: z.string().optional(),
        preferredSports: z.array(z.string()).min(1),
        skillLevel: z.record(z.string(), z.string()).optional(),
        preferredLocations: z.array(z.string()).min(1),
        bio: z.string().optional(),
      });
      
      // Validate the request data
      const profileData = profileSchema.parse(req.body);
      
      // Update user in the database
      const [updatedUser] = await db
        .update(users)
        .set({
          ...profileData,
          // Only update fields that are provided in the request
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return the updated user without the password
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user profile:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors
        });
      }
      
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  
  // Password change route
  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const userId = req.user.id;
      
      // Password change schema validation
      const passwordChangeSchema = z.object({
        currentPassword: z.string().min(6),
        newPassword: z.string().min(6),
      });
      
      // Validate the request data
      const passwordData = passwordChangeSchema.parse(req.body);
      
      // Get the user with the current password
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Compare the current password with stored password
      // Import the password comparison function from auth.ts
      const { comparePasswords, hashPassword } = await import('./auth');
      
      const isPasswordValid = await comparePasswords(
        passwordData.currentPassword,
        user.password
      );
      
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(passwordData.newPassword);
      
      // Update the user's password
      const [updatedUser] = await db
        .update(users)
        .set({
          password: hashedPassword,
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      // Return success response
      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors
        });
      }
      
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  
  // User account deletion route
  app.delete("/api/user", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const userId = req.user.id;
      
      // Prevent Arthur (ID: 3) from deleting his own account
      if (userId === 3) {
        console.log(`Preventing Arthur (ID: 3) from deleting his own account`);
        return res.status(403).json({ message: "Super admin account cannot be deleted" });
      }
      
      // First, delete all associated data (reviews, check-ins, event RSVPs, etc.)
      // This assumes cascading deletes are not set up in the database
      
      // Delete user's reviews
      await db
        .delete(reviews)
        .where(eq(reviews.userId, userId));
      
      // Delete user's check-ins
      await db
        .delete(checkIns)
        .where(eq(checkIns.userId, userId));
      
      // Delete user's event RSVPs
      await db
        .delete(eventRsvps)
        .where(eq(eventRsvps.userId, userId));
      
      // Finally, delete the user
      const deletedCount = await db
        .delete(users)
        .where(eq(users.id, userId));
      
      if (deletedCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return success response
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });



  app.get("/api/facilities", async (req, res, next) => {
    try {
      const type = req.query.type as string | undefined;
      const district = req.query.district as string | undefined;
      // Accept both 'query' and 'q' for backward compatibility
      const query = (req.query.query || req.query.q) as string | undefined;
      // Get location parameters for nearby search
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const radius = req.query.radius ? parseInt(req.query.radius as string) : 5000; // default 5km radius

      console.log("API received facility filters:", { type, district, query, lat, lng, radius });

      // Ensure type is a valid value from our types list
      if (type && !facilityTypes.includes(type as any)) {
        console.log(`Invalid type filter: ${type}`);
      }

      // Get facilities first
      const facilities = await storage.getFacilities({ type, district, query });
      
      console.log(
        `Found ${facilities.length} facilities matching filters: type=${type || "all"}, district=${district || "all"}`,
      );

      // Validate each facility in the list
      let validatedFacilities = facilities.map((facility) => ({
        ...facility,
        // Ensure critical fields have values
        name: facility.name || `Facility ${facility.id}`,
        type: facility.type || "unknown",
        district: facility.district || "unknown",
        // Ensure coordinates exist
        latitude: facility.latitude || 22.283,
        longitude: facility.longitude || 114.159,
      }));

      // Apply location-based filtering if coordinates are provided
      if (lat !== undefined && lng !== undefined) {
        console.log(`Filtering facilities by location: ${lat},${lng} within ${radius}m`);
        validatedFacilities = mapService.findNearbyFacilities(
          lat, 
          lng, 
          radius, 
          validatedFacilities
        );
        
        console.log(`Found ${validatedFacilities.length} facilities near the specified location`);
      }

      res.json(validatedFacilities);
    } catch (error) {
      console.error("Error fetching facilities:", error);
      next(error);
    }
  });
  
  // Geocoding API endpoint
  app.get("/api/geocode", async (req, res, next) => {
    try {
      const address = req.query.address as string;
      
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }
      
      const coordinates = await mapService.getCoordinatesFromAddress(address);
      
      res.json(coordinates);
    } catch (error) {
      console.error("Error geocoding address:", error);
      next(error);
    }
  });
  
  // Reverse geocoding API endpoint
  app.get("/api/reverse-geocode", async (req, res, next) => {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      
      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "Both latitude and longitude are required" });
      }
      
      const addressInfo = await mapService.getAddressFromCoordinates(lat, lng);
      
      if (!addressInfo) {
        return res.status(404).json({ message: "Could not find address for these coordinates" });
      }
      
      res.json(addressInfo);
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      next(error);
    }
  });
  
  // Travel time estimation API endpoint
  app.get("/api/travel-time", async (req, res, next) => {
    try {
      const startLat = req.query.startLat ? parseFloat(req.query.startLat as string) : undefined;
      const startLng = req.query.startLng ? parseFloat(req.query.startLng as string) : undefined;
      const endLat = req.query.endLat ? parseFloat(req.query.endLat as string) : undefined;
      const endLng = req.query.endLng ? parseFloat(req.query.endLng as string) : undefined;
      const mode = (req.query.mode as 'driving' | 'walking' | 'bicycling' | 'transit') || 'walking';
      
      if (startLat === undefined || startLng === undefined || endLat === undefined || endLng === undefined) {
        return res.status(400).json({ 
          message: "Start and end coordinates are required (startLat, startLng, endLat, endLng)" 
        });
      }
      
      const travelTime = await mapService.getTravelTime(startLat, startLng, endLat, endLng, mode);
      
      res.json({ 
        travelTimeSeconds: travelTime,
        travelTimeMinutes: travelTime ? Math.round(travelTime / 60) : null,
        mode: mode
      });
    } catch (error) {
      console.error("Error calculating travel time:", error);
      next(error);
    }
  });

  app.get("/api/auth-test", (req, res) => {
    // Check for auth token
    const token = req.cookies.auth_token;

    // Format the response
    const response = {
      hasToken: !!token,
      tokenValue: token ? `${token.substring(0, 10)}...` : "none",
      hasUser: !!req.user,
      user: req.user
        ? {
            id: req.user.id,
            username: req.user.username,
            // Add other non-sensitive fields
          }
        : null,
      cookies: req.cookies ? Object.keys(req.cookies) : [],
      time: new Date().toISOString(),
    };

    // Log diagnostic info server-side
    console.log("Auth diagnostic request:", response);

    res.json(response);
  });

  app.get("/api/auth-status", (req, res) => {
    // Enhanced auth-status endpoint with debugging information
    const authHeader = req.headers.authorization;
    const hasCookies = Object.keys(req.cookies || {}).length > 0;
    const authCookie = req.cookies?.auth_token;
    
    console.log("Auth Status Check:");
    console.log("  Headers:", {
      'authorization': authHeader ? 'Present' : 'None',
      'cookie': hasCookies ? 'Present' : 'None'
    });
    console.log("  Cookies:", req.cookies);
    
    res.json({
      authenticated: !!req.user,
      user: req.user
        ? {
            id: req.user.id,
            username: req.user.username,
            isAdmin: req.user.isAdmin || false
          }
        : null,
      debug: {
        hasAuthHeader: !!authHeader,
        hasCookies,
        hasAuthCookie: !!authCookie,
        cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
        origin: req.headers.origin || 'none',
        host: req.headers.host || 'none',
        referer: req.headers.referer || 'none',
        path: req.originalUrl
      }
    });
  });

  // Ensure facility data is complete before sending to client
  app.get("/api/facilities/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Fetching facility with ID: ${id}`);
      
      // Special case for Google Places facility ID (-1)
      if (id === -1) {
        console.log("Handling special Google Places facility ID -1");
        // Return a dummy facility for Google Places
        return res.json({
          id: -1,
          name: "Google Places Location",
          type: "other",
          district: "central",
          latitude: 22.283,
          longitude: 114.159,
          description: "This is a Google Places location that hasn't been added to our database yet.",
          address: "Hong Kong",
          imageUrl: "https://images.unsplash.com/photo-1531001142987-e06d2648f8e7?auto=format&fit=crop&w=800&q=80",
          amenities: [],
          openTime: null,
          closeTime: null,
          courts: null,
          contactPhone: null,
          approvalStatus: "pending",
          searchSource: "google_places"
        });
      }
      
      const facility = await storage.getFacility(id);

      if (!facility) {
        return res.status(404).json({ message: "Facility not found" });
      }

      console.log(`Found facility: ${JSON.stringify(facility)}`);

      // Check for missing critical fields and set defaults if needed
      const validatedFacility = {
        ...facility,
        // Ensure these fields have values
        name: facility.name || `Facility ${id}`,
        type: facility.type || "unknown",
        district: facility.district || "unknown",
        // Ensure coordinates exist (if they don't, use Hong Kong central coordinates)
        latitude: facility.latitude || 22.283,
        longitude: facility.longitude || 114.159,
        // Add reasonable defaults for other fields
        description: facility.description || `Sports facility in Hong Kong.`,
        address: facility.address || "Hong Kong",
        imageUrl:
          facility.imageUrl ||
          "https://images.unsplash.com/photo-1531001142987-e06d2648f8e7?auto=format&fit=crop&w=800&q=80",
        // Ensure amenities is always an array
        amenities: Array.isArray(facility.amenities) ? facility.amenities : [],
      };

      res.json(validatedFacility);
    } catch (error) {
      next(error);
    }
  });

  // Reviews routes
  app.get("/api/facilities/:id/reviews", async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      // Special case for Google Places facility (-1)
      if (facilityId === -1) {
        return res.json([]);
      }

      const reviews = await storage.getReviewsByFacilityId(facilityId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      next(error);
    }
  });

  app.post(
    "/api/facilities/:id/reviews",
    requireAuth,
    async (req, res, next) => {
      try {
        const facilityId = parseInt(req.params.id);
        const userId = req.user!.id;

        if (isNaN(facilityId) || facilityId <= 0) {
          return res.status(400).json({ message: "Invalid facility ID" });
        }

        // Check if facility exists
        const facility = await storage.getFacility(facilityId);
        if (!facility) {
          return res.status(404).json({ message: "Facility not found" });
        }

        // Check if the user already has a review for this facility
        const existingReviews =
          await storage.getReviewsByFacilityId(facilityId);
        const userReview = existingReviews.find(
          (review) => review.userId === userId,
        );

        if (userReview) {
          // Delete the existing review
          await storage.deleteReview(userReview.id);
          console.log(
            `Deleted previous review (ID: ${userReview.id}) by user ${userId} for facility ${facilityId}`,
          );
        }

        // Validate the review data
        const validatedData = insertReviewSchema.parse({
          ...req.body,
          userId,
          facilityId,
        });

        // Create the review using storage interface
        const review = await storage.createReview(validatedData);

        await ratingService.updateCachedRating(facilityId);

        console.log(
          `User ${userId} submitted review for facility ${facilityId}`,
        );
        res.status(201).json(review);
      } catch (error) {
        console.error("Error handling review submission:", error);
        next(error);
      }
    },
  );

  // In your routes.ts file, update the rating endpoint:
  app.get("/api/facilities/:id/rating", async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId) || facilityId <= 0) {
        // Special case: ID -1 is used for Google Places results that are not yet in our database
        if (facilityId === -1) {
          return res.status(200).json({ averageRating: null, totalReviews: 0 });
        }
        return res.status(400).json({ message: "Invalid facility ID" });
      }

      // Get rating from the updated service
      const ratingData = await ratingService.getRating(facilityId);
      res.json({
        rating: ratingData.rating,
        count: ratingData.count,
      });
    } catch (error) {
      console.error("Error fetching facility rating:", error);
      next(error);
    }
  });
  
  // Facility Events Endpoint - Get events for a specific facility
  app.get("/api/facilities/:id/events", async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      // Special case for Google Places facility (-1)
      if (facilityId === -1) {
        return res.json([]);
      }
      
      console.log(`Fetching events for facility ID: ${facilityId}`);
      
      // Get events with this facility ID
      const events = await storage.getEvents({ facilityId });
      
      // Log the result
      console.log(`Found ${events.length} events for facility ${facilityId}`);
      if (events.length > 0) {
        console.log(`First event sample: ${events[0].name}`);
      }
      
      res.json(events);
    } catch (error) {
      console.error(`Error fetching events for facility: ${error}`);
      next(error);
    }
  });

  app.get("/api/facilities/:id/checkins/debug", async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);

      if (isNaN(facilityId) || facilityId <= 0) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }

      // Replace the existing check-ins retrieval code with:
      const checkIns = await checkInService.getActiveCheckIns(facilityId);

      // Get 5 most recent check-ins with usernames
      const recentWithUsernames =
        await storage.getCheckInsWithUsernames(facilityId);

      // Return diagnostic info
      res.json({
        facilityId,
        checkInsCount: checkIns.length,
        rawCheckIns: checkIns,
        recentWithUsernames: recentWithUsernames,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error in check-in debug route:", error);
      next(error);
    }
  });

  // Check-ins routes with GPS-based crowd estimation
  app.get("/api/facilities/:id/checkins", async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);

      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      // Special case for Google Places facility (-1)
      if (facilityId === -1) {
        // Return empty checkins data for Google Places
        return res.json({ 
          peopleCount: 0,
          crowdLevel: "empty",
          isUserCheckedIn: false,
          isUserNearby: false,
          usingGpsData: false
        });
      }

      try {
        // Get traditional check-in count of people
        const traditionalPeopleCount = await storage.getEstimatedPeopleCount(facilityId);
        
        // Get GPS-based count from location service
        const gpsBasedPeopleCount = locationService.getUsersAtFacilityCount(facilityId);
        
        // Use the GPS-based count if available, otherwise fall back to check-ins
        const peopleCount = gpsBasedPeopleCount > 0 ? gpsBasedPeopleCount : traditionalPeopleCount;
        
        // Calculate crowd level
        let crowdLevel = "empty";
        if (peopleCount === 0) {
          crowdLevel = "empty";
        } else if (peopleCount <= 3) {
          crowdLevel = "quiet";
        } else if (peopleCount <= 8) {
          crowdLevel = "moderate";
        } else if (peopleCount <= 15) {
          crowdLevel = "busy";
        } else {
          crowdLevel = "crowded";
        }
        
        // Get if current user is checked in (if authenticated)
        let isUserCheckedIn = false;
        let isUserNearby = false;
        
        if (req.user?.id) {
          try {
            // Check traditional check-ins
            const activeCheckIns = await checkInService.getActiveCheckIns(facilityId);
            isUserCheckedIn = activeCheckIns.some(checkIn => checkIn.userId === req.user?.id);
            
            // Check GPS-based proximity
            isUserNearby = locationService.isUserAtFacility(req.user.id, facilityId);
          } catch (checkInError) {
            console.error("Error checking if user is checked in:", checkInError);
          }
        }
        
        return res.json({ 
          peopleCount,
          crowdLevel,
          isUserCheckedIn,
          isUserNearby,
          usingGpsData: gpsBasedPeopleCount > 0
        });
      } catch (error) {
        console.error("Error getting facility people count:", error);
        return res.status(500).json({ message: "Error retrieving facility data" });
      }
    } catch (error) {
      console.error("Error fetching facility check-ins:", error);
      next(error);
    }
  });

  // Checkout endpoint to remove user's check-in
  app.post(
    "/api/facilities/:id/checkout",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const facilityId = parseInt(req.params.id);
        const userId = req.user!.id;

        if (isNaN(facilityId) || facilityId <= 0) {
          return res.status(400).json({ message: "Invalid facility ID" });
        }

        // First, check if facility exists
        const facility = await storage.getFacility(facilityId);
        if (!facility) {
          return res.status(404).json({ message: "Facility not found" });
        }

        console.log(`User ${userId} checking out from facility ${facilityId}`);

        try {
          // Delete any check-ins for this user at this facility
          await db.delete(checkIns)
            .where(
              and(
                eq(checkIns.userId, userId),
                eq(checkIns.facilityId, facilityId)
              )
            );

          // Also update the user's location data to remove facility association
          if (locationService) {
            // Update the user's location to remove facility association
            try {
              locationService.updateUserLocation(userId, null, null, null);
              console.log(`Cleared facility association for user ${userId}`);
            } catch (locError) {
              console.error("Error updating location service data:", locError);
              // Non-critical error, continue with checkout
            }
          }

          return res.status(200).json({ 
            success: true,
            message: "Successfully checked out"
          });
        } catch (error) {
          console.error("Error during checkout:", error);
          return res.status(500).json({ 
            message: "Error checking out from facility",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (error) {
        console.error("Error in facility checkout endpoint:", error);
        next(error);
      }
    }
  );

  // Fixed check-in route to handle missing expiresAt field
  app.post(
    "/api/facilities/:id/checkin",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const facilityId = parseInt(req.params.id);
        const userId = req.user!.id;

        console.log(
          `Check-in attempt: User ${userId} at facility ${facilityId}`,
        );

        if (isNaN(facilityId) || facilityId <= 0) {
          console.log(`Invalid facility ID: ${facilityId}`);
          return res.status(400).json({ message: "Invalid facility ID" });
        }

        // Check if facility exists
        const facility = await storage.getFacility(facilityId);
        if (!facility) {
          console.log(`Facility not found: ${facilityId}`);
          return res.status(404).json({ message: "Facility not found" });
        }

        console.log(
          `Creating check-in: User ${userId} at facility ${facilityId}`,
        );

        // Create the check-in with robust error handling
        try {
          // First try the service
          const checkIn = await checkInService.createCheckIn(
            userId,
            facilityId,
          );

          if (checkIn) {
            console.log(`Check-in created successfully by service`);
            return res.status(201).json(checkIn);
          }

          // If service fails, fall back to direct DB insertion
          console.log("Falling back to direct DB insertion");

          const now = new Date();
          let checkInData = {
            userId,
            facilityId,
            createdAt: now,
          };

          // Try to create check-in, considering the potential absence of expiresAt column
          try {
            const [createdCheckIn] = await db
              .insert(checkIns)
              .values(checkInData)
              .returning();

            console.log(
              "Check-in created successfully with direct DB insertion",
            );

            // Return with a calculated expiry for client use
            return res.status(201).json({
              ...createdCheckIn,
              expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour expiry
            });
          } catch (insertError) {
            console.error("DB insertion error:", insertError);

            // If the error is about missing columns, try with basic required fields only
            const [simpleCheckIn] = await db
              .insert(checkIns)
              .values({
                userId,
                facilityId,
              })
              .returning();

            console.log("Created simplified check-in record");
            return res.status(201).json({
              ...simpleCheckIn,
              expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour expiry
            });
          }
        } catch (error) {
          console.error("Error during check-in creation:", error);

          // Try one last desperate approach - raw SQL
          try {
            console.log("Attempting raw SQL check-in creation");
            await db.execute(sql`
              INSERT INTO check_ins (user_id, facility_id, created_at) 
              VALUES (${userId}, ${facilityId}, NOW())
            `);

            console.log("Check-in created with raw SQL");

            return res.status(201).json({
              userId,
              facilityId,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            });
          } catch (sqlError) {
            console.error("Raw SQL check-in failed:", sqlError);
            throw sqlError; // Let the main error handler deal with it
          }
        }
      } catch (error) {
        console.error("Error during check-in:", error);
        // Send a specific error message and 500 status
        res.status(500).json({
          message: "Server error during check-in process. Please try again.",
          error: error.message,
        });
      }
    },
  );

  // Court availability routes
  app.get("/api/facilities/:id/availability", async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);
      if (isNaN(facilityId)) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      // Special case for Google Places facility (-1)
      if (facilityId === -1) {
        return res.json([]);
      }

      const dateParam = req.query.date as string;
      const date = dateParam ? new Date(dateParam) : new Date();

      const availability = await storage.getCourtAvailability(facilityId, date);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      next(error);
    }
  });

  // Events routes
  app.get("/api/events", async (req, res, next) => {
    try {
      const type = req.query.type as string | undefined;
      // Accept both 'query' and 'q' for text search
      const query = (req.query.query || req.query.q) as string | undefined;
      const fromDate = req.query.from
        ? new Date(req.query.from as string)
        : undefined;
      const toDate = req.query.to
        ? new Date(req.query.to as string)
        : undefined;
      const facilityId = req.query.facilityId
        ? parseInt(req.query.facilityId as string)
        : undefined;
      const district = req.query.district as string | undefined;
      const groupId = req.query.groupId
        ? parseInt(req.query.groupId as string)
        : undefined;
      
      // Include user ID if authenticated to filter for events from user's groups
      const userId = req.user?.id;

      console.log("Events API received filters:", {
        type,
        query,
        fromDate,
        toDate,
        facilityId,
        district,
        groupId,
        userId,
      });

      // Ensure the filter values are properly defined
      const filters = {
        type: type || undefined,
        query: query || undefined,
        from: fromDate,
        to: toDate,
        facilityId,
        district,
        groupId,
        userId,
      };

      const events = await storage.getEvents(filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      next(error);
    }
  });

  app.get("/api/events/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user?.id; // May be undefined if not logged in
      
      // Get the event with additional details
      const event = await storage.getEvent(id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // If this is a group event, check permissions
      if (event.groupId) {
        // If user not logged in, check if group is public
        if (!userId) {
          // Check if the group is private
          const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, event.groupId));
            
          if (group && group.isPrivate) {
            return res.status(403).json({ 
              message: "This is a private group event. Please log in and join the group to view this event." 
            });
          }
        } else {
          // User is logged in, check if they're a member of the group
          const [membership] = await db
            .select()
            .from(groupMembers)
            .where(and(
              eq(groupMembers.groupId, event.groupId),
              eq(groupMembers.userId, userId),
              eq(groupMembers.status, "approved")
            ));
            
          if (!membership) {
            return res.status(403).json({ 
              message: "You must be a member of this group to view this event." 
            });
          }
        }
      }
      
      // User has permission to see the event
      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/events", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      const validatedData = insertEventSchema.parse({
        ...req.body,
        organizerId: userId,
      });

      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      next(error);
    }
  });

  // Event RSVPs routes
  app.get("/api/events/:id/rsvps", async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const rsvps = await storage.getRsvpsByEventId(eventId);
      res.json(rsvps);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/events/:id/rsvp", requireAuth, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid event ID" 
        });
      }
      
      const userId = req.user!.id;
      const { status } = req.body;
      
      if (!status || !['going', 'interested', 'declined'].includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid RSVP status. Must be 'going', 'interested', or 'declined'." 
        });
      }

      console.log(`Creating RSVP for event ${eventId}, user ${userId}, status: ${status}`);

      try {
        // First check if this RSVP already exists
        const existingRsvp = await storage.getRsvpByUserAndEvent(userId, eventId);

        if (existingRsvp) {
          // Update existing RSVP instead of creating a new one
          console.log("RSVP already exists, updating instead of creating");
          const updatedRsvp = await storage.updateRsvp(userId, eventId, status);
          return res.json({
            success: true,
            ...updatedRsvp
          });
        }

        // Create new RSVP
        const validatedData = insertEventRsvpSchema.parse({
          eventId,
          userId,
          status,
        });

        const rsvp = await storage.createRsvp(validatedData);
        return res.status(201).json({
          success: true,
          ...rsvp
        });
      } catch (validationError) {
        console.error("RSVP validation error:", validationError);
        return res.status(400).json({
          success: false,
          message: "Invalid RSVP data",
          error: validationError instanceof Error ? validationError.message : "Validation failed"
        });
      }
    } catch (error) {
      console.error("Error creating RSVP:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while processing RSVP",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/events/:id/rsvp", requireAuth, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid event ID" 
        });
      }
      
      const userId = req.user!.id;
      const { status } = req.body;
      
      if (!status || !['going', 'interested', 'declined'].includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid RSVP status. Must be 'going', 'interested', or 'declined'." 
        });
      }

      console.log(`Updating RSVP for event ${eventId}, user ${userId}, status: ${status}`);
      
      try {
        // Check if RSVP exists
        const existingRsvp = await storage.getRsvpByUserAndEvent(userId, eventId);
        
        if (!existingRsvp) {
          console.log("RSVP not found, creating new one instead of updating");
          // Create it instead
          const validatedData = insertEventRsvpSchema.parse({
            eventId,
            userId,
            status,
          });
          
          const newRsvp = await storage.createRsvp(validatedData);
          return res.status(201).json({
            success: true,
            ...newRsvp
          });
        }
        
        // Update existing RSVP
        const rsvp = await storage.updateRsvp(userId, eventId, status);
        
        console.log("RSVP updated successfully:", rsvp);
        return res.json({
          success: true,
          ...rsvp
        });
      } catch (validationError) {
        console.error("RSVP validation error:", validationError);
        return res.status(400).json({
          success: false,
          message: "Invalid RSVP data",
          error: validationError instanceof Error ? validationError.message : "Validation failed"
        });
      }
    } catch (error) {
      console.error("Error updating RSVP:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while updating RSVP",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // User profile routes
  app.get("/api/user/checkins", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const checkIns = await storage.getCheckInsByUserId(userId);
      res.json(checkIns);
    } catch (error) {
      next(error);
    }
  });
  
  // GPS-based crowd estimation endpoint
  app.get(
    "/api/facilities/:id/crowd",
    async (req, res, next) => {
      try {
        const facilityId = parseInt(req.params.id);
        if (isNaN(facilityId) || facilityId <= 0) {
          return res.status(400).json({ message: "Invalid facility ID" });
        }
        
        // Get the GPS-based crowd count from location service
        const peopleCount = locationService.getUsersAtFacilityCount(facilityId);
        
        // Calculate crowd level
        let crowdLevel = "empty";
        if (peopleCount === 0) {
          crowdLevel = "empty";
        } else if (peopleCount <= 3) {
          crowdLevel = "quiet";
        } else if (peopleCount <= 8) {
          crowdLevel = "moderate";
        } else if (peopleCount <= 15) {
          crowdLevel = "busy";
        } else {
          crowdLevel = "crowded";
        }
        
        return res.json({
          facilityId,
          peopleCount,
          crowdLevel,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.error("Error fetching facility crowd estimation:", error);
        next(error);
      }
    }
  );
  
  // GPS location update endpoint for crowd estimation
  app.post("/api/location/update", requireAuth, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const userId = req.user.id;
      
      // Validate the request data
      const locationSchema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180)
      });
      
      try {
        const { latitude, longitude } = locationSchema.parse(req.body);
        
        console.log(`Location update from user ${userId}: lat=${latitude}, lng=${longitude}`);
        
        // Update user's location in the location service
        const result = await locationService.updateUserLocation(userId, latitude, longitude);
        
        return res.status(200).json({
          success: true,
          facilityId: result.facilityId,
          message: result.facilityId 
            ? `You are near facility ID: ${result.facilityId}` 
            : "You are not near any known facility"
        });
      } catch (validationError) {
        console.error("Invalid location data:", validationError);
        return res.status(400).json({ 
          message: "Invalid location data",
          errors: validationError instanceof z.ZodError ? validationError.errors : undefined
        });
      }
    } catch (error) {
      console.error("Error updating user location:", error);
      next(error);
    }
  });

  // Court availability update route
  app.put("/api/facilities/:id/availability/:availabilityId", requireAuth, async (req, res, next) => {
    try {
      const availabilityId = parseInt(req.params.availabilityId);
      const { isAvailable } = req.body;
      
      if (isNaN(availabilityId) || availabilityId <= 0) {
        return res.status(400).json({ message: "Invalid availability ID" });
      }
      
      if (typeof isAvailable !== 'boolean') {
        return res.status(400).json({ message: "isAvailable must be a boolean" });
      }
      
      const updatedAvailability = await storage.updateCourtAvailability(
        availabilityId,
        isAvailable
      );
      
      // Emit WebSocket message to clients
      const facilityId = updatedAvailability.facilityId;
      
      // Create a message with the updated court information
      const message = JSON.stringify({
        type: 'court_availability_update',
        data: updatedAvailability
      });
      
      // Broadcast to connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      
      res.json(updatedAvailability);
    } catch (error) {
      console.error("Error updating court availability:", error);
      next(error);
    }
  });

  // Create court availability entries
  app.post("/api/facilities/:id/availability", requireAuth, async (req, res, next) => {
    try {
      const facilityId = parseInt(req.params.id);
      
      if (isNaN(facilityId) || facilityId <= 0) {
        return res.status(400).json({ message: "Invalid facility ID" });
      }
      
      // Validate the availability data
      const validatedData = insertCourtAvailabilitySchema.parse({
        ...req.body,
        facilityId,
      });
      
      // Insert the court availability record
      const [availability] = await db
        .insert(courtAvailability)
        .values(validatedData)
        .returning();
      
      // Emit WebSocket message to clients
      const message = JSON.stringify({
        type: 'court_availability_created',
        data: availability
      });
      
      // Broadcast to connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      
      res.status(201).json(availability);
    } catch (error) {
      console.error("Error creating court availability:", error);
      next(error);
    }
  });

  // Basic users API route for community features
  app.get("/api/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.query as string | undefined;
      const userId = req.query.userId as string | undefined;
      const currentUserId = req.user?.id;
      
      // Build query conditions
      let usersList;
      
      if (userId) {
        // Find specific user by ID
        const id = parseInt(userId);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid user ID format" });
        }
        
        usersList = await db.select().from(users)
          .where(eq(users.id, id))
          .limit(1);
          
        if (usersList.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Check if users are in the same group (privacy feature)
        const targetUserId = id;
        const canViewFullProfile = await checkSameGroupMembership(currentUserId, targetUserId);
        
        // If not the same user and not in same group, restrict profile information
        if (currentUserId !== targetUserId && !canViewFullProfile) {
          // We need to hide contact information and restrict profile access
          usersList = usersList.map(user => ({
            ...user,
            email: null, // Hide email
            phoneNumber: null, // Hide phone number
            restricted: true // Add flag to indicate restricted view
          }));
        }
      } else if (query) {
        // Find users matching search query
        usersList = await db.select().from(users)
          .where(
            sql`(${users.username} ILIKE ${`%${query}%`} OR ${users.fullName} ILIKE ${`%${query}%`})`
          )
          .orderBy(desc(users.createdAt));
      } else {
        // Get all users
        usersList = await db.select().from(users)
          .orderBy(desc(users.createdAt));
      }
      
      console.log(`Found ${usersList.length} users matching ${userId ? 'ID: ' + userId : query ? 'query: ' + query : 'all'}`);
      return res.json(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      next(error);
    }
  });
  
  // Basic connections API route for community features
  app.get("/api/connections", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      
      // In a real application, you would fetch connections from database
      const connections: any[] = [];
      
      return res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      next(error);
    }
  });
  
  // Get all groups or search for groups
  app.get("/api/groups", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, type } = req.query;
      
      // Use the storage interface to get groups
      const groups = await storage.getGroups({
        query: query as string,
        type: type as string
      });
      
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      next(error);
    }
  });
  
  // Get user's groups
  app.get("/api/groups/my-groups", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      
      // Get groups where the user is a member
      const userGroupMemberships = await db
        .select({
          groupId: groupMembers.groupId,
        })
        .from(groupMembers)
        .where(eq(groupMembers.userId, userId));
      
      if (userGroupMemberships.length === 0) {
        return res.json([]);
      }
      
      // Get the group details
      const groupIds = userGroupMemberships.map(membership => membership.groupId);
      
      const userGroups = await db
        .select({
          id: groups.id,
          name: groups.name,
          sportType: groups.sportType,
          imageUrl: groups.imageUrl,
          memberCount: groups.memberCount,
        })
        .from(groups)
        .where(inArray(groups.id, groupIds));
      
      return res.json(userGroups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      // Send an empty array instead of an error for a more graceful failure
      return res.json([]);
    }
  });
  
  // Like a post
  app.post("/api/posts/:postId/like", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = parseInt(req.params.postId);
      const userId = req.user!.id;
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      // Check if the post exists first
      const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      
      if (!post.length) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      // Check if the user already liked this post
      const existingLike = await db.select()
        .from(postLikes)
        .where(and(
          eq(postLikes.postId, postId),
          eq(postLikes.userId, userId)
        ))
        .limit(1);
      
      if (existingLike.length > 0) {
        return res.status(400).json({ message: "You already liked this post" });
      }
      
      // Create the like
      await db.insert(postLikes).values({
        postId,
        userId
      });
      
      // Increment the likes count on the post
      await db.update(posts)
        .set({ likes: sql`${posts.likes} + 1` })
        .where(eq(posts.id, postId));
      
      return res.status(200).json({ message: "Post liked successfully" });
    } catch (error) {
      console.error("Error liking post:", error);
      next(error);
    }
  });
  
  // Unlike a post
  app.delete("/api/posts/:postId/like", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = parseInt(req.params.postId);
      const userId = req.user!.id;
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      // Check if the like exists
      const existingLike = await db.select()
        .from(postLikes)
        .where(and(
          eq(postLikes.postId, postId),
          eq(postLikes.userId, userId)
        ))
        .limit(1);
      
      if (!existingLike.length) {
        return res.status(404).json({ message: "Like not found" });
      }
      
      // Delete the like
      await db.delete(postLikes)
        .where(and(
          eq(postLikes.postId, postId),
          eq(postLikes.userId, userId)
        ));
      
      // Decrement the likes count on the post
      await db.update(posts)
        .set({ likes: sql`${posts.likes} - 1` })
        .where(eq(posts.id, postId));
      
      return res.status(200).json({ message: "Post unliked successfully" });
    } catch (error) {
      console.error("Error unliking post:", error);
      next(error);
    }
  });
  
  // Check if user liked a post
  app.get("/api/posts/:postId/like", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = parseInt(req.params.postId);
      const userId = req.user!.id;
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }
      
      // Check if the like exists
      const existingLike = await db.select()
        .from(postLikes)
        .where(and(
          eq(postLikes.postId, postId),
          eq(postLikes.userId, userId)
        ))
        .limit(1);
      
      return res.status(200).json({ liked: existingLike.length > 0 });
    } catch (error) {
      console.error("Error checking post like:", error);
      next(error);
    }
  });
  
  // Create connection API route for community features
  app.post("/api/connections", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { connectedUserId } = req.body;
      
      if (!connectedUserId) {
        return res.status(400).json({ message: "Connected user ID is required" });
      }
      
      // In a real application, you would create a connection in database
      // For demo purposes, return mock response
      return res.status(201).json({
        id: Date.now(),
        userId,
        connectedUserId,
        status: "pending",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating connection:", error);
      next(error);
    }
  });
  
  // Message API endpoints
  app.get("/api/messages/:userId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      const currentUserId = req.user!.id;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Get messages between these two users
      const messages = await storage.getMessages(currentUserId, userId);
      
      // Mark messages from the other user as read
      await storage.markMessagesAsRead(userId, currentUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      next(error);
    }
  });
  
  app.post("/api/messages", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const senderId = req.user!.id;
      const { receiverId, content } = req.body;
      
      if (!receiverId || !content) {
        return res.status(400).json({ message: "Receiver ID and content are required" });
      }
      
      // Create the message
      const message = await storage.createMessage({
        senderId,
        receiverId,
        content,
        read: false
      });
      
      // Notify connected clients about the new message
      const receiverSocket = connectedClients.get(receiverId.toString());
      if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
        receiverSocket.send(JSON.stringify({
          type: "new_message",
          data: message,
        }));
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      next(error);
    }
  });
  
  // Posts API route for community features
  app.get("/api/posts", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sportType = req.query.sportType as string | undefined;
      
      // In a real application, you would fetch posts from database
      // For demo purposes, return mock posts
      const mockPosts = [
        {
          id: 1,
          content: "Looking for players to join basketball game at Victoria Park this weekend!",
          userId: 1,
          username: "basketball_lover",
          fullName: "James Wong",
          likes: 12,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        },
        {
          id: 2,
          content: "New swimming techniques workshop at Morrison Hill Pool next Tuesday, anyone interested?",
          userId: 2,
          username: "swim_coach",
          fullName: "Emma Chan",
          likes: 8,
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
        },
        {
          id: 3,
          content: "Just discovered an amazing football pitch in Kowloon Tsai Park! Great facilities and not too crowded.",
          userId: 3,
          username: "football_fan",
          fullName: "David Lee",
          likes: 15,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
        }
      ];
      
      // Filter by sport type if provided
      const filteredPosts = sportType && sportType !== "all"
        ? mockPosts.filter(post => post.content.toLowerCase().includes(sportType.toLowerCase()))
        : mockPosts;
      
      return res.json(filteredPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      next(error);
    }
  });
  
  // Create post API route for community features
  app.post("/api/posts", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      // In a real application, you would create a post in database
      // For demo purposes, return mock response
      return res.status(201).json({
        id: Date.now(),
        content,
        userId: req.user!.id,
        username: req.user!.username,
        fullName: req.user!.fullName,
        likes: 0,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating post:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time updates (court availability, messaging, etc.)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store client connections with their metadata (WebSocket Handler)
  const clients = new Map();
  
  // Store user ID to client mapping for direct messaging (WebSocket Manager)
  // This implements a similar pattern to WhatsApp's WebSocket Manager that tracks which 
  // handlers are connected to which users
  const connectedClients = new Map();
  
  // Store conversation subscriptions (similar to WhatsApp's group messaging topics)
  const conversations = new Map();
  
  // Message queue for offline users (implements WhatsApp's store and forward mechanism)
  // Messages are stored here temporarily until they can be delivered
  const messageQueue = new Map();
  
  // Middleware to authenticate WebSocket connections
  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection attempt received');
    
    // Create a unique client ID
    const clientId = Date.now().toString();
    let userId = null;
    let authTimerId = null;
    
    // Add client to clients map
    clients.set(clientId, {
      ws,
      userId: null, // Will be set after authentication
      subscriptions: new Set(), // Track what this client is subscribed to
      authenticated: false, // Track authentication status
      lastActivity: Date.now() // For connection monitoring
    });
    
    // Send initial message
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'Connected to Hong Kong Sports Hub WebSocket server - authentication required',
      clientId,
      requiresAuth: true
    }));
    
    // Set a timeout for authentication
    authTimerId = setTimeout(() => {
      if (clients.has(clientId)) {
        const client = clients.get(clientId);
        if (!client.authenticated) {
          console.log(`WebSocket client ${clientId} failed to authenticate within timeout, closing connection`);
          
          try {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Authentication timeout - please authenticate within 15 seconds of connecting'
            }));
            
            ws.close(1008, 'Authentication timeout');
          } catch (err) {
            console.error(`Error closing unauthenticated WebSocket: ${err.message}`);
          }
          
          // Clean up resources
          clients.delete(clientId);
        }
      }
    }, 15000); // 15 seconds timeout for authentication
    
    // Handle potential connection errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      
      // Don't try to send on errored connections
      // Just clean up resources
      const erroredClient = clients.get(clientId);
      if (erroredClient && erroredClient.userId) {
        connectedClients.delete(erroredClient.userId.toString());
      }
      
      // No need to explicitly close here - the 'close' event will trigger afterward
    });
    
    ws.on('message', async (message) => {
      try {
        // Safely parse the incoming message
        let data;
        try {
          data = JSON.parse(message.toString());
        } catch (parseError) {
          console.error(`Invalid JSON received from client ${clientId}:`, message.toString());
          return;
        }
        
        // Check for required fields
        if (!data || !data.type) {
          console.error(`Invalid message format from client ${clientId}, missing 'type' field`);
          return;
        }
        
        console.log('Received WebSocket message:', data);
        
        // Handle different message types
        switch (data.type) {
          case 'auth':
            try {
              // Authenticate the WebSocket connection using JWT token
              const token = data.token;
              
              if (!token) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Authentication failed - no token provided'
                }));
                return;
              }
              
              // Verify token
              const AUTH_TOKEN_KEY = "hong_kong_sports_hub_jwt_secret_key";
              let decoded;
              
              try {
                decoded = jwt.verify(token, AUTH_TOKEN_KEY) as any;
              } catch (tokenError) {
                console.error(`Token verification failed for client ${clientId}:`, tokenError);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Authentication failed - invalid token'
                }));
                return;
              }
              
              // Token is valid, extract user ID and update client
              userId = decoded.id;
              
              if (!userId) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Authentication failed - invalid user ID in token'
                }));
                return;
              }
              
              const wsClient = clients.get(clientId);
              if (wsClient) {
                wsClient.userId = userId;
                wsClient.authenticated = true; // Mark as authenticated
                wsClient.lastActivity = Date.now(); // Update activity timestamp
                
                // Store the connection for direct messaging
                const userIdStr = userId.toString();
                connectedClients.set(userIdStr, ws);
                
                console.log(`Client ${clientId} authenticated as user ${userId}`);
                
                // Confirm successful authentication to the client
                ws.send(JSON.stringify({
                  type: 'auth_success',
                  userId: userId,
                  username: decoded.username,
                  message: 'Authentication successful'
                }));
                
                // Clear the authentication timeout since we're now authenticated
                if (authTimerId) {
                  clearTimeout(authTimerId);
                  authTimerId = null;
                }
                
                // WhatsApp-inspired store-and-forward: check if there are queued messages for this user
                if (messageQueue.has(userIdStr)) {
                  const queuedMessages = messageQueue.get(userIdStr);
                  console.log(`Found ${queuedMessages.length} queued messages for user ${userId}, delivering now...`);
                  
                  // Send all queued messages to the user who just came online
                  queuedMessages.forEach(queuedMsg => {
                    try {
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(queuedMsg));
                        console.log(`Delivered queued message to user ${userId}`);
                      }
                    } catch (error) {
                      console.error(`Failed to deliver queued message to user ${userId}:`, error);
                    }
                  });
                  
                  // Clear the queue after delivery attempt
                  messageQueue.delete(userIdStr);
                }
              }
            } catch (authError) {
              console.error(`Authentication error for client ${clientId}:`, authError);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication failed - server error'
              }));
            }
            break;
            
          case 'join_conversation':
            // Subscribe to a conversation
            const conversationId = data.conversationId;
            
            // Store the subscription
            const clientObj = clients.get(clientId);
            if (clientObj && clientObj.userId) {
              clientObj.subscriptions.add(`conversation:${conversationId}`);
              
              // Add to conversations map
              if (!conversations.has(conversationId)) {
                conversations.set(conversationId, new Set());
              }
              conversations.get(conversationId).add(clientId);
              
              console.log(`Client ${clientId} (User ${clientObj.userId}) joined conversation ${conversationId}`);
            }
            break;
            
          case 'leave_conversation':
            // Unsubscribe from a conversation
            const convoId = data.conversationId;
            
            // Remove the subscription
            const cl = clients.get(clientId);
            if (cl) {
              cl.subscriptions.delete(`conversation:${convoId}`);
              
              // Remove from conversations map
              if (conversations.has(convoId)) {
                conversations.get(convoId).delete(clientId);
                
                // Clean up empty conversations
                if (conversations.get(convoId).size === 0) {
                  conversations.delete(convoId);
                }
              }
              
              console.log(`Client ${clientId} left conversation ${convoId}`);
            }
            break;
            
          case 'message':
            // Handle new message
            const msgConversationId = data.conversationId;
            const message = data.message;
            
            if (!msgConversationId || !message) {
              console.error('Invalid message format, missing conversationId or message content');
              break;
            }
            
            // Check if the message is from the authenticated user
            const messageClient = clients.get(clientId);
            if (!messageClient || !messageClient.userId) {
              console.error('Unauthenticated message attempt');
              break;
            }
            
            // Verify the message sender matches the authenticated user
            if (message.senderId !== messageClient.userId) {
              console.error('Message sender ID does not match authenticated user');
              break;
            }
            
            // Broadcast to all clients subscribed to this conversation
            if (conversations.has(msgConversationId)) {
              const subscribers = conversations.get(msgConversationId);
              subscribers.forEach((subscriberId: string) => {
                const subscriberClient = clients.get(subscriberId);
                if (subscriberClient && subscriberClient.ws && subscriberClient.ws.readyState === WebSocket.OPEN) {
                  try {
                    subscriberClient.ws.send(JSON.stringify({
                      type: 'message',
                      conversationId: msgConversationId,
                      message
                    }));
                  } catch (sendError) {
                    console.error(`Failed to send message to client ${subscriberId}:`, sendError);
                    // If sending fails, remove this client from the conversation
                    // to prevent future errors
                    if (conversations.has(msgConversationId)) {
                      conversations.get(msgConversationId).delete(subscriberId);
                    }
                  }
                } else if (subscriberClient) {
                  console.log(`Cannot send to client ${subscriberId}: WebSocket not open (state: ${
                    subscriberClient.ws ? subscriberClient.ws.readyState : 'undefined'
                  })`);
                  // Remove client from conversation if their connection is no longer open
                  if (conversations.has(msgConversationId)) {
                    conversations.get(msgConversationId).delete(subscriberId);
                  }
                }
              });
              
              // Save message to database
              try {
                // Extract the necessary fields from the message object
                const insertMessage: schema.InsertMessage = {
                  senderId: message.senderId,
                  receiverId: message.receiverId,
                  content: message.content,
                  read: false
                };
                
                // Save the message in the database (persistence)
                const savedMessage = await storage.createMessage(insertMessage);
                console.log(`Message saved to database and broadcasted to ${subscribers.size} clients in conversation ${msgConversationId}`);
                
                // Store and Forward mechanism - adapted from WhatsApp architecture
                // Check if the recipient is offline and queue the message
                const recipientUserId = message.receiverId.toString();
                if (!connectedClients.has(recipientUserId)) {
                  console.log(`Recipient ${recipientUserId} is offline, queueing message for delivery`);
                  
                  // Initialize message queue for this recipient if needed
                  if (!messageQueue.has(recipientUserId)) {
                    messageQueue.set(recipientUserId, []);
                  }
                  
                  // Queue the message for later delivery
                  messageQueue.get(recipientUserId).push({
                    type: 'message',
                    conversationId: msgConversationId,
                    message: savedMessage
                  });
                }
              } catch (error) {
                console.error('Error saving message to database:', error);
              }
            }
            break;
            
          case 'ping':
            // Handle ping from client to keep connection alive
            // Send a pong response to confirm the connection is still active
            try {
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
                clientId
              }));
            } catch (pingError) {
              console.error(`Error responding to ping from client ${clientId}:`, pingError);
            }
            break;
            
          case 'subscribe_facility':
            // Add facility subscription logic
            const facilityId = data.facilityId;
            const facilityClient = clients.get(clientId);
            
            if (facilityClient) {
              facilityClient.subscriptions.add(`facility:${facilityId}`);
              console.log(`Client ${clientId} subscribed to facility updates for facility ID: ${facilityId}`);
            }
            break;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`WebSocket client ${clientId} disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
      
      // Cancel any pending authentication timer
      if (authTimerId) {
        clearTimeout(authTimerId);
        authTimerId = null;
      }
      
      // Clean up client subscriptions
      const disconnectedClient = clients.get(clientId);
      if (disconnectedClient) {
        // Remove from direct messaging map if authenticated
        if (disconnectedClient.userId) {
          connectedClients.delete(disconnectedClient.userId.toString());
          console.log(`Removed user ${disconnectedClient.userId} from connected clients`);
          
          // Log the remaining connected clients for debugging
          console.log(`Remaining connected clients: ${connectedClients.size}`);
        }
        
        // Remove client from all conversations
        conversations.forEach((subscribers, conversationId) => {
          if (subscribers.has(clientId)) {
            subscribers.delete(clientId);
            console.log(`Removed client ${clientId} from conversation ${conversationId}`);
            
            // Clean up empty conversations
            if (subscribers.size === 0) {
              conversations.delete(conversationId);
              console.log(`Removed empty conversation: ${conversationId}`);
            }
          }
        });
        
        // Remove all client subscriptions
        disconnectedClient.subscriptions.clear();
        
        // Remove client
        clients.delete(clientId);
        console.log(`Removed client ${clientId} from clients map. Total clients: ${clients.size}`);
      }
    });
  });
  
  return httpServer;
}
