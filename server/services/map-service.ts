import axios from 'axios';
import { Facility } from '@shared/schema';

/**
 * Service for handling maps integration and facility location search
 */
export class MapService {
  private googleMapsApiKey: string | undefined;
  private defaultCoordinates = {
    latitude: 22.3193,
    longitude: 114.1694 // Default coordinates for Hong Kong
  };

  constructor() {
    // Try to get API key from either GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!this.googleMapsApiKey) {
      console.log('GOOGLE_MAPS_API_KEY not found. Some location features may be limited.');
    } else {
      console.log('Google Maps API key found, full location features available');
    }
  }

  /**
   * Search for facilities near a specific location
   * @param latitude Latitude to search around
   * @param longitude Longitude to search around
   * @param radius Search radius in meters
   * @param facilities List of facilities to filter
   * @returns Filtered facilities ordered by distance
   */
  public findNearbyFacilities(
    latitude: number, 
    longitude: number, 
    radius: number = 5000, 
    facilities: Facility[]
  ): Facility[] {
    console.log(`Searching for facilities near ${latitude},${longitude} within ${radius}m radius`);
    
    // Filter facilities within radius and sort by distance
    const facilitiesWithDistance = facilities.map(facility => {
      const distance = this.calculateDistance(
        latitude, 
        longitude, 
        facility.latitude || this.defaultCoordinates.latitude, 
        facility.longitude || this.defaultCoordinates.longitude
      );
      
      return {
        ...facility,
        distance
      };
    });
    
    return facilitiesWithDistance
      .filter(facility => facility.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get address information from coordinates using reverse geocoding
   * @param latitude Latitude of the location
   * @param longitude Longitude of the location
   * @returns Address information or null if API key is not available
   */
  public async getAddressFromCoordinates(latitude: number, longitude: number): Promise<any | null> {
    if (!this.googleMapsApiKey) {
      console.log('Cannot perform reverse geocoding without Google Maps API key');
      return null;
    }

    try {
      // Enhanced error handling and detailed logging for debugging
      console.log(`Reverse geocoding coordinates: ${latitude}, ${longitude}`);
      
      // Add retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      let response = null;
      
      while (attempts < maxAttempts) {
        try {
          response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`, {
              params: {
                latlng: `${latitude},${longitude}`,
                key: this.googleMapsApiKey,
                region: 'hk', // Region biasing to Hong Kong
                language: 'en', // Ensure responses are in English
                result_type: 'street_address|premise|point_of_interest' // Prioritize meaningful results
              },
              timeout: 5000 // 5 second timeout
            }
          );
          
          // Check response and break the loop if successful
          if (response.data.status === 'OK' && response.data.results.length > 0) {
            console.log(`Reverse geocoding successful for ${latitude}, ${longitude}. Status: ${response.data.status}`);
            break;
          } else {
            console.warn(`Reverse geocoding attempt ${attempts + 1} failed. Status: ${response?.data?.status || 'Unknown'}`);
            
            // Only retry on certain error types
            if (response?.data?.status === 'OVER_QUERY_LIMIT' || 
                response?.data?.status === 'UNKNOWN_ERROR' ||
                !response) {
              attempts++;
              // Exponential backoff: 1s, 2s, 4s
              await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
            } else {
              // For other status codes like ZERO_RESULTS, don't retry
              break;
            }
          }
        } catch (retryError: any) {
          console.error(`Reverse geocoding attempt ${attempts + 1} error:`, retryError?.message || 'Unknown error');
          attempts++;
          if (attempts < maxAttempts) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
          }
        }
      }
      
      // Process results
      if (response && response.data.status === 'OK' && response.data.results.length > 0) {
        console.log(`Found address for coordinates ${latitude}, ${longitude}: "${response.data.results[0].formatted_address}"`);
        return response.data.results[0];
      }
      
      console.warn(`No valid reverse geocoding results for coordinates ${latitude}, ${longitude} after ${attempts + 1} attempts.`);
      return null;
    } catch (error: any) {
      console.error('Error in reverse geocoding:', error?.message || 'Unknown error');
      return null;
    }
  }

  /**
   * Get coordinates from an address using geocoding
   * @param address Address to geocode
   * @returns Coordinates or default Hong Kong coordinates if API key is not available
   */
  public async getCoordinatesFromAddress(address: string): Promise<{latitude: number, longitude: number}> {
    if (!this.googleMapsApiKey) {
      console.log('Cannot perform geocoding without Google Maps API key, using default coordinates');
      return this.defaultCoordinates;
    }

    try {
      // Enhanced error handling and detailed logging for debugging
      console.log(`Geocoding address: "${address}"`);
      
      // Always append "Hong Kong" to the address if not present to improve results
      const enhancedAddress = address.toLowerCase().includes('hong kong') ? 
        address : 
        address + ", Hong Kong";
        
      console.log(`Enhanced address for geocoding: "${enhancedAddress}"`);
      
      // Add retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      let response = null;
      
      while (attempts < maxAttempts) {
        try {
          response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`, {
              params: {
                address: enhancedAddress,
                key: this.googleMapsApiKey,
                region: 'hk', // Region biasing to Hong Kong
                language: 'en' // Ensure responses are in English
              },
              timeout: 5000 // 5 second timeout
            }
          );
          
          // Check response and break the loop if successful
          if (response.data.status === 'OK' && response.data.results.length > 0) {
            console.log(`Geocoding successful for "${enhancedAddress}". Status: ${response.data.status}`);
            break;
          } else {
            console.warn(`Geocoding attempt ${attempts + 1} failed. Status: ${response?.data?.status || 'Unknown'}`);
            
            // Only retry on certain error types
            if (response?.data?.status === 'OVER_QUERY_LIMIT' || 
                response?.data?.status === 'UNKNOWN_ERROR' ||
                !response) {
              attempts++;
              // Exponential backoff: 1s, 2s, 4s
              await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
            } else {
              // For other status codes like ZERO_RESULTS, don't retry
              break;
            }
          }
        } catch (retryError: any) {
          console.error(`Geocoding attempt ${attempts + 1} error:`, retryError?.message || 'Unknown error');
          attempts++;
          if (attempts < maxAttempts) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
          }
        }
      }

      // Process response
      if (response && response.data.status === 'OK' && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        console.log(`Found coordinates for "${enhancedAddress}": ${location.lat}, ${location.lng}`);
        return {
          latitude: location.lat,
          longitude: location.lng
        };
      }
      
      console.warn(`No valid geocoding results for "${enhancedAddress}" after ${attempts + 1} attempts. Using default coordinates.`);
      return this.defaultCoordinates;
    } catch (error: any) {
      console.error('Error in geocoding:', error?.message || 'Unknown error');
      return this.defaultCoordinates;
    }
  }

  /**
   * Calculate great-circle distance between two points using the Haversine formula
   * @param lat1 Latitude of first point
   * @param lon1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lon2 Longitude of second point
   * @returns Distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  /**
   * Get estimated travel time between two points using Google Maps Distance Matrix API
   * @param startLat Starting latitude
   * @param startLng Starting longitude
   * @param endLat Ending latitude
   * @param endLng Ending longitude
   * @param mode Travel mode (driving, walking, bicycling, transit)
   * @returns Estimated travel time in seconds or null if API key is not available
   */
  public async getTravelTime(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number,
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'walking'
  ): Promise<number | null> {
    if (!this.googleMapsApiKey) {
      console.log('Cannot calculate travel time without Google Maps API key');
      // Fallback to straight-line distance with estimated speed
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
      const speeds = {
        driving: 40, // km/h
        walking: 5,  // km/h
        bicycling: 15, // km/h
        transit: 25  // km/h
      };
      
      // Convert m to km, divide by speed in km/h, multiply by 3600 to get seconds
      return (distance / 1000) / speeds[mode] * 3600;
    }

    try {
      // Enhanced error handling and detailed logging for debugging
      console.log(`Calculating travel time from ${startLat},${startLng} to ${endLat},${endLng} via ${mode}`);
      
      // Add retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      let response = null;
      
      while (attempts < maxAttempts) {
        try {
          response = await axios.get(
            `https://maps.googleapis.com/maps/api/distancematrix/json`, {
              params: {
                origins: `${startLat},${startLng}`,
                destinations: `${endLat},${endLng}`,
                mode: mode,
                key: this.googleMapsApiKey,
                region: 'hk', // Region biasing to Hong Kong
                language: 'en' // Ensure responses are in English
              },
              timeout: 5000 // 5 second timeout
            }
          );
          
          // Check response and break the loop if successful
          if (
            response.data.status === 'OK' && 
            response.data.rows.length > 0 && 
            response.data.rows[0].elements.length > 0 &&
            response.data.rows[0].elements[0].status === 'OK'
          ) {
            console.log(`Distance matrix calculation successful for ${startLat},${startLng} to ${endLat},${endLng}. Status: ${response.data.status}`);
            break;
          } else {
            console.warn(`Distance matrix attempt ${attempts + 1} failed. Status: ${response?.data?.status || 'Unknown'}, Element status: ${response?.data?.rows?.[0]?.elements?.[0]?.status || 'Unknown'}`);
            
            // Only retry on certain error types
            if (response?.data?.status === 'OVER_QUERY_LIMIT' || 
                response?.data?.status === 'UNKNOWN_ERROR' ||
                !response) {
              attempts++;
              // Exponential backoff: 1s, 2s, 4s
              await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
            } else {
              // For other status codes like ZERO_RESULTS, don't retry
              break;
            }
          }
        } catch (retryError: any) {
          console.error(`Distance matrix attempt ${attempts + 1} error:`, retryError?.message || 'Unknown error');
          attempts++;
          if (attempts < maxAttempts) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
          }
        }
      }
      
      // Process response
      if (
        response && 
        response.data.status === 'OK' && 
        response.data.rows.length > 0 && 
        response.data.rows[0].elements.length > 0 &&
        response.data.rows[0].elements[0].status === 'OK'
      ) {
        const duration = response.data.rows[0].elements[0].duration.value;
        console.log(`Found travel time: ${duration} seconds (${Math.round(duration / 60)} minutes) from ${startLat},${startLng} to ${endLat},${endLng} via ${mode}`);
        return duration; // Duration in seconds
      }
      
      // Fallback to distance-based calculation if API failed
      console.warn(`No valid distance matrix results after ${attempts + 1} attempts. Using distance-based estimate.`);
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
      const speeds = {
        driving: 40, // km/h
        walking: 5,  // km/h
        bicycling: 15, // km/h
        transit: 25  // km/h
      };
      
      // Convert m to km, divide by speed in km/h, multiply by 3600 to get seconds
      return (distance / 1000) / speeds[mode] * 3600;
    } catch (error: any) {
      console.error('Error in travel time calculation:', error?.message || 'Unknown error');
      
      // Fallback to distance-based calculation
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
      const speeds = {
        driving: 40, // km/h
        walking: 5,  // km/h
        bicycling: 15, // km/h
        transit: 25  // km/h
      };
      
      // Convert m to km, divide by speed in km/h, multiply by 3600 to get seconds
      return (distance / 1000) / speeds[mode] * 3600;
    }
  }

  /**
   * Generate a static map image URL for a location with enhanced validation and error handling
   * @param latitude Latitude for the map center
   * @param longitude Longitude for the map center
   * @param zoom Zoom level (1-20)
   * @param width Image width in pixels (max 640)
   * @param height Image height in pixels (max 640)
   * @param markers Array of markers to add to the map
   * @param mapType Type of map to display - roadmap, satellite, hybrid, or terrain
   * @param scale Scale factor for the image (1 = standard, 2 = high resolution for retina displays)
   * @returns URL for the static map image or null if API key is not available
   */
  public getStaticMapUrl(
    latitude: number, 
    longitude: number, 
    zoom: number = 15, 
    width: number = 600, 
    height: number = 300,
    markers: Array<{lat: number, lng: number, color?: string, label?: string}> = [],
    mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain' = 'roadmap',
    scale: 1 | 2 = 1
  ): string | null {
    if (!this.googleMapsApiKey) {
      console.log('Cannot generate static map without Google Maps API key');
      return null;
    }
    
    try {
      // Validate inputs to prevent API errors
      const validatedLatitude = latitude ? Math.max(-90, Math.min(90, latitude)) : this.defaultCoordinates.latitude;
      const validatedLongitude = longitude ? Math.max(-180, Math.min(180, longitude)) : this.defaultCoordinates.longitude;
      const validatedZoom = Math.max(1, Math.min(20, zoom));
      const validatedWidth = Math.max(1, Math.min(640, width)); // Google Static Maps API limit
      const validatedHeight = Math.max(1, Math.min(640, height)); // Google Static Maps API limit
      
      // Build the base URL
      let url = `https://maps.googleapis.com/maps/api/staticmap?center=${validatedLatitude},${validatedLongitude}&zoom=${validatedZoom}&size=${validatedWidth}x${validatedHeight}&maptype=${mapType}&scale=${scale}`;
      
      // Add the primary marker if no markers were specified
      if (markers.length === 0) {
        url += `&markers=color:red%7C${validatedLatitude},${validatedLongitude}`;
      }
      
      // Add all the specified markers (with validation)
      for (const marker of markers) {
        // Validate marker coordinates
        const markerLat = marker.lat ? Math.max(-90, Math.min(90, marker.lat)) : validatedLatitude;
        const markerLng = marker.lng ? Math.max(-180, Math.min(180, marker.lng)) : validatedLongitude;
        
        const color = marker.color || 'red';
        const label = marker.label ? `label:${marker.label.charAt(0)}%7C` : ''; // Ensure label is a single character
        url += `&markers=color:${color}%7C${label}${markerLat},${markerLng}`;
      }
      
      // Add the API key and return the complete URL
      url += `&key=${this.googleMapsApiKey}`;
      
      // Ensure URL doesn't exceed length limits
      if (url.length > 8192) {
        console.warn(`Static map URL exceeds Google's 8192 character limit (${url.length} chars). Simplifying.`);
        // Simplify by removing excessive markers
        const simpleUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${validatedLatitude},${validatedLongitude}&zoom=${validatedZoom}&size=${validatedWidth}x${validatedHeight}&maptype=${mapType}&scale=${scale}&markers=color:red%7C${validatedLatitude},${validatedLongitude}&key=${this.googleMapsApiKey}`;
        return simpleUrl;
      }
      
      console.log(`Generated static map URL for coordinates: ${validatedLatitude}, ${validatedLongitude} with ${markers.length} markers`);
      
      return url;
    } catch (error: any) {
      console.error('Error generating static map URL:', error?.message || 'Unknown error');
      
      // Fallback to simple and robust URL generation on error
      try {
        return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&markers=color:red%7C${latitude},${longitude}&key=${this.googleMapsApiKey}`;
      } catch (fallbackError) {
        // Last resort fallback with default values
        console.error('Error in static map URL fallback, using default values');
        return `https://maps.googleapis.com/maps/api/staticmap?center=${this.defaultCoordinates.latitude},${this.defaultCoordinates.longitude}&zoom=10&size=600x300&key=${this.googleMapsApiKey}`;
      }
    }
  }
}

export const mapService = new MapService();