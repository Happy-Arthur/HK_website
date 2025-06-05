import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Facility, Event } from "@shared/schema";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Share2,
  Heart,
  RefreshCw,
  Calendar,
  Navigation,
} from "lucide-react";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReviewList from "../reviews/review-list";
import CheckInButton from "./check-in-button";
import CheckInsDisplay from "./checkins-display";
import { CourtAvailabilityManager } from "./court-availability";
import { format } from "date-fns";
import RatingDisplay from "./RatingDisplay";
import RsvpButton from "../events/rsvp-button";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

interface FacilityDetailProps {
  facility: Facility;
  isLoading: boolean;
  onBackToList: () => void;
}

export default function FacilityDetail({
  facility,
  isLoading,
  onBackToList,
}: FacilityDetailProps) {
  const queryClient = useQueryClient();
  const [isFavorite, setIsFavorite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const locationTracking = useLocationTracking();
  const isMobile = useIsMobile();

  // Reference to the content section for scrolling
  const contentRef = useRef<HTMLDivElement>(null);

  // Track scroll position for header effects
  const [scrollPosition, setScrollPosition] = useState(0);

  // Queries for related data
  const ratingQuery = useQuery<{ rating: number; count: number }>({
    queryKey: [`/api/facilities/${facility?.id}/rating`],
    enabled: !!facility?.id,
  });

  const eventsQuery = useQuery<Event[]>({
    queryKey: [`/api/facilities/${facility?.id}/events`],
    queryFn: async () => {
      try {
        if (!facility?.id) return [];

        // Simple fetch approach to avoid any issues
        const response = await fetch(`/api/facilities/${facility.id}/events`);

        if (!response.ok) {
          console.log(`Error fetching events: ${response.status}`);
          return []; // Return empty array on error instead of throwing
        }

        const data = await response.json();
        console.log("Successfully loaded events:", data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error in events query:", error);
        return []; // Return empty array on any error
      }
    },
    enabled: !!facility?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: false, // Don't retry automatically
  });

  // Format district name for display
  const formatDistrict = (district: string): string => {
    if (!district) return "Unknown District";
    return district
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Format time string (HH:MM) with AM/PM
  const formatTimeString = (timeStr: string): string => {
    if (!timeStr) return "N/A";
    try {
      const [hour, minute] = timeStr.split(":").map(Number);
      if (isNaN(hour) || isNaN(minute)) return timeStr;

      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return timeStr;
    }
  };

  // Handle refreshing facility data
  const handleRefreshFacilityData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facility.id}`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facility.id}/rating`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facility.id}/events`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facility.id}/checkins`],
        }),
      ]);

      // Force refetch events
      await queryClient.refetchQueries({
        queryKey: [`/api/facilities/${facility.id}/events`],
      });
    } catch (error) {
      console.error("Error refreshing facility data:", error);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Format facility type for better display
  const formatFacilityType = (type: string): string => {
    if (!type) return "Unknown";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Create a navigation link to Google Maps
  const createNavigationLink = () => {
    if (!facility || !facility.latitude || !facility.longitude) return null;

    return (
      <Button
        size="sm"
        variant="outline"
        className="flex items-center"
        onClick={() => {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
          window.open(url, "_blank");
        }}
      >
        <Navigation className="w-4 h-4 mr-1" />
        <span className="text-sm">Navigate</span>
      </Button>
    );
  };

  // Return appropriate color for facility type badge
  const facilityTypeBadgeColor = (type: string): string => {
    switch (type) {
      case "basketball":
        return "bg-orange-100 text-orange-800";
      case "soccer":
        return "bg-green-100 text-green-800";
      case "swimming":
        return "bg-blue-100 text-blue-800";
      case "tennis":
        return "bg-yellow-100 text-yellow-800";
      case "badminton":
        return "bg-purple-100 text-purple-800";
      case "running":
        return "bg-green-100 text-green-800";
      case "fitness":
        return "bg-red-100 text-red-800";
      case "sports_ground":
        return "bg-blue-100 text-blue-800";
      case "sports_centre":
        return "bg-violet-100 text-violet-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isOpen = (): boolean => {
    if (!facility?.openTime || !facility?.closeTime) return false;

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Parse open time
      const [openHour, openMinute] = facility.openTime.split(":").map(Number);
      const [closeHour, closeMinute] = facility.closeTime
        .split(":")
        .map(Number);

      // Convert current time to minutes since midnight
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      const openTimeInMinutes = openHour * 60 + openMinute;
      const closeTimeInMinutes = closeHour * 60 + closeMinute;

      // Check if current time falls between open and close times
      if (closeTimeInMinutes > openTimeInMinutes) {
        // Normal case (e.g., 9:00 - 17:00)
        return (
          currentTimeInMinutes >= openTimeInMinutes &&
          currentTimeInMinutes < closeTimeInMinutes
        );
      } else {
        // Overnight case (e.g., 22:00 - 6:00)
        return (
          currentTimeInMinutes >= openTimeInMinutes ||
          currentTimeInMinutes < closeTimeInMinutes
        );
      }
    } catch (error) {
      console.error("Error checking if facility is open:", error);
      return false;
    }
  };

  // Update user's location periodically while viewing facility
  useEffect(() => {
    if (facility?.id) {
      // Start location tracking if not already running
      locationTracking.startTracking();

      // Set an interval to update location
      const locationUpdateInterval = setInterval(async () => {
        if (locationTracking.position) {
          try {
            // Update with current location and facility ID
            await locationTracking.updateLocation(
              locationTracking.position.lat,
              locationTracking.position.lng,
            );

            // Refresh check-ins data after location update
            queryClient.invalidateQueries({
              queryKey: [`/api/facilities/${facility.id}/checkins`],
            });
          } catch (error) {
            console.error("Error updating location:", error);
          }
        }
      }, 30000); // Update every 30 seconds

      // Clean up when component unmounts
      return () => {
        clearInterval(locationUpdateInterval);
        locationTracking.stopTracking();
      };
    }
  }, [facility?.id, locationTracking, queryClient]);

  // Handle scroll events to adjust header
  useEffect(() => {
    if (!contentRef.current) return;

    const handleScroll = () => {
      if (contentRef.current) {
        setScrollPosition(contentRef.current.scrollTop);
      }
    };

    const contentElement = contentRef.current;
    contentElement.addEventListener("scroll", handleScroll);

    return () => {
      contentElement.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Force fetch events when component mounts
  useEffect(() => {
    if (facility?.id) {
      // Force data refresh for events when component mounts
      const fetchEvents = async () => {
        try {
          await queryClient.invalidateQueries({
            queryKey: [`/api/facilities/${facility.id}/events`],
          });
          await queryClient.refetchQueries({
            queryKey: [`/api/facilities/${facility.id}/events`],
            exact: true,
          });
        } catch (error) {
          console.error("Error fetching events:", error);
        }
      };

      fetchEvents();
    }
  }, [facility?.id, queryClient]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="icon" onClick={onBackToList}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-6 w-48 ml-2" />
        </div>
        <Skeleton className="h-48 w-full rounded-md mb-4" />
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBackToList}>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to list
        </Button>
        <div className="text-center py-10">
          <h2 className="text-lg font-medium">Facility not found</h2>
          <p className="text-sm text-gray-500 mt-1">
            The facility you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Use rating data from the query if available, otherwise fall back to facility data
  const displayRating =
    ratingQuery.data?.rating ?? facility.averageRating ?? null;
  const reviewCount = ratingQuery.data?.count ?? facility.totalReviews ?? 0;

  // Calculate header opacity based on scroll position (fade out effect)
  const headerOpacity = Math.max(0, 1 - scrollPosition / 100);
  const headerHeight = Math.max(60, 180 - scrollPosition); // Shrink the header as user scrolls

  // Log events for debugging
  console.log("Events for facility:", eventsQuery.data);

  return (
    <div className="flex-1 flex flex-col h-full relative z-[999]">
      {/* Sticky back button - always visible */}
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 left-2 z-50 bg-white rounded-full shadow-md"
        onClick={onBackToList}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Facility image header with dynamic height */}
      <div
        className="absolute top-0 left-0 right-0 z-10 transition-all duration-200"
        style={{
          height: `${headerHeight}px`,
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <img
          src={
            facility.imageUrl ||
            "https://images.unsplash.com/photo-1531001142987-e06d2648f8e7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
          }
          alt={facility.name || "Facility image"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Scrollable content area - pushes content above the fold */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto z-20 bg-white rounded-t-3xl shadow-lg mt-20 relative"
        style={{
          minHeight: isMobile ? "calc(100% - 60px)" : "calc(100% - 100px)",
          maxHeight: isMobile ? "calc(100% - 20px)" : "calc(100% - 60px)",
        }}
      >
        <div className="p-4 pb-24">
          {/* Facility title and status */}
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-xl font-bold">
              {facility.name || "Unnamed Facility"}
            </h1>
            <span
              className={`${
                isOpen()
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              } text-xs px-2 py-1 rounded-full`}
            >
              {isOpen() ? "Open Now" : "Closed"}
            </span>
          </div>

          {/* Rating display */}
          <div className="mb-4">
            <RatingDisplay
              rating={displayRating}
              reviewCount={reviewCount}
              size="md"
              showEmpty={true}
            />
          </div>

          {/* Check-In Button - Prominently positioned at the top */}
          <div className="mb-4">
            <CheckInButton
              facilityId={facility.id}
              facilityName={facility.name || "this facility"}
            />
          </div>

          {/* Basic facility info */}
          <div className="bg-gray-50 p-3 rounded-md mb-4">
            <div className="flex items-center mb-2">
              <MapPin className="w-5 h-5 mr-2 text-gray-500" />
              <span>
                {facility.address ||
                  `${formatDistrict(facility.district)}, Hong Kong`}
              </span>
            </div>

            {facility.openTime && facility.closeTime && (
              <div className="flex items-center mb-2">
                <Clock className="w-5 h-5 mr-2 text-gray-500" />
                <span>
                  Open: {formatTimeString(facility.openTime)} -{" "}
                  {formatTimeString(facility.closeTime)}
                </span>
              </div>
            )}

            {facility.contactPhone && (
              <div className="flex items-center">
                <Phone className="w-5 h-5 mr-2 text-gray-500" />
                <span>{facility.contactPhone}</span>
              </div>
            )}
          </div>

          {/* Recent Check-ins */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg text-primary">
                Recent Check-ins
              </h3>
            </div>
            <div className="bg-primary/5 p-3 rounded-md border border-primary/10 shadow-sm">
              <CheckInsDisplay facilityId={facility.id} />
            </div>
          </div>

          {/* Court Availability */}
          {facility.type &&
            facility.type !== "running" &&
            facility.type !== "fitness" && (
              <div className="mb-4">
                <CourtAvailabilityManager
                  facilityId={facility.id}
                  sportType={facility.type}
                />
              </div>
            )}

          {/* Facility Details */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg">Facility Details</h3>
              {refreshing && (
                <span className="text-xs text-gray-500">Refreshing...</span>
              )}
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm mb-2">
                {facility.description ||
                  `${facility.name || "This facility"} is a sports facility located in ${formatDistrict(facility.district)}.`}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className={`px-2 py-1 rounded-md text-xs ${facilityTypeBadgeColor(facility.type)}`}
                >
                  {formatFacilityType(facility.type)}
                </span>
                {facility.courts && facility.courts > 0 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-xs">
                    {facility.courts} Courts
                  </span>
                )}
                {Array.isArray(facility.amenities) &&
                  facility.amenities.length > 0 &&
                  facility.amenities.map((amenity, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs"
                    >
                      {amenity
                        .split("_")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ")}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="mb-4">
            <ReviewList facilityId={facility.id} />
          </div>

          {/* Upcoming Events Section with Fallback */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-lg">Upcoming Events</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => {
                  // Simple manual refetch
                  eventsQuery.refetch();
                }}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${eventsQuery.isRefetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {/* Events list with simplified error handling */}
            <div className="bg-gray-50 p-3 rounded-md">
              {eventsQuery.isLoading ? (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-500">Loading events...</p>
                </div>
              ) : (
                <>
                  {Array.isArray(eventsQuery.data) &&
                  eventsQuery.data.length > 0 ? (
                    <>
                      {eventsQuery.data.slice(0, 3).map((event) => (
                        <div
                          key={event.id || Math.random()}
                          className="border border-gray-200 rounded-md p-3 mb-3 bg-white hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            console.log("Navigating to event:", event.id);
                            window.location.href = `/events/${event.id}`;
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="bg-amber-500 rounded-lg w-12 h-12 flex flex-col items-center justify-center mr-3 text-white">
                                <span className="text-xs font-medium">
                                  {event.eventDate
                                    ? format(
                                        new Date(event.eventDate),
                                        "MMM",
                                      ).toUpperCase()
                                    : "TBD"}
                                </span>
                                <span className="text-lg font-bold">
                                  {event.eventDate
                                    ? format(new Date(event.eventDate), "d")
                                    : "--"}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {event.name || "Unnamed Event"}
                                </h4>
                                <div className="text-sm text-gray-500">
                                  {event.startTime
                                    ? formatTimeString(event.startTime)
                                    : "TBD"}{" "}
                                  -{" "}
                                  {event.endTime
                                    ? formatTimeString(event.endTime)
                                    : "TBD"}
                                </div>
                              </div>
                            </div>
                            {event.id && (
                              <RsvpButton
                                eventId={event.id}
                                eventName={event.name || "Event"}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-sm text-gray-500">
                        No upcoming events found
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 mb-2">
            <Button
              variant="outline"
              size="icon"
              className="p-3"
              onClick={() => {
                try {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: facility.name || "Sports Facility",
                        text: `Check out ${facility.name || "this sports facility"} on YukHaLa!`,
                        url: window.location.href,
                      })
                      .catch((err) => console.log("Error sharing:", err));
                  } else {
                    // Fallback if Web Share API is not available
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => alert("Link copied to clipboard!"))
                      .catch((err) => console.error("Failed to copy: ", err));
                  }
                } catch (err) {
                  console.error("Share error:", err);
                }
              }}
            >
              <Share2 className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className={`p-3 ${isFavorite ? "text-red-500" : ""}`}
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart
                className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`}
              />
            </Button>

            {createNavigationLink()}

            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshFacilityData}
              disabled={refreshing}
              className="ml-auto"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
