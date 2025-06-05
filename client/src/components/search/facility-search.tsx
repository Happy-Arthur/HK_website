import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, MapPin, Clock, Calendar, Download, Building, Users, AlertCircle, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { facilityTypes, districts } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Facility {
  name: string;
  address: string;
  type: string;
  district: string;
  latitude: number;
  longitude: number;
  description?: string;
  openTime?: string;
  closeTime?: string;
  website?: string;
  phone?: string;
}

interface Event {
  name: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  description?: string;
  sportType?: string;
  skillLevel?: string;
  maxParticipants?: number;
  isOfficial?: boolean;
  website?: string;
  imageUrl?: string;
  location?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
}

export function FacilitySearch() {
  const { toast } = useToast();
  const [searchType, setSearchType] = useState("facilities");
  const [facilityType, setFacilityType] = useState("all");
  const [district, setDistrict] = useState("all");
  const [queryText, setQueryText] = useState("");
  const [eventType, setEventType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  
  // Facility search
  const facilitySearchQuery = useQuery<Facility[]>({
    queryKey: ["/api/external/search/facilities", queryText, facilityType, district],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryText) params.append("query", queryText);
      if (facilityType !== "all") params.append("type", facilityType);
      if (district !== "all") params.append("district", district);
      
      const res = await apiRequest(
        "GET", 
        `/api/external/search/facilities?${params.toString()}`
      );
      return await res.json();
    },
    enabled: false,
  });
  
  // Event search
  const eventSearchQuery = useQuery<Event[]>({
    queryKey: ["/api/external/search/events", queryText, eventType, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryText) params.append("query", queryText);
      if (eventType !== "all") params.append("type", eventType);
      if (dateRange !== "all") params.append("dateRange", dateRange);
      
      const res = await apiRequest(
        "GET", 
        `/api/external/search/events?${params.toString()}`
      );
      
      // Get the data from the response
      const events = await res.json();
      
      // Filter the events based on the filters
      return events.filter((event: Event) => {
        // Text search
        if (queryText && !event.name?.toLowerCase().includes(queryText.toLowerCase()) && 
            !event.description?.toLowerCase().includes(queryText.toLowerCase())) {
          return false;
        }
        
        // Sport type filter
        if (eventType !== "all" && event.sportType !== eventType) {
          return false;
        }
        
        // Date range filter
        if (dateRange !== "all") {
          const eventDate = new Date(event.eventDate);
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          const nextMonth = new Date();
          nextMonth.setMonth(today.getMonth() + 1);
          
          if (dateRange === "this-week" && (eventDate < today || eventDate > nextWeek)) {
            return false;
          } else if (dateRange === "this-month" && (eventDate < today || eventDate > nextMonth)) {
            return false;
          } else if (dateRange === "upcoming" && eventDate < today) {
            return false;
          }
        }
        
        return true;
      });
    },
    enabled: false,
  });
  
  // Import facility
  const importFacilityMutation = useMutation({
    mutationFn: async (facility: Facility) => {
      const res = await apiRequest("POST", "/api/external/import/facility", facility);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Facility imported",
        description: `Successfully imported ${data.facility.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Import event
  const importEventMutation = useMutation({
    mutationFn: async (event: Event) => {
      const res = await apiRequest("POST", "/api/external/import/event", event);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Event imported",
        description: `Successfully imported ${data.event.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleSearch = () => {
    if (searchType === "facilities") {
      facilitySearchQuery.refetch();
    } else {
      eventSearchQuery.refetch();
    }
  };
  
  const handleImportFacility = (facility: Facility) => {
    importFacilityMutation.mutate(facility);
  };
  
  const handleImportEvent = (event: Event) => {
    importEventMutation.mutate(event);
  };
  
  
  return (
    <div className="space-y-4">
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <AlertTitle>External Search Simulation</AlertTitle>
        <AlertDescription>
          This feature currently uses simulated data. To integrate with real external APIs like Google Maps, Foursquare, or Hong Kong government databases, 
          API keys need to be added to the system environment. Admin privileges will be required to set up these integrations.
        </AlertDescription>
      </Alert>
    
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between">
            <span>External Data Search</span>
            <Badge variant="outline" className="text-xs">
              Simulated API
            </Badge>
          </CardTitle>
          <CardDescription>
            Search and import facilities and events from external sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={setSearchType}>
            <TabsList className="mb-4">
              <TabsTrigger value="facilities" className="flex gap-1">
                <Building className="h-4 w-4" />
                Facilities
              </TabsTrigger>
              <TabsTrigger value="events" className="flex gap-1">
                <Calendar className="h-4 w-4" />
                Events
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="facilities">
              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="Search facilities..."
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="flex-1"
                    />
                    
                    <Select 
                      value={facilityType} 
                      onValueChange={setFacilityType}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Facility Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {facilityTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={district} 
                      onValueChange={setDistrict}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="District" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district.split('_').map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button onClick={handleSearch} className="flex-shrink-0">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4 mt-4">
                  {facilitySearchQuery.isFetching ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : facilitySearchQuery.isError ? (
                    <div className="text-center text-red-500 p-4">
                      Error: {facilitySearchQuery.error.message}
                    </div>
                  ) : facilitySearchQuery.data && Array.isArray(facilitySearchQuery.data) && facilitySearchQuery.data.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-medium">
                        Found {facilitySearchQuery.data.length} facilities
                      </h3>
                      
                      {facilitySearchQuery.data.map((facility, index) => (
                        <Card key={index} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            <div className="p-4 flex-1">
                              <h3 className="text-lg font-medium flex items-center gap-2">
                                {facility.name}
                                <Badge variant="outline" className="capitalize ml-2">
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
                                      {facility.openTime} - {facility.closeTime}
                                    </span>
                                  </div>
                                )}
                                
                                {facility.description && (
                                  <p className="mt-2">{facility.description}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="p-4 bg-gray-50 flex flex-col justify-center items-center md:w-[180px]">
                              <Button 
                                onClick={() => handleImportFacility(facility)}
                                className="w-full"
                                disabled={importFacilityMutation.isPending}
                              >
                                {importFacilityMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                Import
                              </Button>
                              
                              {facility.website && (
                                <a 
                                  href={facility.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 text-sm text-blue-500 flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Website
                                </a>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : facilitySearchQuery.isSuccess ? (
                    <div className="text-center p-8 text-muted-foreground">
                      No facilities found matching your search criteria.
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="events">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Search events..."
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    className="flex-1"
                  />
                  
                  <Select 
                    value={eventType} 
                    onValueChange={setEventType}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sport Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {facilityTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={dateRange} 
                    onValueChange={setDateRange}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Date Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="upcoming">All Upcoming</SelectItem>
                      <SelectItem value="this-week">This Week</SelectItem>
                      <SelectItem value="this-month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button onClick={handleSearch} className="flex-shrink-0">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
                
                <div className="space-y-4 mt-4">
                  {eventSearchQuery.isFetching ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : eventSearchQuery.isError ? (
                    <div className="text-center text-red-500 p-4">
                      Error: {eventSearchQuery.error.message}
                    </div>
                  ) : eventSearchQuery.data && Array.isArray(eventSearchQuery.data) && eventSearchQuery.data.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-medium">
                        Found {eventSearchQuery.data.length} events
                      </h3>
                      
                      {eventSearchQuery.data.map((event, index) => (
                        <Card key={index} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            {event.imageUrl && (
                              <div className="md:w-[200px] h-[180px] overflow-hidden">
                                <img 
                                  src={event.imageUrl} 
                                  alt={event.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="p-4 flex-1">
                              <h3 className="text-lg font-medium flex items-center gap-2">
                                {event.name}
                                {event.sportType && (
                                  <Badge variant="outline" className="capitalize ml-2">
                                    {event.sportType}
                                  </Badge>
                                )}
                                {event.isOfficial && (
                                  <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">
                                    Official
                                  </Badge>
                                )}
                              </h3>
                              
                              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 flex-shrink-0" />
                                  <span>
                                    {new Date(event.eventDate).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'})}, {event.startTime} - {event.endTime}
                                  </span>
                                </div>
                                
                                {event.location && (
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                      {event.location.name}, {event.location.address}
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({event.location.latitude.toFixed(4)}, {event.location.longitude.toFixed(4)})
                                      </span>
                                    </span>
                                  </div>
                                )}
                                
                                {event.website && (
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                    <a 
                                      href={event.website} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      Official Website
                                    </a>
                                  </div>
                                )}
                                
                                {event.skillLevel && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 flex-shrink-0" />
                                    <span className="capitalize">
                                      {event.skillLevel} skill level
                                      {event.maxParticipants && ` • Max ${event.maxParticipants} participants`}
                                    </span>
                                  </div>
                                )}
                                
                                {event.description && (
                                  <p className="mt-2">{event.description}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="p-4 bg-gray-50 flex flex-col justify-center items-center md:w-[180px]">
                              <Button 
                                onClick={() => handleImportEvent(event)}
                                className="w-full"
                                disabled={importEventMutation.isPending}
                              >
                                {importEventMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                Import Event
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : eventSearchQuery.isSuccess ? (
                    <div className="text-center p-8 text-muted-foreground">
                      No events found matching your search criteria.
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground flex flex-col items-start">
          <div>
            <strong>Note:</strong> Imported facilities and events will be added to the platform database.
          </div>
          <div className="mt-1">
            To connect to real external APIs, specific API keys need to be configured in the system.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}