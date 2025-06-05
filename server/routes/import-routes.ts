// server/routes/import-routes.ts (simplified version)
import { Express, Request, Response, NextFunction } from "express";
import { facilityImporter } from "../utils/facility-importer";

// Require admin authentication middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export function registerImportRoutes(app: Express, requireAuth: any) {
  /**
   * Import facilities from a provided JSON array in the request body
   */
  app.post(
    "/api/admin/import/facilities/json",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const facilitiesData = req.body;

        if (!Array.isArray(facilitiesData)) {
          return res.status(400).json({
            message:
              "Invalid request format. Expected an array of facility objects",
          });
        }

        const importCount =
          await facilityImporter.importFacilities(facilitiesData);

        res.status(200).json({
          message: `Successfully imported ${importCount} facilities`,
          importedCount: importCount,
        });
      } catch (error) {
        console.error("Error in facility JSON import:", error);
        next(error);
      }
    },
  );

  /**
   * Admin endpoint to recalculate all facility ratings
   */
  app.post(
    "/api/admin/facilities/recalculate-ratings",
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ratingService =
          require("../services/rating-service").ratingService;
        await ratingService.recalculateAllRatings();

        res.status(200).json({
          message: "Successfully recalculated all facility ratings",
        });
      } catch (error) {
        console.error("Error recalculating ratings:", error);
        next(error);
      }
    },
  );
}
