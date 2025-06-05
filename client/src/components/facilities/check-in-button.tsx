// client/src/components/facilities/check-in-button.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, MapPin, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface CheckInButtonProps {
  facilityId: number;
  facilityName: string;
}

export default function CheckInButton({
  facilityId,
  facilityName,
}: CheckInButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient(); // Access query client from hook
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Check if the user is already checked in at this facility
  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/facilities/${facilityId}/checkins`, {
          credentials: "include", // Important for cookies
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if this is the new response format or the old array format
          if (data && typeof data === 'object' && 'isUserCheckedIn' in data) {
            // New format with enhanced response
            setIsCheckedIn(data.isUserCheckedIn);
          } else if (Array.isArray(data)) {
            // Old format - array of check-ins
            const userCheckIn = data.find(
              (checkIn) => checkIn.userId === user.id,
            );
            setIsCheckedIn(!!userCheckIn);
          } else {
            setIsCheckedIn(false);
          }
        }
      } catch (error) {
        console.error("Error checking check-in status:", error);
      }
    };

    checkStatus();
  }, [facilityId, user]);

  const handleCheckIn = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to check in at this facility",
        variant: "destructive",
        duration: 5000, // Make error toasts stay longer - 5 seconds
      });
      return;
    }

    setIsLoading(true);

    // Fire event to trigger map state preservation
    document.dispatchEvent(new Event("fetch-start"));

    try {
      // First attempt - with standard approach
      const response = await apiRequest(
        "POST",
        `/api/facilities/${facilityId}/checkin`,
      );

      // Check if successful
      if (response.ok) {
        // Successfully checked in
        console.log("Check-in successful, updating UI and refreshing data");

        // Immediately set checked in for better UI feedback
        setIsCheckedIn(true);

        // Aggressively invalidate and refresh data across all relevant queries
        await Promise.all([
          // Invalidate check-ins for this facility
          queryClient.invalidateQueries({
            queryKey: [`/api/facilities/${facilityId}/checkins`],
          }),

          // Invalidate user check-ins
          queryClient.invalidateQueries({
            queryKey: [`/api/user/checkins`],
          }),

          // Invalidate all facilities to ensure consistency
          queryClient.invalidateQueries({
            queryKey: [`/api/facilities`],
          }),
        ]);

        // Force multiple immediate refetches to ensure UI updates
        try {
          console.log("Forcing immediate check-ins refetch");
          // First refetch
          await queryClient.refetchQueries({
            queryKey: [`/api/facilities/${facilityId}/checkins`],
            exact: true,
          });

          // Set a series of delayed refetches to ensure data is updated
          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: [`/api/facilities/${facilityId}/checkins`],
              exact: true,
            });
          }, 500);

          setTimeout(async () => {
            await queryClient.refetchQueries({
              queryKey: [`/api/facilities/${facilityId}/checkins`],
              exact: true,
            });
          }, 1500);
        } catch (refetchError) {
          console.error("Error during force refetch:", refetchError);
        }

        toast({
          title: "Checked in!",
          description: `You've successfully checked in at ${facilityName}`,
          duration: 5000, // Make success toasts stay longer - 5 seconds
        });

        // Reset error count
        setErrorCount(0);
      } else {
        throw new Error(`Check-in failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error checking in:", error);
      setErrorCount((prev) => prev + 1);

      // If we've had multiple errors, try a fallback approach with a direct fetch
      if (errorCount >= 1) {
        try {
          console.log("Trying fallback check-in method...");

          // Simple fetch approach as a fallback
          const fallbackResponse = await fetch(
            `/api/facilities/${facilityId}/checkin`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          if (fallbackResponse.ok) {
            // Even with fallback success, we should update the UI
            setIsCheckedIn(true);

            toast({
              title: "Checked in!",
              description: `You've been checked in at ${facilityName}`,
              duration: 5000, // Make success toasts stay longer - 5 seconds
            });

            // Aggressively refresh all related data
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: [`/api/facilities/${facilityId}/checkins`],
              }),
              queryClient.invalidateQueries({
                queryKey: [`/api/user/checkins`],
              }),
            ]);

            // Force immediate refetch
            await queryClient.refetchQueries({
              queryKey: [`/api/facilities/${facilityId}/checkins`],
            });
          } else {
            // Still failed with fallback
            toast({
              title: "Check-in failed",
              description:
                "There was an error checking in. Please try again later.",
              variant: "destructive",
              duration: 5000, // Make error toasts stay longer - 5 seconds
            });
          }
        } catch (fallbackError) {
          console.error("Fallback check-in also failed:", fallbackError);
          toast({
            title: "Check-in failed",
            description: "Could not complete check-in. Please try again later.",
            variant: "destructive",
            duration: 5000, // Make error toasts stay longer - 5 seconds
          });
        }
      } else {
        // First error - just show standard error
        toast({
          title: "Check-in failed",
          description: "There was an error checking in. Please try again.",
          variant: "destructive",
          duration: 5000, // Make error toasts stay longer - 5 seconds
        });
      }
    } finally {
      setIsLoading(false);

      // Fire event to signal operation completion
      document.dispatchEvent(new Event("fetch-complete"));
    }
  };

  const handleCheckOut = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to check out of this facility",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    // Fire event to trigger map state preservation
    document.dispatchEvent(new Event("fetch-start"));

    try {
      // Call the checkout endpoint
      const response = await apiRequest(
        "POST",
        `/api/facilities/${facilityId}/checkout`,
      );

      if (response.ok) {
        console.log("Check-out successful, updating UI and refreshing data");

        // Immediately update UI
        setIsCheckedIn(false);

        // Invalidate relevant queries to ensure data is updated
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [`/api/facilities/${facilityId}/checkins`],
          }),
          queryClient.invalidateQueries({
            queryKey: [`/api/user/checkins`],
          }),
          queryClient.invalidateQueries({
            queryKey: [`/api/facilities`],
          }),
        ]);

        // Force immediate refetch
        await queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/checkins`],
          exact: true,
        });

        toast({
          title: "Checked out!",
          description: `You've successfully checked out from ${facilityName}`,
          duration: 5000,
        });
      } else {
        throw new Error(`Check-out failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error checking out:", error);
      
      // Handle error
      toast({
        title: "Check-out failed",
        description: "There was an error checking out. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
      
      // Fire event to signal operation completion
      document.dispatchEvent(new Event("fetch-complete"));
    }
  };

  // Render different buttons based on check-in status
  if (isCheckedIn) {
    return (
      <Button
        className="w-full text-base py-6 gap-2"
        variant="outline"
        onClick={handleCheckOut}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <LogOut className="h-5 w-5" />
            Check Out
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      className="w-full text-base py-6 gap-2"
      size="lg"
      onClick={handleCheckIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Checking in...
        </>
      ) : (
        <>
          <MapPin className="h-5 w-5" />
          Check In
        </>
      )}
    </Button>
  );
}
