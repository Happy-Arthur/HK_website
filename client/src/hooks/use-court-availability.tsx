import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "./use-websocket";
import { useState, useEffect } from "react";
import { useToast } from "./use-toast";
import { CourtAvailability } from "@shared/schema";

export function useCourtAvailability(facilityId: number, date?: Date) {
  const [availabilityData, setAvailabilityData] = useState<CourtAvailability[]>([]);
  const { toast } = useToast();
  
  // Format date as YYYY-MM-DD for the API
  const formattedDate = date 
    ? date.toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];
  
  // Use WebSocket for real-time updates
  const { isConnected, lastMessage, subscribeFacility } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'court_availability_update' || message.type === 'court_availability_created') {
        // Update the cached data when we receive a WebSocket update
        if (message.data && message.data.facilityId === facilityId) {
          // Get current cached data
          const currentData = queryClient.getQueryData<CourtAvailability[]>([
            `/api/facilities/${facilityId}/availability`, 
            formattedDate
          ]) || [];
          
          // If this is an update to an existing entry
          if (message.type === 'court_availability_update') {
            const updatedData = currentData.map(item => 
              item.id === message.data.id ? message.data : item
            );
            
            // Update the query cache
            queryClient.setQueryData(
              [`/api/facilities/${facilityId}/availability`, formattedDate],
              updatedData
            );
            
            setAvailabilityData(updatedData);
          } 
          // If this is a new entry
          else if (message.type === 'court_availability_created') {
            const newData = [...currentData, message.data];
            
            // Update the query cache
            queryClient.setQueryData(
              [`/api/facilities/${facilityId}/availability`, formattedDate],
              newData
            );
            
            setAvailabilityData(newData);
          }
        }
      }
    }
  });
  
  // Subscribe to updates for this facility when connection is established
  useEffect(() => {
    if (isConnected && facilityId) {
      subscribeFacility(facilityId);
    }
  }, [isConnected, facilityId, subscribeFacility]);
  
  // Query to get court availability
  const { 
    data, 
    isLoading, 
    error,
    refetch
  } = useQuery<CourtAvailability[]>({
    queryKey: [`/api/facilities/${facilityId}/availability`, formattedDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/facilities/${facilityId}/availability?date=${formattedDate}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch court availability");
      }
      return response.json();
    },
    enabled: !!facilityId,
  });
  
  // Update state when data changes
  useEffect(() => {
    if (data) {
      setAvailabilityData(data);
    }
  }, [data]);
  
  // Mutation to update court availability
  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({
      availabilityId,
      isAvailable,
    }: {
      availabilityId: number;
      isAvailable: boolean;
    }) => {
      const res = await apiRequest(
        "PUT",
        `/api/facilities/${facilityId}/availability/${availabilityId}`,
        { isAvailable }
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Court availability updated",
        description: "The court availability has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update court availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to create new court availability entry
  const createAvailabilityMutation = useMutation({
    mutationFn: async (availability: Omit<CourtAvailability, "id" | "updatedAt">) => {
      const res = await apiRequest(
        "POST",
        `/api/facilities/${facilityId}/availability`,
        availability
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Court availability created",
        description: "New court availability has been added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create court availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  return {
    availability: availabilityData,
    isLoading,
    error,
    refetch,
    updateAvailability: updateAvailabilityMutation.mutate,
    isUpdating: updateAvailabilityMutation.isPending,
    createAvailability: createAvailabilityMutation.mutate,
    isCreating: createAvailabilityMutation.isPending,
    isRealTimeConnected: isConnected,
  };
}