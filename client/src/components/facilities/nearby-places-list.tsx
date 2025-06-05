import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Facility } from "@shared/schema";
import FacilityCard from "./facility-card";
import { Loader2, MapPin, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Define a type for Google Places API result
interface GooglePlace {
  id: string;
  name: string;
  type: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  imageUrl: string | null;
  existsInDatabase: boolean;
  googlePlaceId: string;
}

interface NearbyPlacesListProps {
  latitude: number;
  longitude: number;
  type?: string;
  radius?: number;
  onSelectFacility: (id: number) => void;
  facilityList: Facility[];
}

export default function NearbyPlacesList({ 
  latitude, 
  longitude, 
  type = "all", 
  radius = 5000,
  onSelectFacility,
  facilityList
}: NearbyPlacesListProps) {
  // Get current user to check for admin status
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;
  
  // Store the places we get from the API
  const [combinedPlaces, setCombinedPlaces] = useState<(GooglePlace | Facility)[]>([]);
  
  // Query for nearby places from Google Places API
  const nearbyPlacesQuery = useQuery<GooglePlace[]>({
    queryKey: ["/api/nearby-places", { lat: latitude, lng: longitude, type, radius }],
    enabled: !!latitude && !!longitude,
    staleTime: 60000, // Cache for 1 minute
  });
  
  // Mutation for adding a new facility from Google Places
  const addFacilityMutation = useMutation({
    mutationFn: async (place: GooglePlace) => {
      const response = await apiRequest("POST", "/api/nearby-places/add", {
        name: place.name,
        type: place.type,
        district: place.district,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        googlePlaceId: place.googlePlaceId
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add facility");
      }
      
      return await response.json();
    },
    onSuccess: (newFacility: Facility) => {
      // Update queries
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      toast({
        title: "Facility Added",
        description: `${newFacility.name} has been added for admin approval.`,
      });
      
      // Select the newly added facility
      onSelectFacility(newFacility.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add facility",
        variant: "destructive",
      });
    }
  });
  
  // Combine our database facilities with Google Places
  useEffect(() => {
    // Start with our database facilities
    let combined: (Facility | GooglePlace)[] = [...facilityList];
    
    // Add Google Places results that are not already in our database
    if (nearbyPlacesQuery.data) {
      const googlePlaces = nearbyPlacesQuery.data.filter(place => !place.existsInDatabase);
      combined = [...combined, ...googlePlaces];
    }
    
    // Sort by name
    combined.sort((a, b) => a.name.localeCompare(b.name));
    
    setCombinedPlaces(combined);
  }, [facilityList, nearbyPlacesQuery.data]);
  
  // Handle adding a facility from Google Places
  const handleAddFacility = (place: GooglePlace) => {
    addFacilityMutation.mutate(place);
  };
  
  if (nearbyPlacesQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (combinedPlaces.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <MapPin className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No facilities found nearby</h3>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
      </div>
    );
  }
  
  return (
    <div className="flex-1">
      {combinedPlaces.map((place) => {
        // Check if it's a Google Place or a database facility
        const isGooglePlace = 'googlePlaceId' in place;
        
        if (isGooglePlace) {
          // For Google Places, create a card with an Add button
          const googlePlace = place as GooglePlace;
          return (
            <div key={googlePlace.id} className="relative">
              <FacilityCard 
                facility={{
                  id: -1, // Use -1 as a special ID for Google Places (not in DB)
                  name: googlePlace.name,
                  type: googlePlace.type,
                  district: googlePlace.district,
                  address: googlePlace.address,
                  latitude: googlePlace.latitude,
                  longitude: googlePlace.longitude,
                  description: null,
                  openTime: null,
                  closeTime: null,
                  courts: null,
                  contactPhone: null,
                  amenities: null,
                  imageUrl: googlePlace.imageUrl,
                  approvalStatus: "pending"
                } as Facility}
                // For Google Places, clicking anywhere on the card should add the place
                onClick={(e) => {
                  e.preventDefault();
                  // Show a toast to inform the user they need to use the "Add" button
                  toast({
                    title: "Google Places Location",
                    description: "Use the Add button to add this location to our database.",
                    variant: "default"
                  });
                }}
              />
              <div className="absolute top-2 right-2 z-10">
                {isAdmin ? (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className="bg-white hover:bg-primary/10"
                    onClick={() => handleAddFacility(googlePlace)}
                    disabled={addFacilityMutation.isPending}
                  >
                    {addFacilityMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Add
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className="bg-muted/80 cursor-not-allowed"
                    disabled={true}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Admin Only
                  </Button>
                )}
              </div>
              <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-br-md">
                Google Places
              </div>
            </div>
          );
        } else {
          // For database facilities, render the normal card
          const facility = place as Facility;
          return (
            <FacilityCard 
              key={facility.id}
              facility={facility}
              onClick={() => onSelectFacility(facility.id)}
            />
          );
        }
      })}
    </div>
  );
}