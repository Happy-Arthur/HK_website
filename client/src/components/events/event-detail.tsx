// client/src/components/events/event-detail.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Event, Facility } from "@shared/schema";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Calendar,
  Share2,
  Heart,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import RsvpButton from "./rsvp-button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface EventDetailProps {
  event: Event;
  isLoading: boolean;
  onBackToList: () => void;
}

export default function EventDetail({
  event,
  isLoading,
  onBackToList,
}: EventDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFavorite, setIsFavorite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = useIsMobile();

  // Query for facility if the event has a facilityId
  const facilityQuery = useQuery<Facility>({
    queryKey: [`/api/facilities/${event?.facilityId}`],
    enabled: !!event?.facilityId && event.facilityId > 0,
  });

  // Define the RSVP type
  type Rsvp = {
    userId: number;
    eventId: number;
    status: string;
    username: string;
  };

  // Query for RSVPs
  const rsvpsQuery = useQuery<Rsvp[]>({
    queryKey: [`/api/events/${event?.id}/rsvps`],
    enabled: !!event?.id,
  });

  // Format event date
  const formatEventDate = (dateStr: string): string => {
    if (!dateStr) return "Date TBD";
    try {
      const date = parseISO(dateStr);
      return format(date, "EEEE, MMMM d, yyyy");
    } catch (error) {
      console.error("Error formatting event date:", error);
      return dateStr;
    }
  };

  // Format time string (HH:MM) with AM/PM
  const formatTimeString = (timeStr: string): string => {
    if (!timeStr) return "TBD";
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

  // Handle refreshing event data
  const handleRefreshEventData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [`/api/events/${event.id}`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/events/${event.id}/rsvps`],
        }),
        event.facilityId &&
          queryClient.invalidateQueries({
            queryKey: [`/api/facilities/${event.facilityId}`],
          }),
      ]);
    } catch (error) {
      console.error("Error refreshing event data:", error);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Return appropriate color for sport type badge
  const sportTypeBadgeColor = (type: string | null): string => {
    if (!type) return "bg-gray-100 text-gray-800";
    
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
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Return appropriate color for skill level badge
  const skillLevelBadgeColor = (level: string | null): string => {
    if (!level) return "bg-gray-100 text-gray-800";
    
    switch (level) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-red-100 text-red-800";
      case "all_levels":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format sport type for display
  const formatSportType = (type: string | null): string => {
    if (!type) return "General";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Format skill level for display
  const formatSkillLevel = (level: string | null): string => {
    if (!level) return "All Levels";
    return level
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

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

  if (!event) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBackToList}>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to list
        </Button>
        <div className="text-center py-10">
          <h2 className="text-lg font-medium">Event not found</h2>
          <p className="text-sm text-gray-500 mt-1">
            The event you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Calculate attendees count
  const goingCount = rsvpsQuery.data
    ? rsvpsQuery.data.filter((rsvp) => rsvp.status === "going").length
    : 0;
  const interestedCount = rsvpsQuery.data
    ? rsvpsQuery.data.filter((rsvp) => rsvp.status === "interested").length
    : 0;

  // Find current user's RSVP status
  const userRsvp = user && rsvpsQuery.data
    ? rsvpsQuery.data.find((rsvp) => rsvp.userId === user.id)
    : undefined;

  return (
    <div className="flex-1 overflow-y-auto max-h-[calc(100vh-120px)] overscroll-contain">
      <div className="sticky top-0 z-10 bg-white">
        <div className="relative h-48">
          <img
            src="https://images.unsplash.com/photo-1530549387789-4c1017266635?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
            alt={event.name || "Event image"}
            className="w-full h-full object-cover"
          />
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 left-4 bg-white rounded-full shadow-md z-10"
            onClick={onBackToList}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className={cn("p-4", isMobile && "pb-20")}>
        <div className={cn(
          "flex justify-between items-start",
          isMobile && "flex-col gap-2"
        )}>
          <h2 className={cn(
            "text-2xl font-bold",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            {event.name || "Unnamed Event"}
          </h2>
          {event.isOfficial && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Official Event
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center mb-2">
            <Calendar className="w-5 h-5 mr-2 text-gray-500 flex-shrink-0" />
            <span className={cn("text-sm", isMobile && "flex-wrap")}>{formatEventDate(event.eventDate)}</span>
          </div>

          <div className="flex items-center mb-2">
            <Clock className="w-5 h-5 mr-2 text-gray-500 flex-shrink-0" />
            <span className={cn("text-sm", isMobile && "flex-wrap")}>
              {formatTimeString(event.startTime)} -{" "}
              {formatTimeString(event.endTime)}
            </span>
          </div>

          <div className="flex items-start mb-2">
            <MapPin className="w-5 h-5 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
            <span className={cn("text-sm", isMobile && "line-clamp-2")}>
              {facilityQuery.data?.name
                ? `${facilityQuery.data.name}, ${facilityQuery.data.address || ""}`
                : "Location TBA"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <h3 className={cn("font-semibold", isMobile ? "text-base" : "text-lg")}>Event Details</h3>
            {refreshing && (
              <span className="text-xs text-gray-500">Refreshing...</span>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm mb-2">
              {event.description ||
                `${event.name || "This event"} is a ${
                  event.sportType || "sports"
                } event.`}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className={`px-2 py-1 rounded-md text-xs ${sportTypeBadgeColor(
                  event.sportType
                )}`}
              >
                {formatSportType(event.sportType)}
              </span>
              <span
                className={`px-2 py-1 rounded-md text-xs ${skillLevelBadgeColor(
                  event.skillLevel
                )}`}
              >
                {formatSkillLevel(event.skillLevel)}
              </span>
              {event.maxParticipants && (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-xs">
                  Max {event.maxParticipants} participants
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Attendees Section */}
        <div className="mt-6">
          <div className="flex justify-between mb-2">
            <h3 className={cn("font-semibold", isMobile ? "text-base" : "text-lg")}>Attendees</h3>
            <span className="text-xs text-gray-500">
              {goingCount} going, {interestedCount} interested
            </span>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            {rsvpsQuery.data && rsvpsQuery.data.filter(rsvp => rsvp.status === "going").length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {rsvpsQuery.data
                  .filter(rsvp => rsvp.status === "going")
                  .map((rsvp) => (
                    <div 
                      key={`avatar-${rsvp.userId}`}
                      className="flex flex-col items-center"
                    >
                      <Avatar className={cn("mb-1", isMobile ? "h-8 w-8" : "h-10 w-10")}>
                        <AvatarFallback className="bg-primary text-white">
                          {rsvp.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate max-w-[50px]">{rsvp.username}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No attendees yet. Be the first to join!</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className={cn(
          "flex space-x-2", 
          isMobile ? "fixed bottom-0 left-0 right-0 bg-white p-3 border-t shadow-lg z-20" : "mt-6"
        )}>
          <RsvpButton
            eventId={event.id}
            eventName={event.name}
            currentStatus={userRsvp?.status}
            isDetailView={true}
          />

          <Button
            variant="outline"
            size="icon"
            className="p-3"
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: event.name || "Sports Event",
                    text: `Join me at ${event.name || "this sports event"} on Hong Kong Sports Hub!`,
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
            <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
          </Button>
        </div>

        {/* Debug tools */}
        <div className="mt-10 border-t pt-4">
          <details>
            <summary className="cursor-pointer text-sm text-gray-500 mb-2">
              Debug Tools
            </summary>
            <div className="mt-2 space-y-3 p-2 bg-gray-50 rounded-md">
              <div className="text-xs">
                <p>Event ID: {event.id}</p>
                <p>Facility ID: {event.facilityId || "None"}</p>
                <p>Going: {goingCount}</p>
                <p>Interested: {interestedCount}</p>
                <p>
                  User Status: {userRsvp ? userRsvp.status : "Not RSVP'd"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefreshEventData}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Event Data"}
                </Button>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}