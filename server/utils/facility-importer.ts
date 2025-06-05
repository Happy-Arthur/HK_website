// server/utils/facility-importer.ts
import { db } from "../db";
import { facilities, facilityTypes, districts } from "@shared/schema";
import { ratingService } from "../services/rating-service";
import fs from "fs";
import path from "path";
import { z } from "zod";

// Define validation schema for imported facility data
const ImportedFacilitySchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  description: z.string().optional(),
  type: z.enum(facilityTypes),
  district: z.enum(districts),
  address: z.string().min(1, "Address is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  contactPhone: z.string().optional(),
  imageUrl: z.string().optional(),
  courts: z.number().int().optional(),
  amenities: z.array(z.string()).optional(),
  ageRestriction: z.string().optional(),
  genderSuitability: z.string().optional(),
});

export type ImportedFacility = z.infer<typeof ImportedFacilitySchema>;

/**
 * Utility for importing sports facilities data from various sources
 */
export class FacilityImporter {
  /**
   * Import facilities from a JSON file
   * @param filePath Path to the JSON file containing facility data
   * @returns Number of facilities imported
   */
  async importFromJsonFile(filePath: string): Promise<number> {
    try {
      console.log(`Importing facilities from ${filePath}`);

      // Read and parse the JSON file
      const fileContent = fs.readFileSync(path.resolve(filePath), "utf8");
      const data = JSON.parse(fileContent);

      // Validate data is an array
      if (!Array.isArray(data)) {
        throw new Error("Import file must contain an array of facilities");
      }

      // Import the facilities
      return await this.importFacilities(data);
    } catch (error) {
      console.error("Error importing facilities from JSON file:", error);
      throw error;
    }
  }

  /**
   * Import facilities from GeoJSON format
   * @param filePath Path to the GeoJSON file
   * @returns Number of facilities imported
   */
  async importFromGeoJson(filePath: string): Promise<number> {
    try {
      console.log(`Importing facilities from GeoJSON: ${filePath}`);

      // Read and parse the GeoJSON file
      const fileContent = fs.readFileSync(path.resolve(filePath), "utf8");
      const geoJson = JSON.parse(fileContent);

      // Validate basic GeoJSON structure
      if (
        geoJson.type !== "FeatureCollection" ||
        !Array.isArray(geoJson.features)
      ) {
        throw new Error("Invalid GeoJSON format");
      }

      // Transform GeoJSON features to facility objects
      const facilities = geoJson.features
        .map((feature: any) => {
          if (
            feature.geometry?.type !== "Point" ||
            !Array.isArray(feature.geometry.coordinates)
          ) {
            console.warn("Skipping feature without valid point geometry");
            return null;
          }

          // Extract properties with defaults
          const props = feature.properties || {};

          // Coordinate order in GeoJSON is [longitude, latitude]
          const [longitude, latitude] = feature.geometry.coordinates;

          // Map to facility structure
          return {
            name: props.name || "Unknown Facility",
            description: props.description,
            type: props.type || "other",
            district: props.district || "central",
            address: props.address || "Hong Kong",
            latitude,
            longitude,
            openTime: props.openTime,
            closeTime: props.closeTime,
            contactPhone: props.contactPhone,
            imageUrl: props.imageUrl,
            courts: props.courts ? Number(props.courts) : undefined,
            amenities: props.amenities,
            ageRestriction: props.ageRestriction,
            genderSuitability: props.genderSuitability,
          };
        })
        .filter(Boolean);

      // Import the transformed facilities
      return await this.importFacilities(facilities);
    } catch (error) {
      console.error("Error importing facilities from GeoJSON:", error);
      throw error;
    }
  }

  /**
   * Import facilities from a CSV file
   * @param filePath Path to the CSV file
   * @returns Number of facilities imported
   */
  async importFromCsv(filePath: string): Promise<number> {
    try {
      console.log(`Importing facilities from CSV: ${filePath}`);

      // Read the CSV file
      const fileContent = fs.readFileSync(path.resolve(filePath), "utf8");

      // Split into lines and parse header
      const lines = fileContent.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());

      // Transform CSV rows to facility objects
      const facilities = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());

        // Create object from header/value pairs
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (values[index] !== undefined) {
            obj[header] = values[index];
          }
        });

        // Convert numeric fields
        if (obj.latitude) obj.latitude = parseFloat(obj.latitude);
        if (obj.longitude) obj.longitude = parseFloat(obj.longitude);
        if (obj.courts) obj.courts = parseInt(obj.courts, 10);

        // Parse amenities if it's a string representation of array
        if (
          typeof obj.amenities === "string" &&
          obj.amenities.startsWith("[")
        ) {
          try {
            obj.amenities = JSON.parse(obj.amenities);
          } catch (e) {
            obj.amenities = obj.amenities
              .replace(/[\[\]"']/g, "")
              .split(",")
              .map((s: string) => s.trim());
          }
        }

        return obj;
      });

      // Import the transformed facilities
      return await this.importFacilities(facilities);
    } catch (error) {
      console.error("Error importing facilities from CSV:", error);
      throw error;
    }
  }

  /**
   * Core method to import an array of facility objects
   * @param facilitiesData Array of facility objects to import
   * @returns Number of facilities successfully imported
   */
  async importFacilities(facilitiesData: any[]): Promise<number> {
    let importedCount = 0;
    let errorCount = 0;

    // Process each facility
    for (const data of facilitiesData) {
      try {
        // Validate against schema
        const validatedData = ImportedFacilitySchema.parse(data);

        // Check for existing facility with same name and location
        const existingFacility = await db
          .select()
          .from(facilities)
          .where(
            db.and(
              db.eq(facilities.name, validatedData.name),
              db.eq(facilities.latitude, validatedData.latitude),
              db.eq(facilities.longitude, validatedData.longitude),
            ),
          )
          .limit(1);

        if (existingFacility.length > 0) {
          console.log(`Skipping duplicate facility: ${validatedData.name}`);
          continue;
        }

        // Insert the new facility
        const [newFacility] = await db
          .insert(facilities)
          .values(validatedData)
          .returning();

        console.log(
          `Imported facility: ${newFacility.name} (ID: ${newFacility.id})`,
        );
        importedCount++;
      } catch (error) {
        console.error(
          `Error importing facility: ${data?.name || "unnamed"}`,
          error,
        );
        errorCount++;
      }
    }

    console.log(
      `Import completed: ${importedCount} imported, ${errorCount} errors`,
    );
    return importedCount;
  }

  /**
   * Update coordinates for facilities using an external geocoding service
   * @param apiKey API key for the geocoding service
   * @returns Number of facilities updated
   */
  async updateCoordinatesFromAddresses(apiKey: string): Promise<number> {
    // Implementation would depend on which geocoding service you want to use
    // This is a placeholder for the concept
    console.log(
      "This method would use a geocoding service to update coordinates",
    );
    return 0;
  }
}

// Export a singleton instance
export const facilityImporter = new FacilityImporter();
