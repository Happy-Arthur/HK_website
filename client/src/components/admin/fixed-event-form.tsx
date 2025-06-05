import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { facilityTypes, skillLevels } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { Event, Facility } from "@shared/schema";

interface EventFormProps {
  event?: Event;
  onCancel: () => void;
}

// Helper function to format date from ISO string to YYYY-MM-DD
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

// Helper function to format time from ISO string to HH:MM
function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  // Handle time formats like "09:00:00" or full datetime strings
  if (timeStr.includes(':')) {
    return timeStr.substring(0, 5); // Get just the HH:MM part
  }
  return '';
}

export function EventForm({ event, onCancel }: EventFormProps) {
  const { toast } = useToast();
  const isEdit = !!event; // Check if we're editing or creating
  
  const [formData, setFormData] = useState({
    name: event?.name || "",
    description: event?.description || "",
    sportType: event?.sportType || "basketball",
    facilityId: event?.facilityId ? event.facilityId.toString() : "none",
    eventDate: formatDate(event?.eventDate as string) || new Date().toISOString().split('T')[0],
    startTime: formatTime(event?.startTime as string) || "09:00",
    endTime: formatTime(event?.endTime as string) || "11:00",
    skillLevel: event?.skillLevel || "beginner",
    maxParticipants: event?.maxParticipants?.toString() || "10",
    isOfficial: event?.isOfficial || false,
    imageUrl: event?.imageUrl || ""
  });

  // Fetch facilities for the dropdown
  const facilitiesQuery = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/facilities");
      return await res.json();
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        facilityId: data.facilityId && data.facilityId !== "none" ? parseInt(data.facilityId) : null,
        maxParticipants: parseInt(data.maxParticipants),
        isOfficial: Boolean(data.isOfficial)
      };
      
      const res = await apiRequest("POST", "/api/admin/events", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      // Invalidate both event-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        facilityId: data.facilityId && data.facilityId !== "none" ? parseInt(data.facilityId) : null,
        maxParticipants: parseInt(data.maxParticipants),
        isOfficial: Boolean(data.isOfficial)
      };
      
      const res = await apiRequest("PUT", `/api/admin/events/${event!.id}`, payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      // Invalidate both event-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateEventMutation.mutate(formData);
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const isPending = createEventMutation.isPending || updateEventMutation.isPending;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Event" : "Create New Event"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter event name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sportType">Sport Type *</Label>
              <Select 
                value={formData.sportType} 
                onValueChange={(value) => handleSelectChange("sportType", value)}
                required
              >
                <SelectTrigger id="sportType">
                  <SelectValue placeholder="Select sport type" />
                </SelectTrigger>
                <SelectContent>
                  {facilityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facilityId">Facility (Optional)</Label>
              <Select 
                value={formData.facilityId} 
                onValueChange={(value) => handleSelectChange("facilityId", value)}
              >
                <SelectTrigger id="facilityId">
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="none" value="none">None (External Location)</SelectItem>
                  {facilitiesQuery.data?.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date *</Label>
              <Input
                id="eventDate"
                name="eventDate"
                type="date"
                value={formData.eventDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillLevel">Skill Level *</Label>
              <Select 
                value={formData.skillLevel} 
                onValueChange={(value) => handleSelectChange("skillLevel", value)}
                required
              >
                <SelectTrigger id="skillLevel">
                  <SelectValue placeholder="Select skill level" />
                </SelectTrigger>
                <SelectContent>
                  {skillLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Max Participants *</Label>
              <Input
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                min="1"
                value={formData.maxParticipants}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="Enter image URL"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isOfficial"
                checked={formData.isOfficial}
                onCheckedChange={(checked) => handleSwitchChange("isOfficial", checked)}
              />
              <Label htmlFor="isOfficial">Official Event</Label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter event description"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update Event" : "Create Event"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}