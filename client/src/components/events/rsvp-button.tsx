// client/src/components/events/rsvp-button.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RsvpButtonProps {
  eventId: number;
  eventName: string;
  currentStatus?: string | null;
  isDetailView?: boolean;
}

export default function RsvpButton({
  eventId,
  eventName,
  currentStatus,
  isDetailView = false,
}: RsvpButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const handleRsvpChange = async (status: "going" | "interested" | "declined") => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to RSVP for events",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log("Sending RSVP request for event", eventId, "with status:", status);
      
      let response;
      
      // Always use POST which will handle both create and update on the server
      // This simplifies the logic and prevents errors from mismatched RSVP status
      try {
        response = await apiRequest("POST", `/api/events/${eventId}/rsvp`, { status });
        console.log("RSVP response:", response);
      } catch (apiError) {
        console.error("API request failed:", apiError);
        throw new Error("API request failed");
      }

      // Invalidate queries to refresh data
      try {
        await queryClient.invalidateQueries({
          queryKey: [`/api/events/${eventId}/rsvps`],
        });
        
        // Also invalidate any queries that might show this event
        await queryClient.invalidateQueries({
          queryKey: ['/api/events'],
        });
      } catch (queryError) {
        console.error("Failed to invalidate queries:", queryError);
        // Continue even if invalidation fails
      }

      const statusMessages = {
        going: `You're going to ${eventName}!`,
        interested: `You're interested in ${eventName}`,
        declined: `You've declined ${eventName}`,
      };

      toast({
        title: "RSVP Updated",
        description: statusMessages[status],
      });
    } catch (error) {
      console.error("RSVP error:", error);
      
      toast({
        title: "RSVP Failed",
        description: "There was an error updating your RSVP. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If the user already has an RSVP, show the current status with options to change
  if (currentStatus) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={currentStatus === "declined" ? "outline" : "default"}
            size={isDetailView ? "default" : "sm"}
            className={`gap-2 ${isDetailView ? "flex-1" : ""}`}
            disabled={isLoading}
            onClick={(e) => e.stopPropagation()} // Stop event propagation
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : currentStatus === "going" ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isDetailView ? "I'm Going" : "Going"}
              </>
            ) : currentStatus === "interested" ? (
              <>
                <ArrowRight className="h-4 w-4" />
                Interested
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Not Going
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent data-radix-dropdown-menu align="end">
          {currentStatus !== "going" && (
            <DropdownMenuItem 
              className="dropdown-menu-item" 
              onClick={(e) => {
                e.stopPropagation();
                handleRsvpChange("going");
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Going
            </DropdownMenuItem>
          )}
          {currentStatus !== "interested" && (
            <DropdownMenuItem 
              className="dropdown-menu-item" 
              onClick={(e) => {
                e.stopPropagation();
                handleRsvpChange("interested");
              }}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Interested
            </DropdownMenuItem>
          )}
          {currentStatus !== "declined" && (
            <DropdownMenuItem 
              className="dropdown-menu-item" 
              onClick={(e) => {
                e.stopPropagation();
                handleRsvpChange("declined");
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Not Going
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Simple RSVP button if user hasn't RSVP'd yet
  return (
    <Button 
      size={isDetailView ? "default" : "sm"}
      onClick={(e) => {
        e.stopPropagation();
        handleRsvpChange("going");
      }}
      disabled={isLoading}
      className={isDetailView ? "flex-1" : ""}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Processing...
        </>
      ) : (
        <>
          {isDetailView && <CheckCircle2 className="h-4 w-4 mr-2" />}
          {isDetailView ? "I'm Going" : "RSVP"}
        </>
      )}
    </Button>
  );
}