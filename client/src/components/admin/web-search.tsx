import React, { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { debounce } from "lodash";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Plus,
  MapPin,
  Calendar,
  Clock,
  Download,
  AlertCircle,
  ExternalLink,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Constants for form options
const FACILITY_TYPES = [
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "tennis", label: "Tennis" },
  { value: "badminton", label: "Badminton" },
  { value: "swimming", label: "Swimming" },
  { value: "running", label: "Running" },
  { value: "fitness", label: "Fitness" },
  { value: "other", label: "Other" },
];

const DISTRICTS = [
  { value: "central", label: "Central" },
  { value: "eastern", label: "Eastern" },
  { value: "southern", label: "Southern" },
  { value: "wanchai", label: "Wan Chai" },
  { value: "kowloon_city", label: "Kowloon City" },
  { value: "kwun_tong", label: "Kwun Tong" },
  { value: "sham_shui_po", label: "Sham Shui Po" },
  { value: "wong_tai_sin", label: "Wong Tai Sin" },
  { value: "yau_tsim_mong", label: "Yau Tsim Mong" },
  { value: "islands", label: "Islands" },
  { value: "kwai_tsing", label: "Kwai Tsing" },
  { value: "north", label: "North" },
  { value: "sai_kung", label: "Sai Kung" },
  { value: "sha_tin", label: "Sha Tin" },
  { value: "tai_po", label: "Tai Po" },
  { value: "tsuen_wan", label: "Tsuen Wan" },
  { value: "tuen_mun", label: "Tuen Mun" },
  { value: "yuen_long", label: "Yuen Long" },
];

const EVENT_CATEGORIES = [
  { value: "competition", label: "Competition" },
  { value: "lessons", label: "Lessons" },
  { value: "watching", label: "Watching a Match" },
  { value: "practice", label: "Practice" },
  { value: "social", label: "Social" },
];

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
  { value: "all_levels", label: "All Levels" },
];

interface WebSearchProps {
  onAddSuccess?: () => void;
}

// Define facility and event types
interface FacilityResult {
  id?: number;
  name: string;
  type: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  searchSource: string;
  openTime?: string;
  closeTime?: string;
  website?: string;
}

interface EventResult {
  id?: number;
  name: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  sportType: string;
  category: string;
  description: string;
  skillLevel?: string;
  maxParticipants?: number;
  searchSource: string;
  location?: {
    name: string;
    address?: string;
  };
  website?: string;
  imageUrl?: string;
  isOfficial?: boolean;
}

const WebSearch = ({ onAddSuccess }: WebSearchProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("facilities");
  const [searchQuery, setSearchQuery] = useState("");
  const [facilityType, setFacilityType] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [eventCategory, setEventCategory] = useState("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  // State to hold search results
  const [facilityResults, setFacilityResults] = useState<FacilityResult[]>([]);
  const [eventResults, setEventResults] = useState<EventResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventResult | null>(null);

  // Import facility mutation
  const importFacilityMutation = useMutation({
    mutationFn: async (data: FacilityResult) => {
      const res = await apiRequest(
        "POST",
        "/api/external/import/facility",
        data,
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Facility imported successfully",
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: [
          "/api/facilities",
          searchQuery,
          facilityType,
          districtFilter,
        ],
      });
      if (onAddSuccess) onAddSuccess();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import event mutation
  const importEventMutation = useMutation({
    mutationFn: async (data: EventResult) => {
      const res = await apiRequest("POST", "/api/external/import/event", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event imported successfully",
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      if (onAddSuccess) onAddSuccess();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Search facilities using Google Maps API
  const searchFacilities = async () => {
    setIsSearching(true);
    try {
      // Build URL parameters
      const params = new URLSearchParams();
      if (facilityType !== "all") params.append("type", facilityType);
      if (districtFilter !== "all") params.append("district", districtFilter);
      if (searchQuery) params.append("query", searchQuery);

      // Make the API request to the Google Places-powered endpoint
      const response = await fetch(
        `/api/external/search/facilities?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to search facilities");
      }

      const data = await response.json();
      setFacilityResults(data);

      if (data.length === 0) {
        toast({
          title: "No facilities found",
          description:
            "Try adjusting your search criteria or try a different search term.",
        });
      } else {
        toast({
          title: `Found ${data.length} facilities`,
          description: "Results are from Google Maps API.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error searching facilities:", error);
      toast({
        title: "Search Failed",
        description: "Failed to search facilities. Please try again later.",
        variant: "destructive",
      });

      // Clear previous results
      setFacilityResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Search events
  const searchEvents = async () => {
    setIsSearching(true);
    setSelectedEvent(null);

    try {
      // Build URL parameters
      const params = new URLSearchParams();
      if (eventType !== "all") params.append("type", eventType);
      if (eventCategory !== "all") params.append("category", eventCategory);
      if (searchQuery) params.append("query", searchQuery);

      if (fromDate) {
        params.append("from", format(fromDate, "yyyy-MM-dd"));
      }

      if (toDate) {
        params.append("to", format(toDate, "yyyy-MM-dd"));
      }

      // Make the API request
      const response = await fetch(
        `/api/external/search/events?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to search events");
      }

      const data = await response.json();
      setEventResults(data);

      if (data.length === 0) {
        toast({
          title: "No events found",
          description:
            "Try adjusting your search criteria or try a different search term.",
        });
      }
    } catch (error) {
      console.error("Error searching events:", error);
      toast({
        title: "Search Failed",
        description: "Failed to search events. Please try again later.",
        variant: "destructive",
      });

      // Set mock data for demonstration
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      setEventResults([
        {
          name: "Volleyball Nations League Hong Kong 2025",
          eventDate: format(nextMonth, "yyyy-MM-dd"),
          startTime: "09:00",
          endTime: "18:00",
          sportType: "other",
          category: "competition",
          description: "Annual volleyball tournament for local teams",
          skillLevel: "intermediate",
          maxParticipants: 120,
          searchSource: "simulated",
          location: {
            name: "Hong Kong Coliseum",
            address: "Hong Kong",
          },
        },
        {
          name: "**Date:** 18 to 22 June 2025",
          eventDate: format(nextWeek, "yyyy-MM-dd"),
          startTime: "09:00",
          endTime: "18:00",
          sportType: "other",
          category: "competition",
          description: "International sports event in Hong Kong",
          skillLevel: "all_levels",
          searchSource: "simulated",
          location: {
            name: "Hong Kong Stadium",
            address: "Hong Kong",
          },
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to handle search
  const handleSearch = () => {
    if (activeTab === "facilities") {
      searchFacilities();
    } else {
      searchEvents();
    }
  };

  // Function to automatically search when inputs change
  const autoSearch = useCallback(
    debounce(() => {
      if (
        searchQuery.trim().length > 2 ||
        facilityType !== "all" ||
        districtFilter !== "all" ||
        eventType !== "all" ||
        eventCategory !== "all" ||
        fromDate ||
        toDate
      ) {
        handleSearch();
      }
    }, 500),
    [
      searchQuery,
      facilityType,
      districtFilter,
      eventType,
      eventCategory,
      fromDate,
      toDate,
      activeTab,
    ],
  );

  // Add useEffect to automatically search when inputs change
  useEffect(() => {
    autoSearch();
    // Cleanup function for debounce
    return () => {
      autoSearch.cancel();
    };
  }, [autoSearch]);

  // Helper function to get label from value
  const getLabelFromValue = (
    value: string,
    options: { value: string; label: string }[],
  ) => {
    const option = options.find((opt) => opt.value === value);
    return option ? option.label : value;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  // Correct event name if it contains date information
  const cleanEventName = (event: EventResult) => {
    let name = event.name;

    // Check if name contains "**Date:**" (from the sample data)
    if (name.includes("**Date:**")) {
      // This is a date, not a name - extract proper event title from description or create a generic one
      if (event.description && event.description.length > 0) {
        // Use first part of description as name
        const parts = event.description.split(" - ");
        name = parts[0];
      } else {
        // Create a generic name
        name = `Sports Event ${formatDate(event.eventDate)}`;
      }
    }

    return name;
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-500" />
        <AlertTitle>External Search API Integration</AlertTitle>
        <AlertDescription>
          Facility search now uses the Google Maps/Places API for real location
          data. Event search still uses the Perplexity API. Both require API
          keys to function properly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between">
            <span>External Data Search</span>
            <Badge
              variant="outline"
              className="text-xs bg-green-50 text-green-700 border-green-200"
            >
              Google Maps API
            </Badge>
          </CardTitle>
          <CardDescription>
            Search and import facilities and events from external sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="facilities" className="flex gap-1">
                <MapPin className="h-4 w-4" />
                Facilities
              </TabsTrigger>
              <TabsTrigger value="events" className="flex gap-1">
                <Calendar className="h-4 w-4" />
                Events
              </TabsTrigger>
            </TabsList>

            <TabsContent value="facilities">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Search facilities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />

                  <Select value={facilityType} onValueChange={setFacilityType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Facility Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {FACILITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={districtFilter}
                    onValueChange={setDistrictFilter}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="District" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {DISTRICTS.map((district) => (
                        <SelectItem key={district.value} value={district.value}>
                          {district.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button onClick={handleSearch} className="flex-shrink-0">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                <div className="space-y-4 mt-4">
                  {isSearching ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : facilityResults.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-medium">
                        Found {facilityResults.length} facilities
                      </h3>

                      {facilityResults.map((facility, index) => (
                        <Card key={index} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            <div className="p-4 flex-1">
                              <h3 className="text-lg font-medium flex items-center gap-2">
                                {facility.name}
                                <Badge
                                  variant="outline"
                                  className="capitalize ml-2"
                                >
                                  {facility.type}
                                </Badge>
                              </h3>

                              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  <span>{facility.address}</span>
                                </div>

                                {facility.openTime && facility.closeTime && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 flex-shrink-0" />
                                    <span>
                                      Open: {facility.openTime} -{" "}
                                      {facility.closeTime}
                                    </span>
                                  </div>
                                )}

                                <div className="mt-2 line-clamp-2">
                                  {facility.description}
                                </div>
                              </div>
                            </div>

                            <div className="p-4 flex flex-col justify-between border-t md:border-t-0 md:border-l border-border bg-muted/20">
                              <Badge
                                variant="outline"
                                className="self-start mb-4"
                              >
                                {getLabelFromValue(
                                  facility.district,
                                  DISTRICTS,
                                )}
                              </Badge>

                              <Button
                                onClick={() =>
                                  importFacilityMutation.mutate(facility)
                                }
                                variant="outline"
                                disabled={importFacilityMutation.isPending}
                                className="w-full"
                              >
                                {importFacilityMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Importing...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Import Facility
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="events">
              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sport Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {FACILITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={eventCategory}
                      onValueChange={setEventCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Event Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {EVENT_CATEGORIES.map((category) => (
                          <SelectItem
                            key={category.value}
                            value={category.value}
                          >
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal flex-1",
                            !fromDate && "text-muted-foreground",
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {fromDate ? (
                            format(fromDate, "PPP")
                          ) : (
                            <span>From Date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={fromDate}
                          onSelect={setFromDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal flex-1",
                            !toDate && "text-muted-foreground",
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {toDate ? (
                            format(toDate, "PPP")
                          ) : (
                            <span>To Date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={toDate}
                          onSelect={setToDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Button onClick={handleSearch} className="w-full sm:w-auto">
                      {isSearching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Search Events
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  {isSearching ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : selectedEvent ? (
                    <div className="space-y-4">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedEvent(null)}
                        className="mb-2"
                      >
                        Back to results
                      </Button>

                      <Card>
                        <CardHeader>
                          <CardTitle>{cleanEventName(selectedEvent)}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {formatDate(selectedEvent.eventDate)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {selectedEvent.startTime} -{" "}
                                  {selectedEvent.endTime}
                                </span>
                              </div>

                              {selectedEvent.location && (
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                  <div>
                                    <div>{selectedEvent.location.name}</div>
                                    {selectedEvent.location.address && (
                                      <div className="text-sm text-muted-foreground">
                                        {selectedEvent.location.address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {selectedEvent.maxParticipants && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    Max Participants:{" "}
                                    {selectedEvent.maxParticipants}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Badge variant="outline" className="mr-2">
                                {selectedEvent.sportType || "General"}
                              </Badge>
                              <Badge variant="outline" className="mr-2">
                                {selectedEvent.category}
                              </Badge>
                              {selectedEvent.skillLevel && (
                                <Badge variant="outline">
                                  {selectedEvent.skillLevel}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Description
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {selectedEvent.description}
                            </p>
                          </div>

                          {selectedEvent.website && (
                            <div>
                              <a
                                href={selectedEvent.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 flex items-center hover:underline"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Visit website
                              </a>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter>
                          <Button
                            onClick={() =>
                              importEventMutation.mutate(selectedEvent)
                            }
                            disabled={importEventMutation.isPending}
                          >
                            {importEventMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                Import Event
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  ) : eventResults.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-medium">
                        Found {eventResults.length} events
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventResults.map((event, index) => (
                          <Card
                            key={index}
                            className="flex flex-col overflow-hidden"
                          >
                            <div className="p-4 flex-1">
                              <h3 className="text-lg font-medium">
                                {cleanEventName(event)}
                              </h3>

                              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 flex-shrink-0" />
                                  <span>{formatDate(event.eventDate)}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 flex-shrink-0" />
                                  <span>
                                    {event.startTime} - {event.endTime}
                                  </span>
                                </div>

                                {event.location && (
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>{event.location.name}</span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3">
                                <Badge
                                  variant="outline"
                                  className="capitalize mr-1"
                                >
                                  {event.sportType || "General"}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {event.category}
                                </Badge>
                              </div>
                            </div>

                            <div className="p-4 flex flex-row justify-between items-center border-t border-border mt-auto">
                              <div
                                className="cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => setSelectedEvent(event)}
                              >
                                <div className="mt-3 text-sm text-blue-600">
                                  View details
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground flex flex-col items-start">
          <div>
            <strong>Note:</strong> Imported facilities and events will be added
            to the platform database.
          </div>
          <div className="mt-1">
            To connect to real external APIs, specific API keys need to be
            configured in the system.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default WebSearch;
export { WebSearch };
