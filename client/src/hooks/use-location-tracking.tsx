import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * A custom hook to handle GPS location tracking for facility crowd estimation
 */
export function useLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  // Update the server with the user's current location
  const updateLocation = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await apiRequest("POST", "/api/location/update", {
        latitude: lat,
        longitude: lng,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Location updated successfully:", data);
        return data;
      } else {
        console.error("Failed to update location:", await response.text());
        return null;
      }
    } catch (error) {
      console.error("Error updating location:", error);
      return null;
    }
  }, []);

  // Start tracking user location
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      toast({
        title: "Location Services Unavailable",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    setIsTracking(true);
    setError(null);

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPosition({ lat: latitude, lng: longitude });
        await updateLocation(latitude, longitude);
      },
      (err) => {
        console.error("Error getting location:", err);
        setError(`Location error: ${err.message}`);
        setIsTracking(false);
        toast({
          title: "Location Error",
          description: "Unable to get your location. Some features may be limited.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true }
    );
  }, [updateLocation]);

  // Stop tracking user location
  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  // Helper function to calculate distance between coordinates
  const getDistanceFromLatLonInMeters = (
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c * 1000; // Distance in meters
    return d;
  };

  // Helper function to convert degrees to radians
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Check if user is near a specified location
  const isNearLocation = useCallback((targetLat: number, targetLng: number, radiusInMeters = 100): boolean => {
    if (!position) return false;
    
    const distance = getDistanceFromLatLonInMeters(
      position.lat, 
      position.lng, 
      targetLat, 
      targetLng
    );
    
    return distance <= radiusInMeters;
  }, [position]);

  return {
    isTracking,
    error,
    position,
    startTracking,
    stopTracking,
    updateLocation,
    isNearLocation
  };
}