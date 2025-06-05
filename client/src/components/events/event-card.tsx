import type { Event } from "@shared/schema";
import { facilities } from "@shared/schema";
import { MapPin, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import RsvpButton from "./rsvp-button";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Define interface for facility query response
  interface FacilityResponse {
    id: number;
    name: string;
    type: string;
    district: string;
    address: string;
    latitude: number;
    longitude: number;
    [key: string]: any; // For other properties we might not need
  }

  const facilityQuery = useQuery<FacilityResponse>({
    queryKey: [`/api/facilities/${event.facilityId}`],
    enabled: !!event.facilityId,
  });

  // Define the RSVP type
  interface EventRSVP {
    eventId: number;
    userId: number;
    status: string;
    username: string;
  }

  const rsvpsQuery = useQuery<EventRSVP[]>({
    queryKey: [`/api/events/${event.id}/rsvps`],
  });
  
  // Handle click to navigate to event details page
  const navigateToEventDetails = (e: React.MouseEvent) => {
    // Prevent event bubbling if the click was on a button, dropdown or any interactive element
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('[role="button"]') || 
      target.closest('[data-radix-dropdown-menu]') ||
      target.closest('.dropdown-menu-item') ||
      target.closest('[role="menuitem"]')
    ) {
      e.stopPropagation();
      return;
    }
    console.log("Navigating to event details:", event.id);
    setLocation(`/events/${event.id}`);
  };

  // RSVP handling is now done in the RsvpButton component

  // Fixed function to safely format time strings and handle invalid values
  const formatTimeString = (timeString: string | null | undefined) => {
    if (!timeString) return "TBA";

    try {
      // Ensure the time string has a valid format (HH:MM or HH:MM:SS)
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
        return timeString; // Return as is if not in expected format
      }

      // Split and parse the time components
      const [hours, minutes] = timeString.split(":").map(Number);

      // Validate the components
      if (
        isNaN(hours) ||
        isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return timeString; // Return as is if components are invalid
      }

      // Create a valid date object for today with the time components
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);

      // Format the time
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting time:", error, timeString);
      return timeString || "TBA"; // Fallback to the original or "TBA"
    }
  };

  // Safe function to format date
  const formatEventDate = (dateString: string | null | undefined) => {
    if (!dateString) return "TBA";

    try {
      // Try to parse the date string
      const date = parseISO(dateString);
      return format(date, "MMM d"); // Format as "Jan 1"
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "TBA";
    }
  };

  const eventTypeBadgeColor = () => {
    if (!event.sportType) return "bg-gray-100 text-gray-800";

    switch (event.sportType) {
      case "basketball":
        return "bg-orange-100 text-orange-800";
      case "soccer":
        return "bg-green-100 text-green-800";
      case "tennis":
        return "bg-blue-100 text-blue-800";
      case "badminton":
        return "bg-purple-100 text-purple-800";
      case "swimming":
        return "bg-blue-100 text-blue-800";
      case "running":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Safe function to format sport type
  const formatSportType = (type: string | undefined): string => {
    if (!type) return "General";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const skillLevelBadgeColor = () => {
    if (!event.skillLevel) return "bg-indigo-100 text-indigo-800";

    switch (event.skillLevel) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-blue-100 text-blue-800";
      case "advanced":
        return "bg-purple-100 text-purple-800";
      case "expert":
        return "bg-red-100 text-red-800";
      case "all_levels":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-indigo-100 text-indigo-800";
    }
  };

  const formatSkillLevel = (level: string | undefined) => {
    if (!level) return "All Levels";

    return level
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div 
      className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={navigateToEventDetails}
    >
      <div className="flex items-center">
        <div className="bg-amber-500 rounded-lg w-14 h-14 flex flex-col items-center justify-center mr-3 text-white">
          <span className="text-xs font-medium">
            {/* Safely format the month */}
            {event.eventDate
              ? formatEventDate(event.eventDate).split(" ")[0].toUpperCase()
              : "TBA"}
          </span>
          <span className="text-lg font-bold">
            {/* Safely format the day */}
            {event.eventDate
              ? formatEventDate(event.eventDate).split(" ")[1]
              : ""}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{event.name}</h3>
          <div className="flex items-center mt-1 text-sm text-gray-500">
            <MapPin className="w-4 h-4 mr-1" />
            <span>{facilityQuery.data?.name || "Location TBA"}</span>
          </div>
          <div className="flex items-center mt-1 text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-1" />
            <span>
              {formatTimeString(event.startTime)} -{" "}
              {formatTimeString(event.endTime)}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-between items-center">
        <div className="flex items-center">
          {event.sportType && (
            <span
              className={`px-2 py-1 rounded-md text-xs mr-2 ${eventTypeBadgeColor()}`}
            >
              {formatSportType(event.sportType)}
            </span>
          )}
          {event.skillLevel && (
            <span
              className={`px-2 py-1 rounded-md text-xs ${skillLevelBadgeColor()}`}
            >
              {formatSkillLevel(event.skillLevel)}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {/* Avatar stack showing participants */}
          {rsvpsQuery.data && rsvpsQuery.data.filter(rsvp => rsvp.status === "going").length > 0 ? (
            <div className="flex items-center mr-4">
              <div className="flex -space-x-2 mr-2">
                {rsvpsQuery.data
                  .filter(rsvp => rsvp.status === "going")
                  .slice(0, 3)
                  .map((rsvp: EventRSVP, index: number) => (
                    <Avatar
                      key={`avatar-${rsvp.userId}-${index}`}
                      className="h-6 w-6 border-2 border-white"
                    >
                      <AvatarFallback className="text-xs bg-primary text-white">
                        {rsvp.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
              </div>
              <span className="text-sm text-gray-500">
                {rsvpsQuery.data.filter(rsvp => rsvp.status === "going").length} going
              </span>
            </div>
          ) : null}

          {/* RSVP Button - find user's RSVP status if they have one */}
          {user && rsvpsQuery.data ? (
            <RsvpButton 
              eventId={event.id} 
              eventName={event.name}
              currentStatus={rsvpsQuery.data.find(rsvp => rsvp.userId === user.id)?.status}
            />
          ) : (
            <RsvpButton eventId={event.id} eventName={event.name} />
          )}
        </div>
      </div>
    </div>
  );
}
