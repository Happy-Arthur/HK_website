import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/header";
import SidePanel from "@/components/layout/side-panel";
import MapView from "@/components/map/map-view";
import type { Facility, Event } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  // Use useLocation hook correctly - it returns [path, navigate]
  const [path, navigate] = useLocation();

  // Use window.location.search for URL params
  const searchParams = window.location.search;
  const urlParams = new URLSearchParams(searchParams);
  const tabParam = urlParams.get("tab");

  // Use auth for user context and to ensure we're properly authenticated
  const { user } = useAuth();
  
  // No separate admin login needed
  // Regular login page handles both normal users and admins

  const [selectedFacilityId, setSelectedFacilityId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"facilities" | "events">(
    tabParam === "events" ? "events" : "facilities",
  );
  const [mapLoaded, setMapLoaded] = useState(false);

  // Add state to track filters for map synchronization
  const [filterType, setFilterType] = useState<string>("");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  
  // Add state to track panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);
  
  // Add state to detect mobile devices
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Detect mobile devices on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is the md breakpoint in Tailwind
    };
    
    // Check initially
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Get all facilities for map with better error handling
  const facilitiesQuery = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
    retry: 3, // Try up to 3 times to load facilities if there are errors
    refetchOnWindowFocus: false, // Don't refetch when window is focused
  });

  // Get all public events to display on the map
  const eventsQuery = useQuery<Event[]>({
    queryKey: ["/api/events"],
    retry: 3,
    refetchOnWindowFocus: false,
  });
  
  // Get user's group memberships
  const userGroupsQuery = useQuery({
    queryKey: ["/api/groups/my-groups"],
    enabled: !!user?.id, // Only run if user is logged in
    retry: 2,
    refetchOnWindowFocus: false,
  });
  
  // Fetch group events for the user's groups
  const groupEventsQuery = useQuery({
    queryKey: ["/api/user/group-events"],
    enabled: !!user?.id && !!userGroupsQuery.data, // Only run if user is logged in and groups loaded
    queryFn: async () => {
      // If no groups, don't fetch
      if (!userGroupsQuery.data || !Array.isArray(userGroupsQuery.data) || userGroupsQuery.data.length === 0) {
        return [];
      }
      
      // Fetch events from all user's groups
      const groupIds = (userGroupsQuery.data as any[]).map((group: any) => group.id);
      
      // Since we need to fetch from multiple groups, use Promise.all
      const eventPromises = groupIds.map(async (groupId: number) => {
        try {
          const response = await fetch(`/api/groups/${groupId}/events`);
          if (!response.ok) {
            return [];
          }
          const events = await response.json();
          // Tag each event with the groupId for display purposes
          return events.map((event: any) => ({
            ...event,
            isGroupEvent: true,
            groupId
          }));
        } catch (error) {
          console.error(`Error fetching events for group ${groupId}:`, error);
          return [];
        }
      });
      
      // Combine all group events
      const groupEventsArrays = await Promise.all(eventPromises);
      const allGroupEvents = groupEventsArrays.flat();
      
      console.log(`Loaded ${allGroupEvents.length} group events from ${groupIds.length} groups`);
      return allGroupEvents;
    },
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Add logging effects for debugging
  useEffect(() => {
    if (facilitiesQuery.data) {
      console.log(
        `Successfully loaded ${facilitiesQuery.data.length} facilities`,
      );

      // Log first facility to see the format
      if (facilitiesQuery.data.length > 0) {
        console.log("First facility data sample:", {
          id: facilitiesQuery.data[0].id,
          name: facilitiesQuery.data[0].name,
          type: facilitiesQuery.data[0].type,
          district: facilitiesQuery.data[0].district,
        });
      }

      // After a slight delay, mark the map as loaded
      setTimeout(() => setMapLoaded(true), 500);
    }

    if (facilitiesQuery.error) {
      console.error("Failed to load facilities:", facilitiesQuery.error);
    }
  }, [facilitiesQuery.data, facilitiesQuery.error]);

  // Add logging effects for events
  useEffect(() => {
    if (eventsQuery.data) {
      console.log(`Successfully loaded ${eventsQuery.data.length} events`);

      // Log first event to see the format
      if (eventsQuery.data.length > 0) {
        console.log("First event data sample:", {
          id: eventsQuery.data[0].id,
          name: eventsQuery.data[0].name,
          sportType: eventsQuery.data[0].sportType,
          facilityId: eventsQuery.data[0].facilityId,
        });
      }
    }

    if (eventsQuery.error) {
      console.error("Failed to load events:", eventsQuery.error);
    }
  }, [eventsQuery.data, eventsQuery.error]);
  
  // Add logging effects for group events
  useEffect(() => {
    if (groupEventsQuery.data) {
      console.log(`Successfully loaded ${groupEventsQuery.data.length} group events`);

      // Log first group event to see the format
      if (groupEventsQuery.data.length > 0) {
        console.log("First group event data sample:", {
          id: groupEventsQuery.data[0].id,
          name: groupEventsQuery.data[0].name,
          groupId: groupEventsQuery.data[0].groupId,
          sportType: groupEventsQuery.data[0].sportType,
          facilityId: groupEventsQuery.data[0].facilityId,
          isGroupEvent: groupEventsQuery.data[0].isGroupEvent,
        });
      }
    }

    if (groupEventsQuery.error) {
      console.error("Failed to load group events:", groupEventsQuery.error);
    }
  }, [groupEventsQuery.data, groupEventsQuery.error]);

  // Update URL based on active tab
  useEffect(() => {
    const currentUrl = window.location.pathname;
    const newUrl =
      activeTab === "facilities"
        ? currentUrl.split("?")[0]
        : `${currentUrl.split("?")[0]}?tab=events`;

    window.history.replaceState(null, "", newUrl);
  }, [activeTab]);

  // Enhanced facility selection handler with logging
  const handleSelectFacility = (id: number) => {
    console.log(`Facility selection handler called with ID: ${id}`);

    // Always set the state, even if it's the same ID as before
    // This prevents the "Rendered fewer hooks than expected" error
    setSelectedFacilityId(id);
    console.log(`Selected facility ID updated to: ${id}`);

    // Check if the facility exists in the loaded data
    if (id !== 0 && facilitiesQuery.data) {
      const selectedFacility = facilitiesQuery.data.find((f) => f.id === id);
      if (selectedFacility) {
        console.log("Selected facility data:", selectedFacility);
      } else {
        console.warn(`Facility with ID ${id} not found in loaded facilities`);
      }
    }
  };

  const handleTabChange = (tab: "facilities" | "events") => {
    setActiveTab(tab);

    // When switching tabs, ensure the querystring is updated
    const newUrl =
      tab === "facilities"
        ? window.location.pathname
        : `${window.location.pathname}?tab=events`;

    window.history.replaceState(null, "", newUrl);

    // If switching to facilities tab, ensure map markers are properly filtered
    if (tab === "facilities" && mapLoaded) {
      console.log("Switched to facilities tab, applying filters:", {
        filterType,
        filterDistrict,
      });
    }
  };

  const handleFilterChange = (type: string, district: string) => {
    console.log("HomePage received new filter values:", { type, district });

    // Update state with the new filter values
    setFilterType(type);
    setFilterDistrict(district);

    // Debug logging for verification
    console.log("HomePage filter state updated to:", {
      newType: type,
      newDistrict: district,
    });
  };

  // Debug current state
  useEffect(() => {
    console.log("Current state:", {
      selectedFacilityId,
      activeTab,
      facilitiesCount: facilitiesQuery.data?.length || 0,
      eventsCount: eventsQuery.data?.length || 0,
      showEvents: activeTab === "events",
      isPanelCollapsed,
    });
  }, [selectedFacilityId, activeTab, facilitiesQuery.data, eventsQuery.data, isPanelCollapsed]);
  
  // Handle panel collapse changes and force map resize
  useEffect(() => {
    // Force map resize after panel state changes
    const resizeTimeout = setTimeout(() => {
      // Dispatch a resize event to ensure the map fills the available space
      window.dispatchEvent(new Event('resize'));
      console.log(`Panel ${isPanelCollapsed ? 'collapsed' : 'expanded'} - forced map resize`);
    }, 350); // Slightly longer than transition duration to ensure it completes
    
    return () => clearTimeout(resizeTimeout);
  }, [isPanelCollapsed]);

  if (facilitiesQuery.isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg text-gray-600">
              Loading Hong Kong Sports Hub...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (facilitiesQuery.error) {
    return (
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <svg
              className="h-12 w-12 text-red-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Error Loading Data
            </h2>
            <p className="text-gray-600 mb-4">
              {facilitiesQuery.error instanceof Error
                ? facilitiesQuery.error.message
                : "Failed to load facilities. Please try again later."}
            </p>
            <button
              onClick={() => facilitiesQuery.refetch()}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Validate and ensure facilities data is in correct format
  const validFacilities =
    facilitiesQuery.data?.map((facility) => {
      return {
        ...facility,
        // Ensure these fields have values for display
        name: facility.name || `Facility ${facility.id}`,
        type: facility.type || "unknown",
        district: facility.district || "unknown",
        // Ensure coordinates exist
        latitude: facility.latitude || 22.283,
        longitude: facility.longitude || 114.159,
      };
    }) || [];

  return (
    <div className="flex flex-col h-screen">
      <Header />

      {/* Main Content Area - Different layout for mobile and desktop
         * For mobile: Map on top, panel below (flex-col)
         * For desktop: Panel on left, map on right (flex-row)
         */}
      <div className="flex flex-col md:flex-row flex-1 w-full relative">
        {/* Map container - On top for mobile, on right for desktop */}
        <div 
          className={`transition-all duration-300 flex-grow order-1 md:order-2 ${
            isPanelCollapsed ? 'w-screen' : 'w-full'
          } ${isMobile ? 'h-[40vh]' : ''}`}
          style={{
            minWidth: "0",
            height: isMobile ? "" : "calc(100vh - 64px)", /* Full height minus header for desktop */
            display: "flex", 
            flexDirection: "column",
            position: "relative", /* Ensure map stays fixed */
            marginLeft: !isPanelCollapsed && !isMobile ? "400px" : "0", /* Match side panel width */
          }}
        >
          <div className="flex-1 relative w-full h-full">
            <MapView
              facilities={validFacilities}
              selectedFacilityId={selectedFacilityId}
              onSelectFacility={handleSelectFacility}
              filterType={filterType}
              filterDistrict={filterDistrict}
              events={eventsQuery.data || []}
              groupEvents={groupEventsQuery.data || []}
              showEvents={activeTab === "events"}
            />
          </div>
        </div>

        {/* Side panel - Below map for mobile, on left for desktop */}
        <div className="order-2 md:order-1 flex-grow md:flex-grow-0">
          <SidePanel
            selectedFacilityId={selectedFacilityId}
            onSelectFacility={handleSelectFacility}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            initialFilterType={filterType}
            initialFilterDistrict={filterDistrict}
            onFilterChange={handleFilterChange}
            onPanelToggle={setIsPanelCollapsed}
            groupEvents={groupEventsQuery.data || []}
          />
        </div>
      </div>
    </div>
  );
}
