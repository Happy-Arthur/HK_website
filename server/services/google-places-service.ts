import axios from 'axios';
import { mapService } from './map-service';

/**
 * Service to fetch external facilities using the Google Places API
 */
export class GooglePlacesService {
  private googleMapsApiKey: string | undefined;
  private useMockData: boolean = false;

  constructor() {
    // Try to get API key from either GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!this.googleMapsApiKey) {
      console.warn('Google Maps API key not found in environment variables. Using mock data instead.');
      this.useMockData = true;
    } else {
      console.log('Google Maps API key found, will use Google Places for facility search');
    }
  }

  /**
   * Search for external facilities using Google Places API
   * @param type Sport type to search for (optional)
   * @param district District to search in (optional)
   * @returns Array of facilities
   */
  async searchExternalFacilities(type: string, district: string): Promise<any[]> {
    console.log(`Searching for external facilities with type: ${type}, district: ${district}`);
    
    if (this.useMockData) {
      console.log('Using mock data for facilities search (Google Maps API key not found)');
      return this.getMockFacilities(type, district);
    }
    
    try {
      // Build query based on filters
      let query = 'sports facilities in Hong Kong';
      
      if (type && district) {
        query = `${type} facilities in ${district}, Hong Kong`;
      } else if (type) {
        query = `${type} facilities in Hong Kong`;
      } else if (district) {
        query = `sports facilities in ${district}, Hong Kong`;
      }
      
      console.log(`Making Google Places API request with query: "${query}"`);
      
      // Determine lat/lng for the district, or use Hong Kong center
      let lat = 22.3193;  // Default Hong Kong latitude
      let lng = 114.1694; // Default Hong Kong longitude
      
      // If district specified, get coordinates for it
      if (district) {
        try {
          const coordinates = await mapService.getCoordinatesFromAddress(`${district}, Hong Kong`);
          lat = coordinates.latitude;
          lng = coordinates.longitude;
          console.log(`Using coordinates for district ${district}: ${lat}, ${lng}`);
        } catch (error) {
          console.warn(`Could not get coordinates for district ${district}, using Hong Kong center`);
        }
      }
      
      // Add retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = 3;
      let response = null;
      
      while (attempts < maxAttempts) {
        try {
          // Use the Google Places Text Search API
          response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/textsearch/json`, {
              params: {
                query: query,
                location: `${lat},${lng}`,
                radius: 50000, // 50km radius (all of Hong Kong)
                type: 'stadium|gym|park|sports_complex',
                key: this.googleMapsApiKey,
                region: 'hk', // Region biasing to Hong Kong
                language: 'en' // Ensure responses are in English
              },
              timeout: 5000 // 5 second timeout
            }
          );
          
          // Check response and break the loop if successful
          if (response.data.status === 'OK' && response.data.results.length > 0) {
            console.log(`Google Places API search successful. Status: ${response.data.status}, found ${response.data.results.length} results`);
            break;
          } else {
            console.warn(`Google Places API search attempt ${attempts + 1} failed. Status: ${response?.data?.status || 'Unknown'}`);
            
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
          console.error(`Google Places API attempt ${attempts + 1} error:`, retryError?.message || 'Unknown error');
          attempts++;
          if (attempts < maxAttempts) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 500));
          }
        }
      }
      
      // Process the response
      if (response && response.data.status === 'OK' && response.data.results.length > 0) {
        const facilities = this.processGooglePlacesResults(response.data.results, type);
        console.log(`Found ${facilities.length} facilities from Google Places API`);
        return facilities;
      }
      
      console.warn(`No valid Google Places API results after ${attempts + 1} attempts.`);
      return [];
    } catch (error) {
      console.error('Error calling Google Places API for facilities search:', error);
      console.log('Falling back to mock data');
      return this.getMockFacilities(type, district);
    }
  }
  
  /**
   * Process Google Places API results into facility format
   */
  private processGooglePlacesResults(results: any[], defaultType: string): any[] {
    const facilities = [];
    
    for (const place of results) {
      // Skip places without proper location data
      if (!place.geometry || !place.geometry.location) continue;
      
      // Map place types to sport types
      const sportType = this.mapPlaceTypeToSportType(place.types, defaultType);
      
      // Map vicinity to district
      const district = this.mapVicinityToDistrict(place.vicinity || place.formatted_address || '');
      
      // Create a facility object
      const facility = {
        name: place.name,
        address: place.vicinity || place.formatted_address || '',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        type: sportType,
        district: district,
        rating: place.rating || null,
        imageUrl: place.photos && place.photos.length > 0 
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${this.googleMapsApiKey}`
          : null,
        searchSource: 'google_places',
        googlePlaceId: place.place_id,
        approvalStatus: 'pending'
      };
      
      facilities.push(facility);
    }
    
    return facilities;
  }
  
  /**
   * Map Google Places types to sport types
   */
  private mapPlaceTypeToSportType(types: string[], defaultType: string): string {
    // If a specific sport type was requested, use it
    if (defaultType && defaultType !== 'all') {
      return defaultType;
    }
    
    // Map Google Places types to our sport types
    if (types.includes('stadium')) return 'soccer';
    if (types.includes('tennis_court')) return 'tennis';
    if (types.includes('gym')) return 'fitness';
    if (types.includes('swimming_pool')) return 'swimming';
    if (types.includes('park')) return 'basketball'; // Many parks have basketball courts
    
    // Default to other
    return 'other';
  }
  
  /**
   * Map vicinity/address to Hong Kong district
   */
  private mapVicinityToDistrict(vicinity: string): string {
    const districtKeywords: Record<string, string> = {
      "central": "central",
      "wan chai": "wanchai",
      "causeway bay": "wanchai",
      "north point": "eastern",
      "quarry bay": "eastern",
      "eastern": "eastern",
      "chai wan": "eastern",
      "southern": "southern",
      "aberdeen": "southern",
      "kennedy town": "western",
      "sheung wan": "western",
      "western": "western",
      "kowloon": "kowloon_city",
      "mongkok": "yau_tsim_mong",
      "tsim sha tsui": "yau_tsim_mong",
      "yau ma tei": "yau_tsim_mong",
      "sham shui po": "sham_shui_po",
      "wong tai sin": "wong_tai_sin",
      "diamond hill": "wong_tai_sin",
      "kwun tong": "kwun_tong",
      "ngau tau kok": "kwun_tong",
      "yau tong": "kwun_tong",
      "sha tin": "sha_tin",
      "tai wai": "sha_tin",
      "tai po": "tai_po",
      "fanling": "north",
      "sheung shui": "north",
      "north": "north",
      "tuen mun": "tuen_mun",
      "yuen long": "yuen_long",
      "tin shui wai": "yuen_long",
      "tsuen wan": "tsuen_wan",
      "kwai chung": "kwai_tsing",
      "tsing yi": "kwai_tsing",
      "islands": "islands",
      "lantau": "islands",
      "cheung chau": "islands",
      "lamma": "islands",
      "sai kung": "sai_kung",
      "clear water bay": "sai_kung",
      "tseung kwan o": "sai_kung"
    };
    
    const lowerVicinity = vicinity.toLowerCase();
    for (const [keyword, district] of Object.entries(districtKeywords)) {
      if (lowerVicinity.includes(keyword)) {
        return district;
      }
    }
    
    // Default to central if no match
    return "central";
  }
  
  /**
   * Generate mock facilities for testing
   */
  private getMockFacilities(type: string, district: string): any[] {
    console.log('Generating mock facilities data for type:', type, 'district:', district);
    
    // Basic mock data with a few sample facilities
    const mockFacilities = [
      {
        name: "Victoria Park Sports Center",
        address: "1 Hing Fat Street, Causeway Bay",
        latitude: 22.2846,
        longitude: 114.1881,
        type: "basketball",
        district: "wanchai",
        rating: 4.5,
        imageUrl: null,
        searchSource: "mock_data",
        approvalStatus: "pending"
      },
      {
        name: "Kowloon Park Sports Center",
        address: "22 Austin Road, Tsim Sha Tsui",
        latitude: 22.3004,
        longitude: 114.1707,
        type: "swimming",
        district: "yau_tsim_mong",
        rating: 4.2,
        imageUrl: null,
        searchSource: "mock_data",
        approvalStatus: "pending"
      },
      {
        name: "Tuen Mun Sports Ground",
        address: "Tuen Mun, New Territories",
        latitude: 22.3918,
        longitude: 113.9725,
        type: "soccer",
        district: "tuen_mun",
        rating: 4.0,
        imageUrl: null,
        searchSource: "mock_data",
        approvalStatus: "pending"
      }
    ];
    
    // Filter by type if specified
    let filtered = mockFacilities;
    if (type && type !== 'all') {
      filtered = filtered.filter(f => f.type === type);
    }
    
    // Filter by district if specified
    if (district && district !== 'all') {
      filtered = filtered.filter(f => f.district === district);
    }
    
    return filtered;
  }
}

export const googlePlacesService = new GooglePlacesService();