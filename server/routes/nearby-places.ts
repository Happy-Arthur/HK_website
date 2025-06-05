import { Request, Response, Router } from "express";
import axios from "axios";
import { approvalStatuses, type InsertFacility } from "@shared/schema";
import { storage } from "../storage";

// Log that Google Maps API key is available
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
if (apiKey) {
  console.log("Google Maps API key found, full location features available");
} else {
  console.warn("Google Maps API key not found, location features will be limited");
}

const router = Router();

interface GooglePlaceResult {
  business_status: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    viewport: {
      northeast: {
        lat: number;
        lng: number;
      };
      southwest: {
        lat: number;
        lng: number;
      };
    };
  };
  icon: string;
  icon_background_color: string;
  icon_mask_base_uri: string;
  name: string;
  photos?: {
    height: number;
    html_attributions: string[];
    photo_reference: string;
    width: number;
  }[];
  place_id: string;
  plus_code?: {
    compound_code: string;
    global_code: string;
  };
  rating?: number;
  reference: string;
  scope: string;
  types: string[];
  user_ratings_total?: number;
  vicinity: string;
}

interface GooglePlacesResponse {
  html_attributions: string[];
  next_page_token?: string;
  results: GooglePlaceResult[];
  status: string;
}

// Map Google Places types to our facility types
const mapPlaceTypeToFacilityType = (types: string[]): string => {
  if (types.includes("stadium")) return "soccer";
  if (types.includes("gym")) return "basketball";
  if (types.includes("tennis_court")) return "tennis";
  if (types.includes("swimming_pool")) return "swimming";
  if (types.includes("park")) return "basketball"; // Most parks have basketball courts
  return "other";
};

// Map Google Places vicinity to our district
const mapVicinityToDistrict = (vicinity: string): string => {
  const districtKeywords: Record<string, string> = {
    "central": "central",
    "wan chai": "wan_chai",
    "causeway bay": "wan_chai",
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

  return "central"; // Default district
};

// Function to check if a place exists in our database
async function placeExistsInDatabase(placeName: string, lat: number, lng: number): Promise<boolean> {
  // Get all facilities from the database
  const facilities = await storage.getFacilities();
  
  // Check if there's a facility with similar name and coordinates
  return facilities.some(facility => {
    // Check for name similarity
    const nameSimilarity = facility.name.toLowerCase().includes(placeName.toLowerCase()) ||
                          placeName.toLowerCase().includes(facility.name.toLowerCase());
    
    // Check for coordinate proximity (within ~100 meters)
    const coordProximity = facility.latitude && facility.longitude &&
                          Math.abs(facility.latitude - lat) < 0.001 &&
                          Math.abs(facility.longitude - lng) < 0.001;
    
    return nameSimilarity || coordProximity;
  });
}

// GET /api/nearby-places?lat=22.3&lng=114.1&type=basketball&radius=1000
router.get("/", async (req: Request, res: Response) => {
  try {
    const { lat, lng, type, radius = 1000 } = req.query;
    
    // Validate parameters
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }
    
    // Get the Google Maps API key from environment variables
    // Try both GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAPS_API_KEY since the client uses VITE_ prefix
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google Maps API key is not configured" });
    }
    
    // Build the search query
    let searchQuery = "sports facility";
    if (type && type !== "all") {
      searchQuery = `${type} court`;
    }
    
    // Make a request to the Google Places API
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
    
    const response = await axios.get<GooglePlacesResponse>(url);
    
    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", response.data);
      return res.status(500).json({ error: `Google Places API error: ${response.data.status}` });
    }
    
    // Process the results
    const places = await Promise.all(
      response.data.results.map(async (place) => {
        // Check if the place already exists in our database
        const exists = await placeExistsInDatabase(place.name, place.geometry.location.lat, place.geometry.location.lng);
        
        // Map Google Places data to our facility format
        return {
          id: place.place_id,
          name: place.name,
          type: mapPlaceTypeToFacilityType(place.types),
          district: mapVicinityToDistrict(place.vicinity),
          address: place.vicinity,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || null,
          imageUrl: place.photos?.[0]?.photo_reference ? 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}` : 
            null,
          existsInDatabase: exists,
          googlePlaceId: place.place_id
        };
      })
    );
    
    return res.json(places);
  } catch (error) {
    console.error("Error fetching nearby places:", error);
    return res.status(500).json({ error: "Failed to fetch nearby places" });
  }
});

// POST /api/nearby-places/add
router.post("/add", async (req: Request, res: Response) => {
  try {
    const { name, type, district, address, latitude, longitude, googlePlaceId } = req.body;
    
    // Validate required fields
    if (!name || !type || !district || !latitude || !longitude) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Create the facility
    const facility: InsertFacility = {
      name,
      type,
      district,
      address: address || "",
      latitude,
      longitude,
      openTime: null,
      closeTime: null,
      contactPhone: null,
      courts: null,
      description: null,
      amenities: null,
      imageUrl: null,
      approvalStatus: "pending",
      searchSource: "google_places"
    };
    
    // Save the facility to the database
    const savedFacility = await storage.createFacility(facility);
    
    return res.status(201).json(savedFacility);
  } catch (error) {
    console.error("Error adding facility from place:", error);
    return res.status(500).json({ error: "Failed to add facility" });
  }
});

// GET /api/nearby-places/search - Text search for places (for map search box)
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { query, lat, lng, radius = 5000 } = req.query;
    
    // Validate required parameters
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    // Validate coordinates
    const latitude = lat ? parseFloat(lat as string) : 22.28; // Default to Hong Kong center
    const longitude = lng ? parseFloat(lng as string) : 114.15;
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }
    
    // Get API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google Maps API key is not configured" });
    }
    
    // Make request to Google Places Text Search API
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query as string)}&location=${latitude},${longitude}&radius=${radius}&key=${apiKey}`;
    
    const response = await axios.get<GooglePlacesResponse>(url);
    
    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", response.data);
      return res.status(500).json({ error: `Google Places API error: ${response.data.status}` });
    }
    
    // Process results
    const places = await Promise.all(
      response.data.results.map(async (place) => {
        // Check if the place already exists in our database
        const exists = await placeExistsInDatabase(
          place.name, 
          place.geometry.location.lat, 
          place.geometry.location.lng
        );
        
        // Enhanced place result with details relevant to our app
        return {
          id: place.place_id,
          name: place.name,
          type: mapPlaceTypeToFacilityType(place.types),
          vicinity: place.vicinity || "",
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || null,
          types: place.types,
          existsInDatabase: exists,
          imageUrl: place.photos?.[0]?.photo_reference ? 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}` : 
            null
        };
      })
    );
    
    return res.json(places);
  } catch (error) {
    console.error("Error searching places:", error);
    return res.status(500).json({ error: "Failed to search places" });
  }
});

export default router;