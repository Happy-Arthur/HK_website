/**
 * This file contains routes for handling challenges functionality
 */
import { Request, Response, NextFunction, Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertChallengeSchema, insertUserChallengeSchema } from "@shared/schema";

// Schema for updating challenge progress
const updateChallengeProgressSchema = z.object({
  currentValue: z.number().int().min(0),
});

export function registerChallengeRoutes(app: Express, requireAuth: any) {
  console.log('[routes] Registering challenges routes');

  // Get all challenges (with optional filters)
  app.get("/api/challenges", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        type: req.query.type as string | undefined,
        duration: req.query.duration as string | undefined,
        sportType: req.query.sportType as string | undefined,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        district: req.query.district as string | undefined,
        query: req.query.query as string | undefined,
        isPublic: req.query.isPublic !== undefined ? req.query.isPublic === 'true' : undefined,
        groupId: req.query.groupId ? parseInt(req.query.groupId as string) : undefined,
        userId: req.user?.id, // Pass user ID to check group membership for private challenges
      };

      // Validate groupId if provided
      if (filters.groupId !== undefined && isNaN(filters.groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      const challenges = await storage.getChallenges(filters);
      return res.json({ challenges });
    } catch (error) {
      next(error);
    }
  });

  // Get a specific challenge by ID
  app.get("/api/challenges/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      // Pass the user ID if authenticated to check group membership for private challenges
      const userId = req.user?.id;
      const challenge = await storage.getChallenge(challengeId, userId);
      
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      return res.json({ challenge });
    } catch (error) {
      next(error);
    }
  });

  // Create a new challenge (admin only)
  app.post("/api/challenges", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is admin
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Only admins can create challenges" });
      }

      // Validate request body against schema
      const validatedData = insertChallengeSchema.parse({
        ...req.body,
        createdBy: req.user.id,
      });

      // Create challenge in database
      const challenge = await storage.createChallenge(validatedData);
      return res.status(201).json({ challenge });
    } catch (error) {
      next(error);
    }
  });

  // Update a challenge (admin only)
  app.put("/api/challenges/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is admin
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Only admins can update challenges" });
      }

      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      const userId = req.user?.id;
      const challenge = await storage.getChallenge(challengeId, userId);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      // Update challenge in database
      const updatedChallenge = await storage.updateChallenge(challengeId, req.body);
      return res.json({ challenge: updatedChallenge });
    } catch (error) {
      next(error);
    }
  });

  // Delete a challenge (admin only)
  app.delete("/api/challenges/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is admin
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Only admins can delete challenges" });
      }

      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      const userId = req.user?.id;
      const challenge = await storage.getChallenge(challengeId, userId);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      // Delete challenge from database
      await storage.deleteChallenge(challengeId);
      return res.json({ message: "Challenge deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // User routes for challenges

  // Get all challenges for current user
  app.get("/api/user/challenges", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userChallenges = await storage.getUserChallenges(userId);
      return res.json({ userChallenges });
    } catch (error) {
      next(error);
    }
  });

  // Join a challenge
  app.post("/api/challenges/:id/join", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      // Check if challenge exists
      const challenge = await storage.getChallenge(challengeId, userId);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found or you don't have access" });
      }

      // Check if challenge is active
      if (!challenge.isActive) {
        return res.status(400).json({ message: "This challenge is not active" });
      }

      // Check if challenge has already ended
      if (new Date(challenge.endDate) < new Date()) {
        return res.status(400).json({ message: "This challenge has already ended" });
      }

      // Validate and join challenge
      const validatedData = insertUserChallengeSchema.parse({
        userId,
        challengeId,
        currentValue: 0,
      });

      // Join challenge
      const userChallenge = await storage.joinChallenge(validatedData);
      return res.status(201).json({ userChallenge });
    } catch (error) {
      next(error);
    }
  });

  // Update challenge progress
  app.put("/api/challenges/:id/progress", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      // Validate request body
      const validatedData = updateChallengeProgressSchema.parse(req.body);
      
      // Update progress
      const userChallenge = await storage.updateUserChallengeProgress(
        userId,
        challengeId,
        validatedData.currentValue
      );
      
      return res.json({ userChallenge });
    } catch (error) {
      next(error);
    }
  });

  // Complete a challenge manually
  app.post("/api/challenges/:id/complete", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const challengeId = parseInt(req.params.id);
      if (isNaN(challengeId)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      // Complete challenge
      const userChallenge = await storage.completeUserChallenge(userId, challengeId);
      return res.json({ userChallenge });
    } catch (error) {
      next(error);
    }
  });

  // Group challenge routes
  
  // Create a new challenge for a specific group (group admin/moderator only)
  app.post("/api/groups/:groupId/challenges", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const groupId = parseInt(req.params.groupId);
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if user is a member and has admin/moderator role in the group
      const groupMember = await storage.getGroupMember(groupId, userId);
      if (!groupMember) {
        return res.status(403).json({ message: "You must be a member of this group" });
      }

      if (groupMember.role !== "admin" && groupMember.role !== "moderator") {
        return res.status(403).json({ message: "Only group admins and moderators can create group challenges" });
      }

      // Validate request body against schema and set group specifics
      const validatedData = insertChallengeSchema.parse({
        ...req.body,
        createdBy: userId,
        groupId: groupId,
        isPublic: false, // Group challenges are private to the group
      });

      // Create challenge in database
      const challenge = await storage.createChallenge(validatedData);
      return res.status(201).json({ challenge });
    } catch (error) {
      next(error);
    }
  });
  
  // Get all challenges for a specific group
  app.get("/api/groups/:groupId/challenges", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const groupId = parseInt(req.params.groupId);
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if user is a member of the group
      const isMember = await storage.isUserGroupMember(userId, groupId);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this group to view its challenges" });
      }

      // Get all challenges for this group
      const challenges = await storage.getChallenges({ 
        groupId,
        userId,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined 
      });
      
      return res.json({ challenges });
    } catch (error) {
      next(error);
    }
  });

  // Achievement routes

  // Get all achievements
  app.get("/api/achievements", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const achievements = await storage.getAchievements();
      return res.json({ achievements });
    } catch (error) {
      next(error);
    }
  });

  // Get current user's achievements
  app.get("/api/user/achievements", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userAchievements = await storage.getUserAchievements(userId);
      return res.json({ userAchievements });
    } catch (error) {
      next(error);
    }
  });
}