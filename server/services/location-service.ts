/**
 * Location Service
 * Handles GPS-based crowd estimation functionality
 */
import { db } from "../db";
import { sql, eq, and, lte, gte, desc } from "drizzle-orm";
import { facilities } from "@shared/schema";

// In-memory store for user locations (temporary storage, not persisted to DB)
// Using a Map with user ID as key to ensure we only count each user once per location
const userLocations = new Map<number, {
  userId: number;
  facilityId: number | null;
  latitude: number;
  longitude: number;
  timestamp: Date;
}>();

// Configuration
const LOCATION_EXPIRY_MINUTES = 10; // Consider locations valid for 10 minutes
const DEFAULT_RADIUS_METERS = 50;   // Default radius to consider user at a facility (in meters)

/**
 * Utility function to calculate distance between two coordinates in meters
 * Uses the Haversine formula to calculate great-circle distance
 */
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  // Convert to radians
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Determine which facility a user is at based on GPS coordinates
 * Returns the facility ID if user is within radius of a facility, null otherwise
 */
async function determineUserFacility(
  latitude: number, 
  longitude: number, 
  radiusMeters = DEFAULT_RADIUS_METERS
): Promise<number | null> {
  // Get all facilities
  const allFacilities = await db.select().from(facilities);
  
  // Find the closest facility within radius
  let closestFacility: { id: number, distance: number } | null = null;
  
  for (const facility of allFacilities) {
    if (!facility.latitude || !facility.longitude) continue;
    
    const distance = calculateDistance(
      latitude, 
      longitude, 
      facility.latitude, 
      facility.longitude
    );
    
    // If within radius and closer than any previous match, update closest facility
    if (distance <= radiusMeters && (!closestFacility || distance < closestFacility.distance)) {
      closestFacility = {
        id: facility.id,
        distance
      };
    }
  }
  
  return closestFacility ? closestFacility.id : null;
}

/**
 * Update a user's location
 */
export async function updateUserLocation(
  userId: number, 
  latitude: number, 
  longitude: number
): Promise<{ facilityId: number | null }> {
  // Remove any stale locations from the map
  cleanupStaleLocations();
  
  // Determine if user is at a facility based on GPS
  const facilityId = await determineUserFacility(latitude, longitude);
  
  // Update user's location in the in-memory store
  userLocations.set(userId, {
    userId,
    facilityId,
    latitude,
    longitude,
    timestamp: new Date()
  });
  
  console.log(`Updated location for user ${userId} at facility ${facilityId || 'none'}`);
  
  return { facilityId };
}

/**
 * Get number of users at a facility based on GPS data
 */
export function getUsersAtFacilityCount(facilityId: number): number {
  // Clean up expired locations first
  cleanupStaleLocations();
  
  // Count users that are at this facility
  let count = 0;
  
  for (const location of userLocations.values()) {
    if (location.facilityId === facilityId) {
      count++;
    }
  }
  
  return count;
}

/**
 * Get list of users at a facility based on GPS data
 * Note: This is for administrative purposes only and should be used with proper authorization
 */
export function getUsersAtFacility(facilityId: number): number[] {
  // Clean up expired locations first
  cleanupStaleLocations();
  
  // Collect user IDs that are at this facility
  const userIds: number[] = [];
  
  for (const location of userLocations.values()) {
    if (location.facilityId === facilityId) {
      userIds.push(location.userId);
    }
  }
  
  return userIds;
}

/**
 * Remove stale location data that's older than the expiry time
 */
function cleanupStaleLocations() {
  const now = new Date();
  const expiryTime = new Date(now.getTime() - LOCATION_EXPIRY_MINUTES * 60 * 1000);
  
  for (const [userId, location] of userLocations.entries()) {
    if (location.timestamp < expiryTime) {
      console.log(`Removing stale location for user ${userId}`);
      userLocations.delete(userId);
    }
  }
}

/**
 * Check if a user is at a specific facility based on GPS data
 */
export function isUserAtFacility(userId: number, facilityId: number): boolean {
  const location = userLocations.get(userId);
  if (!location) return false;
  
  // Check if location is recent enough and user is at specified facility
  const now = new Date();
  const expiryTime = new Date(now.getTime() - LOCATION_EXPIRY_MINUTES * 60 * 1000);
  
  return location.timestamp >= expiryTime && location.facilityId === facilityId;
}

// Initialize the service
export function initLocationService() {
  console.log('Location tracking service initialized');
  
  // Set up a periodic cleanup task to remove stale locations
  setInterval(cleanupStaleLocations, 5 * 60 * 1000); // Run every 5 minutes
  
  return {
    updateUserLocation,
    getUsersAtFacilityCount,
    getUsersAtFacility,
    isUserAtFacility
  };
}

// Export the service instance
export const locationService = {
  updateUserLocation,
  getUsersAtFacilityCount,
  getUsersAtFacility,
  isUserAtFacility
};