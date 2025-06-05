import React, { useEffect, useRef, useState } from "react";
import { Locate, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Facility, Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { createCustomMarker } from "./custom-markers";
import { toast } from "@/hooks/use-toast";

// Declare the global L variable from Leaflet
declare global {
  interface Window {
    L: any;
  }
}

interface MapViewProps {
  facilities: Facility[];
  selectedFacilityId: number | null;
  onSelectFacility: (id: number) => void;
  filterType?: string;
  filterDistrict?: string;
  events?: Event[];
  groupEvents?: any[]; // Use any since group events may have additional properties
  showEvents?: boolean;
}

export default function MapView({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  filterType = "",
  filterDistrict = "all",
  events = [],
  groupEvents = [],
  showEvents = false,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [mapInitialized, setMapInitialized] = useState(false);
  // Add this ref to prevent map state changes during operations
  const shouldPreserveState = useRef(false);

  // Filter facilities based on type and district
  const filteredFacilities = React.useMemo(() => {
    console.log("Filtering facilities for map with:", {
      filterType,
      filterDistrict,
    });

    return facilities.filter((facility) => {
      // Filter by type if specified and not empty
      if (filterType && filterType !== "" && facility.type !== filterType) {
        return false;
      }

      // Filter by district if not "all"
      if (filterDistrict !== "all" && facility.district !== filterDistrict) {
        return false;
      }

      return true;
    });
  }, [facilities, filterType, filterDistrict]);

  useEffect(() => {
    console.log("Map received updated filters:", {
      filterType,
      filterDistrict,
    });

    // If we have markers already, update their visibility based on new filters
    if (markersRef.current.length > 0 && mapInstanceRef.current) {
      markersRef.current.forEach((marker) => {
        const markerFacility = facilities.find(
          (f) => f.id === marker.options.facilityId,
        );

        if (markerFacility) {
          // Check if this marker should be visible based on current filters
          const isVisible =
            (!filterType ||
              filterType === "" ||
              markerFacility.type === filterType) &&
            (filterDistrict === "all" ||
              markerFacility.district === filterDistrict);

          // Update marker visibility
          if (isVisible) {
            // Make sure it's on the map
            if (!mapInstanceRef.current.hasLayer(marker)) {
              marker.addTo(mapInstanceRef.current);
            }
          } else {
            // Remove from map if it doesn't match filters
            if (mapInstanceRef.current.hasLayer(marker)) {
              marker.remove();
            }
          }
        }
      });

      console.log("Updated marker visibility based on filters");
    }
  }, [filterType, filterDistrict]);

  const selectedFacilityQuery = useQuery<Facility>({
    queryKey: ["/api/facilities", selectedFacilityId],
    enabled: !!selectedFacilityId,
  });

  // Initialize the map - with performance optimization
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Add CSS to ensure map container takes full size before map initialization
    if (mapRef.current) {
      mapRef.current.style.height = "100%";
      mapRef.current.style.width = "100%";
      mapRef.current.style.position = "absolute";
      mapRef.current.style.top = "0";
      mapRef.current.style.left = "0";
      mapRef.current.style.right = "0";
      mapRef.current.style.bottom = "0";
      mapRef.current.style.zIndex = "1"; // Ensure map is visible
      mapRef.current.style.minHeight = "300px"; // Minimum height for mobile
    }

    // Delay map initialization slightly to ensure container is ready
    const initMap = () => {
      // Use the globally available L from Leaflet (included in index.html)
      const L = window.L;
      if (!L) {
        console.error(
          "Leaflet library not found. Make sure it's properly loaded.",
        );
        return;
      }

      // Initialize map with simpler settings for better compatibility
      const map = L.map(mapRef.current, {
        center: [22.283, 114.159], // Hong Kong center coordinates
        zoom: 12,
        attributionControl: false, // Remove attribution for cleaner UI
        scrollWheelZoom: true, // Enable scroll wheel zoom
        dragging: true, // Ensure dragging is enabled
        tap: true, // Enable tap for mobile
      });

      // Use OpenStreetMap tiles which are highly reliable
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Add zoom controls explicitly
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(map);

      // Store map instance in ref
      mapInstanceRef.current = map;

      // Forcefully invalidate size to ensure map is fully rendered and interactive
      map.invalidateSize();
      setTimeout(() => {
        map.invalidateSize();
        setMapInitialized(true);
        console.log("Map fully initialized and ready");
      }, 300);
    };

    // Small delay to ensure DOM is fully ready
    setTimeout(initMap, 100);

    // Clean up the map on unmount
    // Add window resize handler to ensure map fills container properly
    const handleResize = () => {
      if (mapInstanceRef.current) {
        console.log("Handling resize event - invalidating map size");
        mapInstanceRef.current.invalidateSize();
      }
    };

    // Listen for resize events
    window.addEventListener("resize", handleResize);

    // Create a mutation observer to detect DOM changes that might affect the map container size
    const observer = new MutationObserver((mutations) => {
      handleResize();
    });

    // Observe the parent container for size changes
    if (mapRef.current && mapRef.current.parentElement) {
      observer.observe(mapRef.current.parentElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
        childList: false,
        subtree: false,
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Clean up event listeners and observers
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, []);

  // Add facility markers with improved logging and error handling
  useEffect(() => {
    const map = mapInstanceRef.current;
    // Don't continue if basic prerequisites aren't met
    if (
      !map ||
      !mapInitialized ||
      !filteredFacilities ||
      filteredFacilities.length === 0
    ) {
      console.log("Skipping facility marker creation - prerequisites not met");
      return;
    }

    // Skip adding facility markers when in events tab, but don't clear existing markers
    if (showEvents) {
      console.log("In events tab - skipping facility marker creation");
      return;
    }

    // Use the globally available L from Leaflet
    const L = window.L;
    if (!L) {
      console.error("Leaflet library not available");
      return;
    }

    console.log(
      `Adding ${filteredFacilities.length} facility markers to map after filtering`,
    );

    // Clear previous markers
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch (err) {
        console.warn("Error removing marker:", err);
      }
    });
    markersRef.current = [];

    // Add new markers for filtered facilities
    filteredFacilities.forEach((facility) => {
      // Skip facilities with invalid coordinates or IDs
      if (
        !facility.id ||
        !facility.latitude ||
        !facility.longitude ||
        isNaN(facility.latitude) ||
        isNaN(facility.longitude)
      ) {
        console.warn(
          `Skipping facility ${facility.id || "unknown"} due to invalid data:`,
          facility.latitude,
          facility.longitude,
        );
        return;
      }

      try {
        // Log the facility data being used for this marker
        console.log(`Creating marker for facility ${facility.id}:`, {
          name: facility.name,
          type: facility.type,
          lat: facility.latitude,
          lng: facility.longitude,
        });

        // Create marker with proper type handling
        const markerIcon = createCustomMarker(facility.type || "unknown");

        const marker = L.marker([facility.latitude, facility.longitude], {
          icon: markerIcon,
          facilityId: facility.id, // Store facility ID on the marker object
        }).addTo(map);

        // Create better popup content with more information
        marker.bindPopup(`
          <div class="text-center p-1">
            <h3 class="font-bold">${facility.name || "Unknown Facility"}</h3>
            <p class="text-xs capitalize">${facility.type || "facility"}</p>
            <span class="text-sm text-neutral">Click for details</span>
          </div>
        `);

        // Enhanced marker click handler
        marker.on("click", function () {
          // First show popup to provide visual feedback
          marker.openPopup();

          console.log(`Marker clicked for facility ID: ${facility.id}`);

          // Call the parent component's handler with the exact ID from the facility
          setTimeout(() => {
            onSelectFacility(facility.id);
            console.log(
              `Selection callback triggered for facility ${facility.id}`,
            );
          }, 50);
        });

        markersRef.current.push(marker);
      } catch (error) {
        console.error(
          `Error adding marker for facility ${facility.id}:`,
          error,
        );
      }
    });

    console.log(
      `Successfully added ${markersRef.current.length} facility markers to map`,
    );
  }, [filteredFacilities, mapInitialized, onSelectFacility, showEvents]);

  // Focus on selected facility with better error handling
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedFacilityId) {
      return;
    }

    // If detail query is loading or errored, use the facility from the list
    if (!selectedFacilityQuery.data) {
      console.log("Facility detail not yet loaded, using facility from list");
      const facilityFromList = facilities.find(
        (f) => f.id === selectedFacilityId,
      );

      if (facilityFromList) {
        console.log("Found facility in list:", facilityFromList);

        if (facilityFromList.latitude && facilityFromList.longitude) {
          try {
            map.setView(
              [facilityFromList.latitude, facilityFromList.longitude],
              16,
              {
                animate: true,
                duration: 1,
              },
            );
            console.log("Map view updated using facility from list");
          } catch (err) {
            console.error("Error setting map view:", err);
          }
        }
      }
      return;
    }

    const facility = selectedFacilityQuery.data;
    console.log(`Focusing on selected facility: ${facility.id}`, facility.name);

    // Skip if coordinates are invalid
    if (
      !facility.latitude ||
      !facility.longitude ||
      isNaN(facility.latitude) ||
      isNaN(facility.longitude)
    ) {
      console.warn(`Selected facility ${facility.id} has invalid coordinates`);
      return;
    }

    try {
      // Find and open the popup for this facility if it exists
      const matchingMarker = markersRef.current.find(
        (marker) => marker.options.facilityId === selectedFacilityId,
      );

      if (matchingMarker) {
        matchingMarker.openPopup();
      }

      // Pan to the facility location
      map.setView([facility.latitude, facility.longitude], 16, {
        animate: true,
        duration: 1,
      });

      console.log("Map view updated to selected facility");
    } catch (error) {
      console.error(`Error focusing on facility ${facility.id}:`, error);
    }
  }, [selectedFacilityId, selectedFacilityQuery.data, facilities]);

  // Add this in the MapView component file

  // Add a useEffect to retain zoom level when data refreshes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapInitialized) return;

    // Create a function to handle zoom change
    const handleZoomChange = () => {
      // Store current zoom and center whenever it changes
      const currentZoom = map.getZoom();
      const currentCenter = map.getCenter();

      // Store these in localStorage for persistence
      if (currentZoom && currentCenter) {
        try {
          localStorage.setItem("map_zoom", currentZoom.toString());
          localStorage.setItem("map_center_lat", currentCenter.lat.toString());
          localStorage.setItem("map_center_lng", currentCenter.lng.toString());
          console.log(
            `Saved map state: zoom=${currentZoom}, center=${currentCenter.lat},${currentCenter.lng}`,
          );
        } catch (e) {
          console.error("Error saving map state:", e);
        }
      }
    };

    // Add event listeners for zoom and dragend (pan)
    map.on("zoomend", handleZoomChange);
    map.on("dragend", handleZoomChange);

    return () => {
      // Clean up event listeners
      if (map) {
        map.off("zoomend", handleZoomChange);
        map.off("dragend", handleZoomChange);
      }
    };
  }, [mapInitialized]);

  // Add this section to prevent map resets during operations like reviews or check-ins
  // Detect changes to React Query's isFetching or isLoading states
  useEffect(() => {
    // Start of data fetching - set preserveState to true
    const handleFetchStart = () => {
      shouldPreserveState.current = true;
      console.log("Map state preservation activated");

      // Save current map state if available
      const map = mapInstanceRef.current;
      if (map && mapInitialized) {
        try {
          const currentZoom = map.getZoom();
          const currentCenter = map.getCenter();

          if (currentZoom && currentCenter) {
            localStorage.setItem("map_zoom", currentZoom.toString());
            localStorage.setItem(
              "map_center_lat",
              currentCenter.lat.toString(),
            );
            localStorage.setItem(
              "map_center_lng",
              currentCenter.lng.toString(),
            );
            console.log("Map state preserved during operation");
          }
        } catch (e) {
          console.error("Error saving map state during operation:", e);
        }
      }
    };

    // End of data fetching (1 second after) - allow state changes again
    const handleFetchComplete = () => {
      setTimeout(() => {
        shouldPreserveState.current = false;
        console.log("Map state preservation deactivated");
      }, 1000);
    };

    // Add global event listeners for data fetch operations
    document.addEventListener("fetch-start", handleFetchStart);
    document.addEventListener("fetch-complete", handleFetchComplete);

    return () => {
      document.removeEventListener("fetch-start", handleFetchStart);
      document.removeEventListener("fetch-complete", handleFetchComplete);
    };
  }, [mapInitialized]);

  // Restore map position on remounts or data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapInitialized) return;

    // Only restore if we're not focused on a specific facility
    // AND we're not preserving state (i.e., during operations)
    if (!selectedFacilityId && !shouldPreserveState.current) {
      try {
        const savedZoom = localStorage.getItem("map_zoom");
        const savedCenterLat = localStorage.getItem("map_center_lat");
        const savedCenterLng = localStorage.getItem("map_center_lng");

        if (savedZoom && savedCenterLat && savedCenterLng) {
          console.log(
            `Restoring map state: zoom=${savedZoom}, center=${savedCenterLat},${savedCenterLng}`,
          );
          map.setView(
            [parseFloat(savedCenterLat), parseFloat(savedCenterLng)],
            parseFloat(savedZoom),
            { animate: false },
          );
        }
      } catch (e) {
        console.error("Error restoring map state:", e);
      }
    } else {
      console.log(
        "Skipping map state restoration during operation or with selected facility",
      );
    }
  }, [mapInitialized, filteredFacilities.length]);

  // Modify the fitBounds function to respect the preservation state
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (
      !map ||
      !mapInitialized ||
      !filteredFacilities ||
      filteredFacilities.length === 0
    )
      return;

    // Skip bounds calculation if we should preserve state
    if (shouldPreserveState.current) {
      console.log("Skipping bounds adjustment due to active operation");
      return;
    }

    // Original bounds calculation logic here...
    const L = window.L;
    if (!L) return;

    try {
      // Only proceed with bounds adjustment if we're not preserving state
      // AND not focused on a facility AND no saved position
      if (
        !selectedFacilityId &&
        !localStorage.getItem("map_zoom") &&
        !shouldPreserveState.current
      ) {
        // Create a bounds object from all markers
        const bounds = L.featureGroup(markersRef.current).getBounds();

        // Only fit bounds if we have valid bounds with actual area
        if (
          bounds.isValid() &&
          bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 0
        ) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
          });
          console.log("Map bounds adjusted to show all filtered markers");
        }
      } else {
        console.log(
          "Skipping bounds adjustment - preserving user map position",
        );
      }
    } catch (error) {
      console.error("Error calculating bounds:", error);
    }
  }, [filteredFacilities, mapInitialized, selectedFacilityId]);

  // Handle user location button click
  // Add event markers to the map when in events tab
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapInitialized) {
      return;
    }

    // If we're not showing events mode, don't do anything here
    if (!showEvents) {
      console.log("Events tab not active - skipping event marker creation");
      return;
    }

    // Clear all markers before adding event markers
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch (err) {
        console.warn("Error removing marker:", err);
      }
    });
    markersRef.current = [];

    // Combine public and group events
    const allEvents = [...events];
    const groupEventsWithCoordinates = [];

    // Process group events if available
    if (groupEvents && groupEvents.length > 0) {
      console.log(
        `Processing ${groupEvents.length} group events for map display`,
      );

      // For group events, we need to geocode the address since we're not storing facilityId
      // We'll add all group events to the list for now, and we'll try to geocode their addresses later
      groupEvents.forEach((event) => {
        groupEventsWithCoordinates.push({
          ...event,
          // Ensure we know it's a group event
          isGroupEvent: true,
          // We'll use these fields later for geocoding
          locationName: event.locationName,
          address: event.address,
        });
      });

      // Add all group events to the combined list
      allEvents.push(...groupEventsWithCoordinates);
      console.log(
        `Added ${groupEventsWithCoordinates.length} group events to map display`,
      );
    }

    // If there are no events, zoom out to show all of Hong Kong
    if (allEvents.length === 0) {
      console.log(
        "No events available to display, zooming to Hong Kong overview",
      );
      map.setView([22.302711, 114.177216], 11); // Hong Kong center
      return;
    }

    // Use the globally available L from Leaflet
    const L = window.L;
    if (!L) {
      console.error("Leaflet library not available");
      return;
    }

    console.log(`Adding ${allEvents.length} total event markers to map`);

    // Create event markers with a distinct style
    allEvents.forEach((event) => {
      let markerLatitude, markerLongitude;

      // Group events don't have facilityId, they have location information directly
      if (event.isGroupEvent) {
        // For now, we'll just use a default location in Hong Kong
        // TODO: Implement geocoding for the address to get actual coordinates
        markerLatitude = 22.302711; // Hong Kong center latitude
        markerLongitude = 114.177216; // Hong Kong center longitude

        // Log for debugging
        console.log(`Setting default location for group event: ${event.name}`);
      } else {
        // Public events have facilityId
        const facility = facilities.find((f) => f.id === event.facilityId);
        if (!facility || !facility.latitude || !facility.longitude) {
          console.warn(
            `Could not find facility coordinates for event ${event.id}`,
          );
          return;
        }
        markerLatitude = facility.latitude;
        markerLongitude = facility.longitude;
      }

      // Create a custom event marker icon - different for group vs public events
      const isGroupEvent = !!event.isGroupEvent;

      // Use different colors for group events vs public events
      const bgClass = isGroupEvent ? "bg-indigo-600" : "bg-primary";
      const icon = isGroupEvent ? "👥" : "📅"; // Group emoji for group events

      const eventIcon = L.divIcon({
        className: "event-marker",
        html: `<div class="flex items-center justify-center w-8 h-8 rounded-full ${bgClass} text-white"><span>${icon}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      // Format the date for display
      const eventDate = new Date(event.eventDate);
      const dateString = eventDate.toLocaleDateString();

      // Group info for popup if applicable
      const groupInfo =
        isGroupEvent && event.groupId
          ? `<p class="text-xs font-semibold text-indigo-600">Group Event</p>`
          : "";

      // Create the marker and add it to the map
      const marker = L.marker([markerLatitude, markerLongitude], {
        icon: eventIcon,
        eventId: event.id,
        facilityId: event.facilityId,
        isEventMarker: true,
        isGroupEvent,
      }).addTo(map);

      // Add a popup with event details
      marker.bindPopup(`
        <div class="text-center p-1">
          <h3 class="font-bold">${event.name}</h3>
          ${groupInfo}
          <p class="text-xs">${dateString} | ${event.startTime} - ${event.endTime}</p>
          <p class="text-xs capitalize">${event.sportType || "activity"}</p>
          <span class="text-sm text-neutral">Click for details</span>
        </div>
      `);

      // Add click handler to zoom to this marker and open popup
      marker.on("click", function () {
        // First show popup to provide visual feedback
        marker.openPopup();

        // Zoom to this marker
        map.setView([markerLatitude, markerLongitude], 16, {
          animate: true,
          duration: 1,
        });

        console.log(
          `Event marker clicked for event ID: ${event.id} (${isGroupEvent ? "group event" : "public event"})`,
        );
      });

      // Store the marker for later reference
      markersRef.current.push(marker);
    });

    console.log(
      `Successfully added ${allEvents.length} event markers to map (${groupEventsWithCoordinates.length} group events)`,
    );
  }, [events, groupEvents, showEvents, mapInitialized, facilities]);

  const handleUserLocation = () => {
    const map = mapInstanceRef.current;
    if (!navigator.geolocation || !map) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        map.setView([latitude, longitude], 15);

        // Use the globally available L from Leaflet
        const L = window.L;
        if (!L) return;

        // Remove previous user location marker
        markersRef.current = markersRef.current.filter((marker) => {
          if (marker.options.isUserLocation) {
            marker.remove();
            return false;
          }
          return true;
        });

        const userMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: "user-location",
            html: `<div class="w-6 h-6 bg-primary rounded-full border-2 border-white"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          isUserLocation: true,
        }).addTo(map);

        userMarker.bindPopup("You are here").openPopup();
        markersRef.current.push(userMarker);
      },
      (error) => {
        console.error("Error getting location:", error);
      },
    );
  };

  // Google Places API key for search
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check for Google Maps API key
  useEffect(() => {
    if (!googleMapsApiKey) {
      console.warn(
        "Google Maps API key is missing. Place search will be limited.",
      );
      setApiKeyMissing(true);
    }
  }, []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear any existing timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Set a new timeout to prevent too many API calls
    if (query.length > 2) {
      searchTimeout.current = setTimeout(() => {
        searchNearbyPlaces(query);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  // Search our facility database instead of Google Places
  const searchNearbyPlaces = async (query: string) => {
    try {
      setIsSearching(true);

      // Use our regular facilities API with a query parameter
      const response = await fetch(
        `/api/facilities?query=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to search facilities");
      }

      // Parse and transform response
      const data = await response.json();

      // Format search results
      const formattedResults = data.map((facility: Facility) => ({
        id: facility.id,
        name: facility.name,
        vicinity: `${facility.district?.replace(/_/g, " ")} ${facility.address ? "- " + facility.address : ""}`,
        type: facility.type,
        types: [facility.type],
        latitude: facility.latitude,
        longitude: facility.longitude,
        existsInDatabase: true,
        averageRating: facility.averageRating,
        totalReviews: facility.totalReviews,
      }));

      setSearchResults(formattedResults);

      // If there are results, focus the map on the first result
      if (formattedResults.length > 0 && mapInstanceRef.current) {
        const firstResult = formattedResults[0];
        if (firstResult.latitude && firstResult.longitude) {
          mapInstanceRef.current.setView(
            [firstResult.latitude, firstResult.longitude],
            15,
          );
        }
      } else if (formattedResults.length === 0) {
        toast({
          title: "No results found",
          description:
            "Try different search terms or zoom out to see more facilities.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error searching facilities:", error);
      toast({
        title: "Search Failed",
        description: "Failed to search facilities. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Function to handle selecting a search result
  const handleSelectSearchResult = (result: any) => {
    if (!mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    // Since we're searching our database now, we can directly use the facility ID
    // to trigger the facility selection
    if (result.id && typeof onSelectFacility === "function") {
      console.log(`Selected facility from search: ${result.id}`);

      // Call the parent component's selection handler
      onSelectFacility(result.id);

      // Center map on selected result
      if (result.latitude && result.longitude) {
        mapInstanceRef.current.setView([result.latitude, result.longitude], 16);
      }
    } else {
      console.warn("Cannot select facility - missing ID or selection handler");

      // Fallback to just showing on map if we can't select it properly
      if (result.latitude && result.longitude) {
        mapInstanceRef.current.setView([result.latitude, result.longitude], 16);

        // Add a temporary marker for this place
        const marker = L.marker([result.latitude, result.longitude], {
          icon: createCustomMarker(result.type || "unknown"),
        }).addTo(mapInstanceRef.current);

        // Popup with place details
        marker
          .bindPopup(
            `
          <div class="p-2 text-center">
            <h3 class="font-bold">${result.name}</h3>
            <p class="text-xs">${result.vicinity || ""}</p>
            <p class="text-xs">${result.type || "Place"}</p>
          </div>
        `,
          )
          .openPopup();

        // Store the marker reference to remove it later
        markersRef.current.push(marker);
      }
    }

    // Close the search results dropdown
    setSearchResults([]);
  };

  return (
    <div
      className="relative h-full w-full"
      style={{ height: "100%", minHeight: "400px" }}
    >
      <div
        id="map"
        ref={mapRef}
        className="w-full h-full absolute inset-0"
      ></div>

      {/* Search Control */}
      <div className="absolute top-4 left-4 right-4 z-20 max-w-md mx-auto">
        <div className="relative">
          <div className="flex items-center">
            <Input
              type="text"
              placeholder="Search our database for facilities..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pr-10 pl-3 py-2 rounded-lg border shadow-lg bg-white w-full"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {isSearching ? (
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <Search className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-lg rounded-md overflow-hidden max-h-60 overflow-y-auto z-50">
              <ul className="divide-y divide-gray-100">
                {searchResults.map((result, index) => (
                  <li
                    key={index}
                    className="p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-xs text-gray-500">
                          {result.vicinity || "No address available"}
                        </p>
                      </div>
                      <span className="text-xs capitalize px-2 py-1 bg-gray-100 rounded-full">
                        {result.types?.[0]?.replace(/_/g, " ") || "place"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* User Location Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 left-4 bg-white p-3 rounded-full shadow-lg z-30"
        onClick={handleUserLocation}
      >
        <Locate className="h-6 w-6 text-primary" />
      </Button>

      {/* We're no longer using Google Places, so hiding the warning */}
    </div>
  );
}
