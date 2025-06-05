import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Calendar, Clock, Loader2, MapPin, Plus, Trash2, User, Users, CalendarClock, PenLine } from "lucide-react";
import { format, parseISO } from "date-fns";
import { facilityTypes } from "@shared/schema";

// Types 
type GroupEvent = {
  id: number;
  title: string;
  description: string;
  eventType: string;
  startTime: string;
  endTime: string;
  facilityId?: number;
  facilityName?: string;
  location?: string;
  maxParticipants: number;
  groupId: number;
  creatorId: number;
  createdAt: string;
};

type EditEventFormData = {
  title: string;
  description: string;
  eventType: string;
  startTime: string;
  endTime: string;
  location?: string;
  maxParticipants: number;
};

interface GroupEventManagerProps {
  groupId: number;
  isAdmin: boolean;
}

export function GroupEventManager({ groupId, isAdmin }: GroupEventManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupEvent | null>(null);
  const [formData, setFormData] = useState<EditEventFormData>({
    title: "",
    description: "",
    eventType: "social",
    startTime: "",
    endTime: "",
    location: "",
    maxParticipants: 10
  });

  // Fetch group events
  const {
    data: events = [],
    isLoading,
  } = useQuery({
    queryKey: [`/api/groups/${groupId}/events`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/events`);
      if (!response.ok) {
        throw new Error("Failed to fetch group events");
      }
      return response.json();
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EditEventFormData) => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/events`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event created",
        description: "The group event has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/events`] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event.",
        variant: "destructive",
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, data }: { eventId: number; data: EditEventFormData }) => {
      const response = await apiRequest("PUT", `/api/groups/${groupId}/events/${eventId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "The event has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/events`] });
      setIsModalOpen(false);
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event.",
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest("DELETE", `/api/groups/${groupId}/events/${eventId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "The event has been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/events`] });
      setIsDeleteDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event.",
        variant: "destructive",
      });
    },
  });

  // Handle edit event click
  const handleEditEvent = (event: GroupEvent) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location || "",
      maxParticipants: event.maxParticipants
    });
    setIsModalOpen(true);
  };

  // Handle delete event click
  const handleDeleteEvent = (event: GroupEvent) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select change
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    if (!formData.title || !formData.startTime || !formData.endTime) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Create or update event
    if (selectedEvent) {
      updateEventMutation.mutate({ eventId: selectedEvent.id, data: formData });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      eventType: "social",
      startTime: "",
      endTime: "",
      location: "",
      maxParticipants: 10
    });
    setSelectedEvent(null);
  };

  // Format date
  const formatEventDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "PPp");
    } catch (error) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Group Events</h2>
        {isAdmin && (
          <Button onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/50">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No events scheduled</h3>
          <p className="text-muted-foreground">
            This group doesn't have any scheduled events yet.
            {isAdmin && " Click 'Create Event' to schedule the first one."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {events.map((event: GroupEvent) => (
            <Card key={event.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  {isAdmin && (
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEditEvent(event)}>
                        <PenLine className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteEvent(event)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <CardDescription>
                  {event.eventType === "training" ? "Training Session" : "Social Gathering"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <CalendarClock className="h-4 w-4 mr-2" />
                    <div>
                      <div>{formatEventDate(event.startTime)}</div>
                      <div>to {formatEventDate(event.endTime)}</div>
                    </div>
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center text-muted-foreground">
                    <Users className="h-4 w-4 mr-2" />
                    <span>Max {event.maxParticipants} participants</span>
                  </div>
                </div>
                
                {event.description && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                      {event.description}
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Event Edit/Create Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Edit Event" : "Create New Event"}</DialogTitle>
            <DialogDescription>
              {selectedEvent 
                ? "Update the event details below." 
                : "Fill in the details for the new group event."}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter event title"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your event"
                  rows={3}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="eventType">Event Type *</Label>
                <Select
                  name="eventType"
                  value={formData.eventType}
                  onValueChange={(value) => handleSelectChange("eventType", value)}
                >
                  <SelectTrigger id="eventType">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="social">Social Gathering</SelectItem>
                    <SelectItem value="training">Training Session</SelectItem>
                    <SelectItem value="competition">Competition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    name="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location || ""}
                  onChange={handleInputChange}
                  placeholder="Event location"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="maxParticipants">Maximum Participants *</Label>
                <Input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.maxParticipants}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createEventMutation.isPending || updateEventMutation.isPending}
              >
                {(createEventMutation.isPending || updateEventMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedEvent ? "Update Event" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="py-4">
              <h3 className="font-medium">{selectedEvent.title}</h3>
              <p className="text-sm text-muted-foreground">
                {formatEventDate(selectedEvent.startTime)}
              </p>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              Deleting this event will remove all associated RSVPs and notifications.
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedEvent && deleteEventMutation.mutate(selectedEvent.id)}
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}