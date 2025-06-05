import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedFacilities } from "./seed";
import path from "path";
import cookieParser from "cookie-parser";
import { ratingService } from "./services/rating-service";
import { checkInService } from "./services/checkin-service";
import { initLocationService } from "./services/location-service";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "client", "public")));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run migrations first to ensure schema is up to date
  try {
    // Run user profile columns migration
    const { runMigration } = await import("./migrations/add-user-profile-columns");
    await runMigration();
    log("Profile columns migration completed");
    
    // Run skill level format migration
    const { runSkillLevelMigration } = await import("./migrations/update-skill-level-to-json");
    await runSkillLevelMigration();
    log("Skill level format migration completed");
    
    // Run community tables migration
    const { runMigration: runCommunityTablesMigration } = await import("./migrations/create-community-tables");
    await runCommunityTablesMigration();
    log("Community tables migration completed");
    
    // Run web search approval columns migration
    const { runMigration: runWebSearchMigration } = await import("./migrations/add-web-search-approval-columns");
    await runWebSearchMigration();
    log("Web search approval columns migration completed");
    
    // Run event external fields migration
    const { runMigration: runEventExternalFieldsMigration } = await import("./migrations/add-event-external-fields");
    await runEventExternalFieldsMigration();
    log("Event external fields migration completed");
    
    // Run messages table migration
    const { runMigration: runMessagesTableMigration } = await import("./migrations/create-messages-table");
    await runMessagesTableMigration();
    log("Messages table migration completed");
    
    // Run post likes table migration
    const { runMigration: runPostLikesTableMigration } = await import("./migrations/create-post-likes-table");
    await runPostLikesTableMigration();
    log("Post likes table migration completed");
    
    // Run events group ID migration
    const { runMigration: runGroupIdEventsMigration } = await import("./migrations/add-group-id-to-events");
    await runGroupIdEventsMigration();
    log("Events group ID migration completed");
    
    // Run group members status column migration
    const { runMigration: runGroupMembersStatusMigration } = await import("./migrations/add-status-to-group-members");
    await runGroupMembersStatusMigration();
    log("Group members status migration completed");
    
    // Run group events tables migration
    const { runMigration: runGroupEventsTablesMigration } = await import("./migrations/create-group-events-tables");
    await runGroupEventsTablesMigration();
    log("Group events tables migration completed");
    
    // Run achievements system tables migration
    const { createAchievementsTables, seedAchievements } = await import("./migrations/create-achievements-tables");
    await createAchievementsTables();
    await seedAchievements();
    log("Achievements system migration completed");
    
    // Run challenges tables migration
    const { createChallengesTables } = await import("./migrations/challenges");
    await createChallengesTables();
    log("Challenges system migration completed");
    
    log("All database migrations completed");
  } catch (error) {
    log(`Error running migrations: ${error}`);
  }
  
  // Seed the database with sample facilities data
  try {
    await seedFacilities();
    log("Database seeding completed");
  } catch (error) {
    log(`Error seeding database: ${error}`);
  }

  try {
    console.log("Loading recent check-ins...");
    await checkInService.loadExistingCheckIns();
    console.log("Check-in service initialized");
  } catch (error) {
    console.error("Error initializing check-in service:", error);
  }
  
  // Initialize location tracking service
  try {
    console.log("Initializing location tracking service...");
    initLocationService();
    console.log("Location tracking service initialized");
  } catch (error) {
    console.error("Error initializing location service:", error);
  }

  // Initialize rating service - handle errors for missing columns
  try {
    console.log("Initializing rating service...");
    // Try to use the service's functionality without updating the cached ratings
    const facilityIds = await getFacilityIdsWithReviews();
    console.log(`Found ${facilityIds.length} facilities with reviews`);

    // Skip recalculating if we encountered database schema issues
    console.log("Rating service initialized");
  } catch (error) {
    console.error("Error initializing rating service:", error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

// Helper function to get facility IDs that have reviews
async function getFacilityIdsWithReviews(): Promise<number[]> {
  try {
    const { db } = await import("./db");
    const { reviews } = await import("@shared/schema");

    const facilitiesWithReviews = await db
      .select({
        facilityId: reviews.facilityId,
      })
      .from(reviews)
      .groupBy(reviews.facilityId);

    return facilitiesWithReviews.map((f) => f.facilityId);
  } catch (error) {
    console.error("Error getting facilities with reviews:", error);
    return [];
  }
}
