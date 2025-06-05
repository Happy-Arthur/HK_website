// Updated CheckInsDisplay component to show estimated people count instead of individual users
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface CheckInsDisplayProps {
  facilityId: number;
}

interface PeopleCountResponse {
  peopleCount: number;
  isUserCheckedIn: boolean;
  isUserNearby?: boolean;
  crowdLevel?: string;
  usingGpsData?: boolean;
}

export default function CheckInsDisplay({ facilityId }: CheckInsDisplayProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Query with improved settings for frequent updates
  const checkInsQuery = useQuery<PeopleCountResponse>({
    queryKey: [`/api/facilities/${facilityId}/checkins`],
    enabled: !!facilityId && facilityId > 0,
    retry: 2, // Retry failed requests twice
    retryDelay: 1000, // Wait 1 second between retries
    // Refresh frequently to catch updates
    refetchInterval: 10000, // Every 10 seconds
    // Reduce stale time to ensure quick updates
    staleTime: 5000,
    // Always refetch on window focus
    refetchOnWindowFocus: true,
    onError: () => {
      setHasError(true);
    },
    onSuccess: () => {
      setHasError(false);
    },
  });

  // Effect to auto-refresh data when component mounts
  useEffect(() => {
    if (facilityId) {
      handleRefresh();
    }
  }, [facilityId, retryAttempt]);

  // Function to manually refresh check-ins
  const handleRefresh = async () => {
    if (!facilityId) return;

    setIsRefreshing(true);
    try {
      console.log("Refreshing facility crowd estimate");

      // First invalidate
      await queryClient.invalidateQueries({
        queryKey: [`/api/facilities/${facilityId}/checkins`],
      });

      // Then force refetch
      await queryClient.refetchQueries({
        queryKey: [`/api/facilities/${facilityId}/checkins`],
        exact: true,
      });

      console.log("Facility crowd data refreshed successfully");
      setHasError(false);
    } catch (error) {
      console.error("Error refreshing crowd data:", error);
      setHasError(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to retry on error
  const handleRetry = () => {
    setRetryAttempt((prev) => prev + 1);
    handleRefresh();
  };

  if (checkInsQuery.isLoading) {
    return (
      <div className="py-3 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (hasError || checkInsQuery.isError) {
    return (
      <div className="text-center py-3">
        <p className="text-sm text-red-500 mb-2">Error loading crowd data</p>
        <Button size="sm" variant="outline" onClick={handleRetry}>
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Retry
        </Button>
      </div>
    );
  }

  const { 
    peopleCount = 0, 
    isUserCheckedIn = false,
    isUserNearby = false,
    crowdLevel: apiCrowdLevel = undefined,
    usingGpsData = false
  } = checkInsQuery.data || {};

  // Get crowd level classification
  const getCrowdLevel = (count: number, apiLevel?: string) => {
    // If API provides a crowd level, use it
    if (apiLevel) {
      return { 
        level: apiLevel, 
        text: apiLevel.charAt(0).toUpperCase() + apiLevel.slice(1)
      };
    }
    
    // Otherwise calculate based on count
    if (count === 0) return { level: "empty", text: "Empty" };
    if (count <= 3) return { level: "quiet", text: "Quiet" }; 
    if (count <= 8) return { level: "moderate", text: "Moderate" };
    if (count <= 15) return { level: "busy", text: "Busy" };
    return { level: "crowded", text: "Crowded" };
  };

  const crowdLevel = getCrowdLevel(peopleCount, apiCrowdLevel);

  // Color classes for different crowd levels
  const crowdLevelClasses: Record<string, string> = {
    empty: "text-gray-500",
    quiet: "text-green-500",
    moderate: "text-blue-500",
    busy: "text-amber-500",
    crowded: "text-red-500",
  };

  if (peopleCount === 0) {
    return (
      <div className="text-center py-3">
        <p className="text-sm text-gray-500 mb-1">
          No one is currently checked in
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="text-xs text-gray-500"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Crowd Estimate</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          className="text-xs h-6 px-2"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center py-2 px-4 bg-primary/5 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Users className={cn("h-5 w-5", crowdLevelClasses[crowdLevel.level])} />
          <span className={cn("font-semibold", crowdLevelClasses[crowdLevel.level])}>
            {crowdLevel.text}
          </span>
        </div>
        
        <div className="text-center">
          <p className="text-lg font-bold">
            {peopleCount} {peopleCount === 1 ? "person" : "people"}
          </p>
          <p className="text-xs text-muted-foreground">currently at this location</p>
        </div>

        {/* Show different statuses based on check-in and proximity */}
        {(isUserCheckedIn || isUserNearby) && (
          <div className="mt-2 text-xs text-primary font-medium">
            {isUserCheckedIn && isUserNearby ? (
              "You're checked in and nearby"
            ) : isUserCheckedIn ? (
              "You're checked in here"
            ) : (
              "You're near this location"
            )}
          </div>
        )}
        
        {/* Indicate if using GPS data */}
        {usingGpsData && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            Using GPS-based crowd estimation
          </div>
        )}
      </div>
    </div>
  );
}
