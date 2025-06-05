import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Facility, Event, InsertFacility, facilityTypes, districts } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Locate, Plus, Search, Map } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";

interface GoogleMapViewProps {
  facilities: Facility[];
  selectedFacilityId: number;
  onSelectFacility: (id: number) => void;
  filterType?: string;
  filterDistrict?: string;
  events?: Event[];
  showEvents?: boolean;
}

export default function GoogleMapView({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  filterType,
  filterDistrict,
  events = [],
  showEvents = false,
}: GoogleMapViewProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Determine center point for the map (Hong Kong by default or selected facility)
  const [mapCenter, setMapCenter] = useState({
    lat: 22.302711,
    lng: 114.177216,
    zoom: 12
  });
  
  // State for the add facility dialog
  const [isAddFacilityOpen, setIsAddFacilityOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newFacility, setNewFacility] = useState<{
    name: string;
    type: string;
    district: string;
    address: string;
    latitude: number;
    longitude: number;
  }>({
    name: "",
    type: "basketball", // Default type
    district: "central", // Default district
    address: "",
    latitude: mapCenter.lat,
    longitude: mapCenter.lng
  });
  
  // Filter facilities based on type and district
  const filteredFacilities = facilities.filter((facility) => {
    if (filterType && filterType !== "all" && facility.type !== filterType) {
      return false;
    }
    if (filterDistrict && filterDistrict !== "all" && facility.district !== filterDistrict) {
      return false;
    }
    return true;
  });

  // Query to get more details about the selected facility
  const selectedFacilityQuery = useQuery<Facility>({
    queryKey: ["/api/facilities", selectedFacilityId],
    enabled: !!selectedFacilityId,
  });

  // Update center when selected facility changes
  useEffect(() => {
    if (selectedFacilityId && selectedFacilityQuery.data) {
      const facility = selectedFacilityQuery.data;
      if (facility.latitude && facility.longitude) {
        setMapCenter({
          lat: facility.latitude,
          lng: facility.longitude,
          zoom: 16
        });
      }
    } else if (selectedFacilityId) {
      // If detailed query hasn't loaded yet, try to find in facilities list
      const facilityFromList = facilities.find(f => f.id === selectedFacilityId);
      if (facilityFromList?.latitude && facilityFromList?.longitude) {
        setMapCenter({
          lat: facilityFromList.latitude,
          lng: facilityFromList.longitude,
          zoom: 16
        });
      }
    }
  }, [selectedFacilityId, selectedFacilityQuery.data, facilities]);

  // Check if we have a valid Google Maps API key
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  
  useEffect(() => {
    // Check if the API key is available
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("Google Maps API key is missing. Some features will be limited.");
      setApiKeyMissing(true);
    }
  }, []);

  // Generate map URL based on the current state
  const getMapUrl = () => {
    // Get API key from environment variables
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    // If showing a specific location, change to place mode
    if (selectedFacilityId !== 0 && selectedFacilityQuery.data) {
      const facility = selectedFacilityQuery.data;
      if (facility.name && facility.latitude && facility.longitude) {
        // Use place mode for better highlighting with the exact coordinates
        // Use a marker for better visibility
        let url = `https://www.google.com/maps/embed/v1/place?key=${apiKey}`;
        // Add marker explicitly in the query with the facility name
        url += `&q=${encodeURIComponent(facility.name)}@${facility.latitude},${facility.longitude}`;
        url += `&zoom=16`;
        return url;
      }
    } else if (showEvents && events.length > 0) {
      // For events view, show the event location
      const event = events[0];
      if (event.facilityId) {
        const facilityForEvent = filteredFacilities.find(f => f.id === event.facilityId);
        if (facilityForEvent && facilityForEvent.latitude && facilityForEvent.longitude) {
          let url = `https://www.google.com/maps/embed/v1/place?key=${apiKey}`;
          // Add a named marker for better visibility
          url += `&q=${encodeURIComponent(event.name)}@${facilityForEvent.latitude},${facilityForEvent.longitude}`;
          url += `&zoom=16`;
          return url;
        }
      }
    }
    
    // Default case: Show all facilities with markers
    // For this we need to use the "view" mode with custom markers
    let baseUrl = `https://www.google.com/maps/embed/v1/view?key=${apiKey}`;
    
    // Add center coordinates and zoom
    baseUrl += `&center=${mapCenter.lat},${mapCenter.lng}&zoom=${mapCenter.zoom}`;
    
    // Add map type (roadmap is default)
    baseUrl += "&maptype=roadmap";
    
    // For facilities display, we'll load our facilities plus nearby Google Places
    // We'll use search mode since view with markers isn't supported by embed API
    let searchUrl = `https://www.google.com/maps/embed/v1/search?key=${apiKey}`;
    
    // Add search query for sports facilities in Hong Kong
    let searchTerm = "sports facilities in Hong Kong";
    if (filterType && filterType !== "all") {
      searchTerm = `${filterType} courts in Hong Kong`;
    }
    
    // Include district if selected
    if (filterDistrict && filterDistrict !== "all") {
      // Format district name for search
      const districtName = filterDistrict
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      searchTerm += ` in ${districtName}, Hong Kong`;
    }
    
    searchUrl += `&q=${encodeURIComponent(searchTerm)}`;
    
    // Set the map center to Hong Kong
    searchUrl += `&center=${mapCenter.lat},${mapCenter.lng}&zoom=${mapCenter.zoom}`;
    
    // Use search mode for best results with facility discovery
    return searchUrl;
  };
  
  // Call loadNearbyFacilities when map loads
  useEffect(() => {
    if (mapLoaded && !selectedFacilityId && !showEvents) {
      loadNearbyFacilities();
    }
  }, [mapLoaded, filterType, filterDistrict, mapCenter]);

  // Handle getting the user's current location
  const handleUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter({
            lat: latitude,
            lng: longitude,
            zoom: 16
          });
          
          // Update the new facility coordinates
          setNewFacility(prev => ({
            ...prev,
            latitude,
            longitude
          }));
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };
  
  // Automatically load nearby facilities on map load
  const loadNearbyFacilities = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    // If we have a selected facility type, use that for searching
    let searchTerm = "sports facilities in Hong Kong";
    if (filterType && filterType !== "all") {
      searchTerm = `${filterType} courts in Hong Kong`;
    }
    
    // Include district if selected
    if (filterDistrict && filterDistrict !== "all") {
      // Format district name for search
      const districtName = filterDistrict
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      searchTerm += ` in ${districtName}, Hong Kong`;
    }
    
    // Update the iframe URL for nearby places
    if (iframeRef.current) {
      iframeRef.current.src = `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(searchTerm)}&center=${mapCenter.lat},${mapCenter.lng}&zoom=${mapCenter.zoom}`;
    }
  };
  
  // Listen for messages from the iframe (not supported by embed API, but prepared for future enhancement)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // This will only work if Google Maps API starts supporting postMessage
      if (event.data && event.data.type === 'mapPin') {
        const { name, latitude, longitude, address } = event.data;
        setNewFacility(prev => ({
          ...prev,
          name: name || prev.name,
          address: address || prev.address,
          latitude: latitude || prev.latitude,
          longitude: longitude || prev.longitude
        }));
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // Create facility mutation
  const createFacilityMutation = useMutation({
    mutationFn: async (facility: InsertFacility) => {
      const response = await apiRequest("POST", "/api/facilities", facility);
      if (!response.ok) {
        throw new Error("Failed to create new facility");
      }
      return await response.json();
    },
    onSuccess: (newFacility) => {
      // Update the facilities list
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      
      // Show success message
      toast({
        title: "Success!",
        description: `${newFacility.name} has been added to our database.`,
      });
      
      // Close the dialog
      setIsAddFacilityOpen(false);
      
      // Select the new facility if it was successfully created
      if (newFacility && newFacility.id) {
        onSelectFacility(newFacility.id);
      }
    },
    onError: (error) => {
      console.error("Error creating facility:", error);
      toast({
        title: "Error",
        description: "Failed to add facility. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle add facility form submission
  const handleAddFacility = () => {
    // Form validation
    if (!newFacility.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Facility name is required",
        variant: "destructive",
      });
      return;
    }
    
    // Create the facility
    createFacilityMutation.mutate({
      name: newFacility.name,
      type: newFacility.type,
      district: newFacility.district,
      address: newFacility.address,
      latitude: newFacility.latitude,
      longitude: newFacility.longitude,
      // Add other required fields with default values
      openTime: null,
      closeTime: null,
      contactPhone: null,
      courts: null,
      description: null,
      amenities: null,
      imageUrl: null,
      approvalStatus: "pending"
    } as InsertFacility);
  };

  // Facility selection from map is not directly possible with the embed,
  // so we'll provide a list of clickable facilities below the map on mobile
  const renderFacilitiesList = () => {
    if (filteredFacilities.length === 0) return null;
    
    return (
      <div className="mt-3 space-y-2 md:hidden overflow-x-auto">
        <h3 className="font-medium text-sm">Nearby Facilities:</h3>
        <div className="flex gap-2 pb-2 overflow-x-auto">
          {filteredFacilities.slice(0, 5).map(facility => (
            <Card 
              key={facility.id}
              className={`p-2 cursor-pointer min-w-[160px] ${selectedFacilityId === facility.id ? 'bg-primary/10 border-primary' : ''}`}
              onClick={() => onSelectFacility(facility.id)}
            >
              <div className="text-sm font-medium truncate">{facility.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{facility.type}</div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-full w-full" style={{ minHeight: "calc(100vh - 200px)" }}>
      {apiKeyMissing ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 p-6">
          <div className="max-w-md text-center">
            <h3 className="text-lg font-bold mb-2">Google Maps API Key Required</h3>
            <p className="mb-4">
              To enable the interactive map features, please add a Google Maps API key to your environment.
              You need to set the VITE_GOOGLE_MAPS_API_KEY environment variable.
            </p>
            <div className="text-left bg-gray-50 p-4 rounded-md mb-4 text-sm">
              <p className="font-medium mb-2">To obtain a Google Maps API key:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Go to the Google Cloud Console</li>
                <li>Create or select a project</li>
                <li>Enable the Maps Embed API</li>
                <li>Create an API key from the Credentials page</li>
              </ol>
            </div>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <a 
                href="https://developers.google.com/maps/documentation/embed/get-api-key" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Get API Key
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full absolute inset-0">
          <iframe
            ref={iframeRef}
            width="100%"
            height="100%"
            frameBorder="0"
            referrerPolicy="no-referrer-when-downgrade"
            src={getMapUrl()}
            allowFullScreen
            onLoad={() => setMapLoaded(true)}
          ></iframe>
        </div>
      )}

      {/* User Location Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 left-4 bg-white p-3 rounded-full shadow-lg z-50"
        onClick={handleUserLocation}
      >
        <Locate className="h-6 w-6 text-primary" />
      </Button>
      
      {/* Add Facility Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 left-16 bg-white p-3 rounded-full shadow-lg z-50"
        onClick={() => setIsAddFacilityOpen(true)}
      >
        <Plus className="h-6 w-6 text-primary" />
      </Button>
      
      {/* No longer need a separate search button */}
      
      {/* Facility quick select (mobile only) */}
      <div className="absolute bottom-16 left-0 right-0 px-4 z-40">
        {renderFacilitiesList()}
      </div>
      
      {/* Selected facility details */}
      {selectedFacilityId && selectedFacilityQuery.data && (
        <div className="absolute top-4 left-0 right-0 mx-auto z-50 p-2 flex justify-center pointer-events-none">
          <Card className="p-3 shadow-lg pointer-events-auto max-w-xs w-full">
            <div className="flex justify-between">
              <h3 className="font-bold text-sm">{selectedFacilityQuery.data.name}</h3>
              <button 
                className="text-gray-500 text-sm"
                onClick={() => onSelectFacility(0)} // Use 0 instead of null to fix type error
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {selectedFacilityQuery.data.type} • {selectedFacilityQuery.data.district}
            </p>
          </Card>
        </div>
      )}
      
      {/* Add Facility Dialog */}
      <Dialog open={isAddFacilityOpen} onOpenChange={setIsAddFacilityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Facility</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              New facilities require admin approval before being published publicly.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Facility Name</Label>
              <Input
                id="name"
                value={newFacility.name}
                onChange={(e) => setNewFacility(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter facility name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="type">Facility Type</Label>
              <Select
                value={newFacility.type}
                onValueChange={(value) => setNewFacility(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {facilityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="district">District</Label>
              <Select
                value={newFacility.district}
                onValueChange={(value) => setNewFacility(prev => ({ ...prev, district: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={newFacility.address}
                onChange={(e) => setNewFacility(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter facility address"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.000001"
                  value={newFacility.latitude}
                  onChange={(e) => setNewFacility(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.000001"
                  value={newFacility.longitude}
                  onChange={(e) => setNewFacility(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleUserLocation}
                className="flex items-center gap-2"
              >
                <Locate className="h-4 w-4" />
                <span>Use My Location</span>
              </Button>
            </div>
          </div>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsAddFacilityOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddFacility}
              disabled={createFacilityMutation.isPending}
              className="flex items-center gap-2"
            >
              {createFacilityMutation.isPending ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              ) : null}
              Add Facility
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}