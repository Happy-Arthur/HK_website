import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  MapPin,
  Users,
  Clock,
  User,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/layout/header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MapView from "@/components/map/map-view";

type EventRsvp = {
  id: number;
  userId: number;
  username: string;
  status: "going" | "maybe" | "not_going";
  createdAt: string;
};

type GroupEvent = {
  id: number;
  name: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  sportType: string;
  skillLevel: string;
  maxParticipants: number;
  locationName: string;
  address: string;
  creatorId: number;
  groupId: number;
  groupName?: string;
  createdAt: string;
};

export default function GroupEventPage() {
  const { groupId, eventId } = useParams<{ groupId: string, eventId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const numGroupId = Number(groupId);
  const numEventId = Number(eventId);

  // Fetch event details
  const {
    data: event,
    isLoading: isLoadingEvent,
    error: eventError,
  } = useQuery({
    queryKey: [`/api/groups/${numGroupId}/events/${numEventId}`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${numGroupId}/events/${numEventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      return response.json() as Promise<GroupEvent>;
    },
    enabled: !!numGroupId && !!numEventId,
  });

  // Fetch RSVPs
  const {
    data: rsvps = [],
    isLoading: isLoadingRsvps,
  } = useQuery({
    queryKey: [`/api/groups/${numGroupId}/events/${numEventId}/rsvps`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${numGroupId}/events/${numEventId}/rsvps`);
      if (!response.ok) {
        throw new Error("Failed to fetch RSVPs");
      }
      return response.json() as Promise<EventRsvp[]>;
    },
    enabled: !!numGroupId && !!numEventId,
  });

  // Compute attendance stats
  const goingCount = rsvps.filter(rsvp => rsvp.status === "going").length;
  const maybeCount = rsvps.filter(rsvp => rsvp.status === "maybe").length;
  const notGoingCount = rsvps.filter(rsvp => rsvp.status === "not_going").length;

  // Check if current user has RSVP'd
  const userRsvp = rsvps.find(rsvp => rsvp.userId === user?.id);

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async (status: "going" | "maybe" | "not_going") => {
      // The endpoint should be /rsvps not /rsvp - this was the main issue
      const response = await fetch(`/api/groups/${numGroupId}/events/${numEventId}/rsvps`, {
        method: "POST", // Always use POST as the server handles both creation and updates
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update RSVP");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${numGroupId}/events/${numEventId}/rsvps`] });
      toast({
        title: "RSVP Updated",
        description: "Your RSVP has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update RSVP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch facilities for the map
  const {
    data: facilities = [],
    isLoading: isLoadingFacilities,
  } = useQuery({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const response = await fetch("/api/facilities");
      if (!response.ok) {
        throw new Error("Failed to fetch facilities");
      }
      return response.json();
    },
  });

  // Handle error with useEffect
  useEffect(() => {
    if (eventError) {
      toast({
        title: "Error",
        description: "Failed to load event details. Please try again later.",
        variant: "destructive",
      });
    }
  }, [eventError, toast]);

  // If loading, show skeleton
  if (isLoadingEvent) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-10 w-60 mb-2" />
            <Skeleton className="h-6 w-40 mb-6" />
            <Skeleton className="h-64 w-full mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <Skeleton className="h-8 w-40 mb-4" />
                <Skeleton className="h-32 w-full mb-6" />
                <Skeleton className="h-8 w-40 mb-4" />
                <Skeleton className="h-48 w-full" />
              </div>
              <div>
                <Skeleton className="h-8 w-40 mb-4" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If no event found, show not found
  if (!event && !isLoadingEvent) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Event Not Found</h1>
            <p className="text-muted-foreground mb-6">The event you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => setLocation(`/groups/${numGroupId}`)}>
              Back to Group
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Button
            variant="ghost"
            className="flex items-center mb-4 -ml-3"
            onClick={() => setLocation(`/groups/${numGroupId}`)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Group
          </Button>

          {/* Event header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{event?.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-6">
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 mr-1" />
                <span>{event?.eventDate && format(new Date(event.eventDate), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>{event?.startTime} - {event?.endTime}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{event?.locationName || "Unknown location"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {event?.sportType && (
                <Badge className="capitalize">{event.sportType}</Badge>
              )}
              {event?.skillLevel && (
                <Badge variant="outline" className="capitalize">{event.skillLevel}</Badge>
              )}
              {event?.maxParticipants && (
                <Badge variant="secondary">
                  <Users className="h-3 w-3 mr-1" />
                  Max {event.maxParticipants} participants
                </Badge>
              )}
            </div>
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="md:col-span-2 space-y-6">
              {/* Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 rounded-md overflow-hidden">
                    {isLoadingFacilities ? (
                      <div className="h-full flex items-center justify-center bg-muted">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <MapView
                        facilities={facilities}
                        selectedFacilityId={null}
                        onSelectFacility={() => {}}
                        groupEvents={event ? [event] : []}
                        showEvents={true}
                      />
                    )}
                  </div>
                  <div className="mt-4">
                    <h4 className="font-medium">{event?.locationName}</h4>
                    <p className="text-muted-foreground">{event?.address || "No address provided"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>About this event</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p>{event?.description || "No description provided."}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* RSVP */}
              <Card>
                <CardHeader>
                  <CardTitle>RSVP</CardTitle>
                  <CardDescription>Let others know if you're coming</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant={userRsvp?.status === "going" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => rsvpMutation.mutate("going")}
                      disabled={rsvpMutation.isPending}
                    >
                      <div className="flex items-center">
                        <span className="mr-2">👍</span>
                        Going ({goingCount})
                      </div>
                    </Button>
                    <Button 
                      variant={userRsvp?.status === "maybe" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => rsvpMutation.mutate("maybe")}
                      disabled={rsvpMutation.isPending}
                    >
                      <div className="flex items-center">
                        <span className="mr-2">🤔</span>
                        Maybe ({maybeCount})
                      </div>
                    </Button>
                    <Button 
                      variant={userRsvp?.status === "not_going" ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => rsvpMutation.mutate("not_going")}
                      disabled={rsvpMutation.isPending}
                    >
                      <div className="flex items-center">
                        <span className="mr-2">👎</span>
                        Not Going ({notGoingCount})
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Attendees */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Who's Coming
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingRsvps ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : rsvps.filter(rsvp => rsvp.status === "going").length > 0 ? (
                    <div className="space-y-3">
                      {rsvps
                        .filter(rsvp => rsvp.status === "going")
                        .map((rsvp) => (
                          <div key={rsvp.id} className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{rsvp.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{rsvp.username}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <User className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No one has RSVP'd yet</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <div className="text-xs text-muted-foreground">
                    {event?.maxParticipants
                      ? `${goingCount} of ${event.maxParticipants} spots filled`
                      : `${goingCount} ${goingCount === 1 ? 'person' : 'people'} going`}
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}