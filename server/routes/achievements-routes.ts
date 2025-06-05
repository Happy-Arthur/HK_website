import { Express, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { achievements, userAchievements } from "@shared/schema";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { achievementsService } from "../services/achievements-service";

/**
 * Register achievements routes
 */
export function registerAchievementsRoutes(app: Express) {
  console.log("[routes] Registering achievements routes");
  
  // Get all achievements
  app.get(
    "/api/achievements", 
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const allAchievements = await db.select().from(achievements);
        res.json(allAchievements);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Get a user's achievements
  app.get(
    "/api/achievements/user/:userId",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = parseInt(req.params.userId);
        
        // Check that the authenticated user is fetching their own achievements
        // or is an admin user
        if (req.user?.id !== userId && !req.user?.isAdmin) {
          return res.status(403).json({ error: "Unauthorized to view another user's achievements" });
        }
        
        const progress = await achievementsService.getUserAchievementProgress(userId);
        const totalPoints = await achievementsService.getUserPoints(userId);
        
        res.json({
          achievements: progress,
          totalPoints
        });
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Get the current user's achievements
  app.get(
    "/api/achievements/my",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        
        const progress = await achievementsService.getUserAchievementProgress(userId);
        const totalPoints = await achievementsService.getUserPoints(userId);
        
        res.json({
          achievements: progress,
          totalPoints
        });
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Get the current user's achievement points
  app.get(
    "/api/achievements/my/points",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        const totalPoints = await achievementsService.getUserPoints(userId);
        
        res.json({ points: totalPoints });
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Get the current user's recent achievements
  app.get(
    "/api/achievements/my/recent",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
        
        const recentAchievements = await achievementsService.getRecentAchievements(userId, limit);
        
        res.json(recentAchievements);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Get achievements by category
  app.get(
    "/api/achievements/category/:category",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = req.params.category;
        
        const categoryAchievements = await db
          .select()
          .from(achievements)
          .where(eq(achievements.category, category as any));
        
        res.json(categoryAchievements);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Admin: Create a new achievement
  app.post(
    "/api/achievements",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only allow admins to create achievements
        if (!req.user?.isAdmin) {
          return res.status(403).json({ error: "Unauthorized to create achievements" });
        }
        
        const newAchievement = req.body;
        
        const [createdAchievement] = await db
          .insert(achievements)
          .values(newAchievement)
          .returning();
        
        res.status(201).json(createdAchievement);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Admin: Update an achievement
  app.put(
    "/api/achievements/:id",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only allow admins to update achievements
        if (!req.user?.isAdmin) {
          return res.status(403).json({ error: "Unauthorized to update achievements" });
        }
        
        const achievementId = parseInt(req.params.id);
        const updateData = req.body;
        
        const [updatedAchievement] = await db
          .update(achievements)
          .set(updateData)
          .where(eq(achievements.id, achievementId))
          .returning();
        
        if (!updatedAchievement) {
          return res.status(404).json({ error: "Achievement not found" });
        }
        
        res.json(updatedAchievement);
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Admin: Delete an achievement
  app.delete(
    "/api/achievements/:id",
    isAuthenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Only allow admins to delete achievements
        if (!req.user?.isAdmin) {
          return res.status(403).json({ error: "Unauthorized to delete achievements" });
        }
        
        const achievementId = parseInt(req.params.id);
        
        // First remove all user achievements for this achievement
        await db
          .delete(userAchievements)
          .where(eq(userAchievements.achievementId, achievementId));
        
        // Then delete the achievement
        const [deletedAchievement] = await db
          .delete(achievements)
          .where(eq(achievements.id, achievementId))
          .returning();
        
        if (!deletedAchievement) {
          return res.status(404).json({ error: "Achievement not found" });
        }
        
        res.json({ message: "Achievement deleted successfully" });
      } catch (error) {
        next(error);
      }
    }
  );
  
  // Admin: Get user achievements leaderboard (top users by achievement points)
  app.get(
    "/api/achievements/leaderboard",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        
        // This is a complex query using SQL directly for better performance
        const leaderboard = await db.execute(sql`
          SELECT 
            u.id, 
            u.username, 
            u.full_name, 
            SUM(a.points) as total_points,
            COUNT(ua.achievement_id) as achievements_count
          FROM 
            users u
          JOIN 
            user_achievements ua ON u.id = ua.user_id
          JOIN 
            achievements a ON ua.achievement_id = a.id
          WHERE 
            ua.completed = true
          GROUP BY 
            u.id, u.username, u.full_name
          ORDER BY 
            total_points DESC, achievements_count DESC
          LIMIT ${limit}
        `);
        
        res.json(leaderboard.rows);
      } catch (error) {
        next(error);
      }
    }
  );
}