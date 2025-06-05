// client/src/pages/event-page.tsx
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Event as SchemaEvent } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import EventDetail from "@/components/events/event-detail";
import { Loader2 } from "lucide-react";

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch event details
  const {
    data: event,
    isLoading,
    error
  } = useQuery<SchemaEvent>({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      return response.json();
    },
    enabled: !!eventId,
  });

  // Function to handle back button click
  const handleBackToList = () => {
    // Always go back to the map view as requested by users
    if (event?.facilityId) {
      // If it has a facilityId, go back to the map with that facility selected
      setLocation(`/?facilityId=${event.facilityId}`);
    } else {
      // Otherwise go to the general map page
      setLocation("/");
    }
  };

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container mx-auto p-4">
          <div className="text-center py-12">
            <h2 className="text-lg font-medium">Event not found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error).message || "The event you're looking for doesn't exist or has been removed."}
            </p>
            <button
              onClick={() => setLocation("/")}
              className="mt-4 text-blue-600 hover:underline"
            >
              Go to Map
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        ) : event ? (
          <EventDetail
            event={event}
            isLoading={isLoading}
            onBackToList={handleBackToList}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p>Event not found</p>
          </div>
        )}
      </main>
    </div>
  );
}