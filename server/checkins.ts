// server/routes/checkins.ts
import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";

/**
 * This file contains routes for handling check-ins functionality
 */

export function registerCheckInRoutes(app: any, requireAuth: any) {
  // Create a new check-in
  app.post(
    "/api/facilities/:id/checkin",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
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

        // Create the check-in
        const checkIn = await storage.createCheckIn({
          userId,
          facilityId,
        });

        console.log(`User ${userId} checked in at facility ${facilityId}`);
        res.status(201).json(checkIn);
      } catch (error) {
        console.error("Error during check-in:", error);
        next(error);
      }
    },
  );

  // Get check-ins for a facility with usernames
  // This enhances the original route to include usernames
  app.get(
    "/api/facilities/:id/checkins",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const facilityId = parseInt(req.params.id);

        if (isNaN(facilityId) || facilityId <= 0) {
          return res.status(400).json({ message: "Invalid facility ID" });
        }

        // Get check-ins with usernames joined
        // The implementation may require an update to storage.ts
        const checkIns = await storage.getCheckInsWithUsernames(facilityId);

        res.json(checkIns);
      } catch (error) {
        console.error("Error fetching facility check-ins:", error);
        next(error);
      }
    },
  );

  // Get user's check-in history
  app.get(
    "/api/user/checkins",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;

        // Get user's check-ins with facility details
        const checkIns = await storage.getCheckInsByUserId(userId);

        res.json(checkIns);
      } catch (error) {
        console.error("Error fetching user check-ins:", error);
        next(error);
      }
    },
  );
}
