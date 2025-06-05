import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Facility, Event } from "@shared/schema";
import FacilityList from "../facilities/facility-list";
import NearbyPlacesList from "../facilities/nearby-places-list";
import EventList from "../events/event-list";
import FacilityDetail from "../facilities/facility-detail";
import EventDetail from "../events/event-detail";
import { districts, facilityTypes } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidePanelProps {
  selectedFacilityId: number;
  onSelectFacility: (id: number) => void;
  activeTab: "facilities" | "events";
  onTabChange: (tab: "facilities" | "events") => void;
  // Add props for filters
  onFilterChange?: (type: string, district: string) => void;
  initialFilterType?: string;
  initialFilterDistrict?: string;
  // Add a prop for panel collapse state
  onPanelToggle?: (collapsed: boolean) => void;
  // Add a prop for group events
  groupEvents?: any[]; // Use any since group events might have additional properties
}

// Create a fake facility for testing/debugging
// We'll use this if we need to force a known good facility object
const createBackupFacility = (id: number): Facility => {
  return {
    id: id,
    name: `Backup Facility ${id}`,
    type: "basketball",
    district: "central",
    address: "123 Test Street, Hong Kong",
    description: "This is a backup facility created for debugging purposes",
    latitude: 22.282,
    longitude: 114.169,
    openTime: "07:00:00",
    closeTime: "22:00:00",
  } as Facility;
};

export default function SidePanel({
  selectedFacilityId,
  onSelectFacility,
  activeTab,
  onTabChange,
  onFilterChange,
  initialFilterType = "",
  initialFilterDistrict = "all",
  onPanelToggle,
  groupEvents = [], // Add default empty array for group events
}: SidePanelProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>(initialFilterType);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    initialFilterDistrict,
  );
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");

  // Add state to track selected event ID
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // Add state for panel collapse only (simplified)
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // Track user location for facility search - moved from nested function to component level
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Create a stable facility cache
  const [facilityCache, setFacilityCache] = useState<Record<number, Facility>>(
    {},
  );

  // Debug counter removed to prevent accidental rendering
  useEffect(() => {
    // Log only in development (removed render counter)
    if (process.env.NODE_ENV !== "production") {
      console.log("SidePanel rendered");
    }
  }, []);

  // Get user's current location for nearby places
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          console.log(`Got user location: ${latitude}, ${longitude}`);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Hong Kong location if geolocation fails
          setUserLocation({ lat: 22.302711, lng: 114.177216 });
        },
      );
    } else {
      // Default to Hong Kong location if geolocation is not supported
      setUserLocation({ lat: 22.302711, lng: 114.177216 });
    }
  }, []);

  // Create filters state for facilities query
  const [facilityFilters, setFacilityFilters] = useState({
    type: selectedType || undefined,
    district: selectedDistrict !== "all" ? selectedDistrict : undefined,
    query: searchQuery || undefined,
  });

  // Add date range for events
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Create filters state for events query
  const [eventFilters, setEventFilters] = useState({
    type: selectedType || undefined,
    query: searchQuery || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    district: selectedDistrict !== "all" ? selectedDistrict : undefined,
    gender: selectedGender !== "all" ? selectedGender : undefined,
    ageRange: selectedAge !== "all" ? selectedAge : undefined,
  });

  // Synchronize our filter states when dependencies change
  useEffect(() => {
    // Update our facility filters object when any filter criteria changes
    const updatedFacilityFilters = {
      type: selectedType || undefined,
      district: selectedDistrict !== "all" ? selectedDistrict : undefined,
      query: searchQuery || undefined,
    };

    // Update our event filters object when relevant filters change
    const updatedEventFilters = {
      type: selectedType || undefined,
      query: searchQuery || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      district: selectedDistrict !== "all" ? selectedDistrict : undefined,
      gender: selectedGender !== "all" ? selectedGender : undefined,
      ageRange: selectedAge !== "all" ? selectedAge : undefined,
    };

    console.log(
      "Filter dependencies changed, updating filter objects:",
      updatedFacilityFilters,
    );

    setFacilityFilters(updatedFacilityFilters);
    setEventFilters(updatedEventFilters);
  }, [
    selectedType,
    selectedDistrict,
    searchQuery,
    fromDate,
    toDate,
    selectedGender,
    selectedAge,
  ]);

  // Query for facilities list with improved settings
  const facilitiesQuery = useQuery<Facility[]>({
    queryKey: ["/api/facilities", facilityFilters],
    enabled: activeTab === "facilities" || !selectedFacilityId,
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });

  // Query for events
  const eventsQuery = useQuery<Event[]>({
    queryKey: ["/api/events", eventFilters],
    enabled: activeTab === "events",
  });

  // Query for facility details
  const facilityDetailQuery = useQuery<Facility>({
    queryKey: ["/api/facilities", selectedFacilityId],
    enabled: !!selectedFacilityId,
  });

  // Query for event details
  const eventDetailQuery = useQuery<Event>({
    queryKey: [`/api/events/${selectedEventId}`],
    enabled: !!selectedEventId,
  });

  // Handle success with useEffect instead of onSuccess
  useEffect(() => {
    if (facilityDetailQuery.data) {
      const data = facilityDetailQuery.data;

      console.log("✅ Facility detail query success:", {
        id: data.id,
        name: data.name,
        type: data.type,
        district: data.district,
      });

      // Update the facility cache with the detailed data
      setFacilityCache((prev) => {
        const newCache = { ...prev };
        newCache[data.id] = data;
        console.log(
          `Updated facility cache with id ${data.id}, name: ${data.name}`,
        );
        return newCache;
      });
    }
  }, [facilityDetailQuery.data]);

  // Handle error with useEffect instead of onError
  useEffect(() => {
    if (facilityDetailQuery.error) {
      console.error(
        "❌ Facility detail query error:",
        facilityDetailQuery.error,
      );
    }
  }, [facilityDetailQuery.error]);

  // Update cache when facilities are loaded from the list query
  useEffect(() => {
    if (facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      console.log(
        `Received ${facilitiesQuery.data.length} facilities from list query`,
      );

      // Create a new cache with facilities from the list
      const newCache = { ...facilityCache };
      let updatedCount = 0;

      facilitiesQuery.data.forEach((facility) => {
        // Only update if we don't have this facility yet or if it has more complete data
        if (!newCache[facility.id] || !newCache[facility.id].name) {
          newCache[facility.id] = facility;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        console.log(
          `Updated facility cache with ${updatedCount} facilities from list query`,
        );
        setFacilityCache(newCache);
      }
    }
  }, [facilitiesQuery.data]);

  // When a facility is selected, immediately find it and add to cache
  useEffect(() => {
    if (selectedFacilityId && !facilityCache[selectedFacilityId]) {
      console.log(
        `New facility selected: ${selectedFacilityId}, looking for data`,
      );

      // First check the list query
      if (facilitiesQuery.data) {
        const facilityFromList = facilitiesQuery.data.find(
          (f) => f.id === selectedFacilityId,
        );
        if (facilityFromList) {
          console.log(`Found facility ${selectedFacilityId} in list query:`, {
            name: facilityFromList.name,
            type: facilityFromList.type,
            district: facilityFromList.district,
          });

          // Add to cache
          setFacilityCache((prev) => {
            const newCache = { ...prev };
            newCache[selectedFacilityId] = facilityFromList;
            return newCache;
          });
        } else {
          console.log(`Facility ${selectedFacilityId} not found in list query`);
        }
      }
    }
  }, [selectedFacilityId, facilitiesQuery.data, facilityCache]);

  // Get the current facility to display
  const getCurrentFacility = (): Facility => {
    // 1. Try to get from cache
    if (selectedFacilityId !== 0 && facilityCache[selectedFacilityId]) {
      console.log(
        `Using cached facility ${selectedFacilityId}: ${facilityCache[selectedFacilityId].name}`,
      );
      return facilityCache[selectedFacilityId];
    }

    // 2. Try to get from detail query
    if (facilityDetailQuery.data) {
      console.log(
        `Using facility from detail query: ${facilityDetailQuery.data.name}`,
      );
      return facilityDetailQuery.data;
    }

    // 3. Try to find in list
    if (selectedFacilityId !== 0 && facilitiesQuery.data) {
      const facilityFromList = facilitiesQuery.data.find(
        (f) => f.id === selectedFacilityId,
      );
      if (facilityFromList) {
        console.log(`Using facility from list: ${facilityFromList.name}`);
        return facilityFromList;
      }
    }

    // 4. Return a placeholder
    console.log(
      `No facility data found for ${selectedFacilityId}, using placeholder`,
    );

    // Create a properly typed placeholder facility
    const placeholder: Facility = {
      id: selectedFacilityId,
      name: facilityDetailQuery.isLoading
        ? "Loading facility..."
        : "Facility information unavailable",
      description: null,
      type: "other", // Use a valid type from the schema
      district: "central", // Use a valid district from the schema
      address: "Loading...",
      latitude: 22.302711, // Default to Hong Kong central coordinates
      longitude: 114.177216,
      openTime: null,
      closeTime: null,
      contactPhone: null,
      imageUrl: null,
      courts: null,
      amenities: null,
      ageRestriction: null,
      genderSuitability: null,
      createdAt: null,
      averageRating: null,
      totalReviews: null,
      approvalStatus: "approved", // Add missing properties
      searchSource: null,
    };

    return placeholder;
  };

  // Toggle the side panel collapsed state
  const toggleCollapsed = () => {
    const newCollapsedState = !collapsed;
    setCollapsed(newCollapsedState);

    // Notify parent component about collapse state change
    if (onPanelToggle) {
      onPanelToggle(newCollapsedState);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`Performing search with query: "${searchQuery}"`);

    if (activeTab === "facilities") {
      // Update the facility filters with the new search query
      const newFilters = {
        type: selectedType || undefined,
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        query: searchQuery.trim() || undefined,
      };

      console.log("Search filters:", newFilters);

      // Force update of the facility filters in our state
      setFacilityFilters(newFilters);

      // Invalidate the query cache and trigger a refetch with our new filters
      queryClient.invalidateQueries({
        queryKey: ["/api/facilities"],
      });

      // Explicitly call refetch to ensure the query runs
      setTimeout(() => {
        facilitiesQuery.refetch();
      }, 100);
    } else if (activeTab === "events") {
      // Handle event search here with all required event filter properties
      const newEventFilters = {
        type: selectedType || undefined,
        query: searchQuery.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        gender: selectedGender !== "all" ? selectedGender : undefined,
        ageRange: selectedAge !== "all" ? selectedAge : undefined,
      };

      // Update events query parameters
      setEventFilters(newEventFilters);

      // Invalidate the events query cache
      queryClient.invalidateQueries({
        queryKey: ["/api/events"],
      });

      // Explicitly call refetch to ensure the query runs
      setTimeout(() => {
        eventsQuery.refetch();
      }, 100);
    }
  };

  const handleBackToList = () => {
    onSelectFacility(0); // Use 0 instead of null
  };

  const handleBackToEventList = () => {
    setSelectedEventId(null);
  };

  const formatDistrictName = (district: string | undefined): string => {
    if (!district) return "All Districts";

    return district
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Updated handler for facility type selection with improved state management
  const handleTypeSelection = (type: string) => {
    // Determine the new type value with toggle behavior
    let newType = type;

    // When clicking "All Types", clear the filter
    if (type === "") {
      console.log("Setting type filter to ALL TYPES (empty string)");
      newType = "";
    }
    // When clicking the already selected type, clear the filter (toggle behavior)
    else if (selectedType === type) {
      console.log(`Toggling off selected type ${type}`);
      newType = "";
    }
    // Otherwise, use the selected type
    else {
      console.log(`Setting type filter to: ${type}`);
    }

    // Update the selected type in state
    setSelectedType(newType);

    // Notify parent component of filter change
    if (onFilterChange) {
      console.log(
        `Calling onFilterChange with type=${newType}, district=${selectedDistrict}`,
      );
      onFilterChange(newType, selectedDistrict);
    }

    // Create new filter objects for both facilities and events
    const newFacilityFilters = {
      type: newType || undefined,
      district: selectedDistrict !== "all" ? selectedDistrict : undefined,
      query: searchQuery || undefined,
    };

    const newEventFilters = {
      type: newType || undefined,
      query: searchQuery || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      district: selectedDistrict !== "all" ? selectedDistrict : undefined,
      gender: selectedGender !== "all" ? selectedGender : undefined,
      ageRange: selectedAge !== "all" ? selectedAge : undefined,
    };

    console.log("Setting new filters:", newFacilityFilters);

    // Update our filter states
    setFacilityFilters(newFacilityFilters);
    setEventFilters(newEventFilters);

    // Invalidate and refetch based on the active tab
    setTimeout(() => {
      if (activeTab === "facilities") {
        queryClient.invalidateQueries({
          queryKey: ["/api/facilities"],
        });
        facilitiesQuery.refetch();
      } else if (activeTab === "events") {
        queryClient.invalidateQueries({
          queryKey: ["/api/events"],
        });
        eventsQuery.refetch();
      }
    }, 100);
  };

  // When we render a facility detail
  const facilityForDetail = selectedFacilityId ? getCurrentFacility() : null;

  // For debugging only - log what we're about to render
  useEffect(() => {
    if (selectedFacilityId && facilityForDetail) {
      console.log("🔍 About to render facility detail:", {
        id: facilityForDetail.id,
        name: facilityForDetail.name,
        type: facilityForDetail.type,
        district: facilityForDetail.district,
      });
    }
  }, [selectedFacilityId, facilityForDetail]);

  return (
    <div className="flex h-full relative main-container">
      {/* Collapse/expand button - Moved outside the panel to always be visible */}
      <button
        className={`fixed md:top-1/2 md:-translate-y-1/2 z-[9999] shadow-md p-3 hover:scale-110 transition-transform ${
          collapsed
            ? "bg-primary text-white rounded-tr-lg rounded-br-lg left-0 border-r border-t border-b border-primary top-1/2 -translate-y-1/2"
            : isMobile
              ? "bg-white text-primary rounded-bl rounded-br right-2 border border-gray-200 top-[42vh] translate-y-0"
              : "bg-white text-primary rounded-tr rounded-br left-[400px] border border-gray-200"
        }`}
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand side panel" : "Collapse side panel"}
      >
        {collapsed ? (
          <ChevronRight className="h-6 w-6" />
        ) : isMobile ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>

      {/* Main side panel */}
      <div
        className={cn(
          "bg-white overflow-y-auto flex flex-col z-20 transition-all duration-300 ease-in-out",
          collapsed ? "w-0 opacity-0 h-0" : "w-full h-full",
          isMobile ? "border-t border-gray-200" : "border-r border-gray-200",
        )}
        style={
          !collapsed && !isMobile
            ? {
                width: "400px",
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
              }
            : !collapsed && isMobile
              ? { width: "100%", height: "60vh", position: "relative" }
              : undefined
        }
      >
        {/* Content Tabs - Moved to top and hidden when either a facility or event is selected */}
        {!selectedFacilityId && !selectedEventId && (
          <div className="border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex">
              <button
                className={`flex-1 py-3 font-medium text-center ${activeTab === "facilities" ? "tab-active text-primary border-b-2 border-primary" : "text-neutral-dark"}`}
                onClick={() => onTabChange("facilities")}
              >
                Facilities
              </button>
              <button
                className={`flex-1 py-3 font-medium text-center ${activeTab === "events" ? "tab-active text-primary border-b-2 border-primary" : "text-neutral-dark"}`}
                onClick={() => onTabChange("events")}
              >
                Events
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter - hidden when either a facility or event is selected */}
        {!selectedFacilityId && !selectedEventId && (
          <div className="p-4 border-b border-gray-200 sticky top-10 bg-white z-10">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search facilities or events"
                  className="w-full pl-10 pr-4 py-2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              </div>
            </form>

            {/* Filters Section */}
            <div className="mt-3 flex space-x-2 overflow-x-auto pb-2">
              <Button
                size="sm"
                variant={selectedType === "" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("")}
              >
                All Types
              </Button>
              <Button
                size="sm"
                variant={selectedType === "basketball" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("basketball")}
              >
                Basketball
              </Button>
              <Button
                size="sm"
                variant={selectedType === "soccer" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("soccer")}
              >
                Soccer
              </Button>
              <Button
                size="sm"
                variant={selectedType === "swimming" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("swimming")}
              >
                Swimming
              </Button>
              <Button
                size="sm"
                variant={selectedType === "tennis" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("tennis")}
              >
                Tennis
              </Button>
              <Button
                size="sm"
                variant={selectedType === "sports_ground" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("sports_ground")}
              >
                Sports Ground
              </Button>
              <Button
                size="sm"
                variant={selectedType === "sports_centre" ? "default" : "outline"}
                className="rounded-full whitespace-nowrap"
                onClick={() => handleTypeSelection("sports_centre")}
              >
                Sports Centre
              </Button>
            </div>

            {/* Advanced Filters */}
            <div className="flex gap-2 mt-3 items-center">
              <label
                htmlFor="district-filter"
                className="text-sm text-gray-700 whitespace-nowrap"
              >
                District:
              </label>
              <Select
                value={selectedDistrict}
                onValueChange={(value) => {
                  console.log(`Setting district to ${value}`);
                  setSelectedDistrict(value);
                  if (onFilterChange) {
                    onFilterChange(selectedType, value);
                  }
                }}
              >
                <SelectTrigger className="flex-1 h-9 text-xs">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.map((district) => (
                    <SelectItem
                      key={district}
                      value={district}
                      className="capitalize"
                    >
                      {formatDistrictName(district)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Gender filter */}
              <label
                htmlFor="gender-filter"
                className="text-sm text-gray-700 whitespace-nowrap"
              >
                Gender:
              </label>
              <Select
                value={selectedGender}
                onValueChange={(value) => {
                  setSelectedGender(value);
                }}
              >
                <SelectTrigger className="flex-1 h-9 text-xs">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age filter - only shown for events tab */}
            {activeTab === "events" && (
              <div className="flex gap-2 mt-3 items-center">
                <label
                  htmlFor="age-filter"
                  className="text-sm text-gray-700 whitespace-nowrap"
                >
                  Age Group:
                </label>
                <Select
                  value={selectedAge}
                  onValueChange={(value) => {
                    setSelectedAge(value);
                  }}
                >
                  <SelectTrigger className="flex-1 h-9 text-xs">
                    <SelectValue placeholder="All Ages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ages</SelectItem>
                    <SelectItem value="under_18">Under 18</SelectItem>
                    <SelectItem value="18_to_30">18-30</SelectItem>
                    <SelectItem value="31_to_50">31-50</SelectItem>
                    <SelectItem value="over_50">Over 50</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date filters */}
                <label
                  htmlFor="date-from"
                  className="text-sm text-gray-700 whitespace-nowrap"
                >
                  From:
                </label>
                <Input
                  id="date-from"
                  type="date"
                  className="flex-1 h-9 text-xs"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <label
                  htmlFor="date-to"
                  className="text-sm text-gray-700 whitespace-nowrap"
                >
                  To:
                </label>
                <Input
                  id="date-to"
                  type="date"
                  className="flex-1 h-9 text-xs"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Facility Detail */}
        {selectedFacilityId !== 0 && facilityForDetail && (
          <div className="p-4">
            <div className="flex items-center mb-4">
              <Button
                size="sm"
                variant="ghost"
                className="mr-2"
                onClick={handleBackToList}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h2 className="text-lg font-semibold">
                {facilityForDetail.name}
              </h2>
            </div>
            <FacilityDetail
              facility={facilityForDetail}
              isLoading={facilityDetailQuery.isLoading}
              onBackToList={handleBackToList}
            />
          </div>
        )}

        {/* Facility List */}
        {!selectedFacilityId && activeTab === "facilities" && (
          <div className="flex-1 overflow-y-auto">
            <FacilityList
              facilities={facilitiesQuery.data || []}
              isLoading={facilitiesQuery.isLoading}
              onSelectFacility={onSelectFacility}
            />
          </div>
        )}

        {/* Event Detail */}
        {selectedEventId && eventDetailQuery.data && (
          <div className="p-4">
            <div className="flex items-center mb-4">
              <Button
                size="sm"
                variant="ghost"
                className="mr-2"
                onClick={handleBackToEventList}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h2 className="text-lg font-semibold">
                {eventDetailQuery.data.name}
              </h2>
            </div>
            <EventDetail
              event={eventDetailQuery.data}
              isLoading={eventDetailQuery.isLoading}
              onBackToList={handleBackToEventList}
            />
          </div>
        )}

        {/* Event List */}
        {!selectedFacilityId && !selectedEventId && activeTab === "events" && (
          <div className="flex-1 overflow-y-auto">
            {/* Public events */}
            <h3 className="text-lg font-semibold px-4 pt-2 pb-1">
              Public Events
            </h3>
            <EventList
              events={eventsQuery.data || []}
              isLoading={eventsQuery.isLoading}
              onSelectEvent={setSelectedEventId}
            />

            {/* Group events section - only shown if there are group events */}
            {groupEvents && groupEvents.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold px-4 pt-2 pb-1">
                  Group Events
                </h3>
                <p className="text-sm text-gray-500 px-4 pb-2">
                  Events from your groups
                </p>
                <EventList
                  events={groupEvents}
                  isLoading={false}
                  onSelectEvent={(id) => {
                    // For group events, we need to navigate to the group event page
                    const groupEvent = groupEvents.find((e) => e.id === id);
                    if (groupEvent) {
                      window.location.href = `/groups/${groupEvent.groupId}/events/${id}`;
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* No resize handle in the simplified version */}

      {/* When panel is collapsed, show a minimal tab indicator */}
      {collapsed && (
        <div className="absolute top-0 left-0 bg-white py-2 px-3 border-r border-b border-gray-200 rounded-br flex flex-col gap-2">
          <button
            className={`p-2 rounded ${activeTab === "facilities" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
            onClick={() => onTabChange("facilities")}
            title="Facilities"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            className={`p-2 rounded ${activeTab === "events" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
            onClick={() => onTabChange("events")}
            title="Events"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
