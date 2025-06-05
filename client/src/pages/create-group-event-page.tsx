import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useLocation, useRoute } from "wouter";
import {
  CalendarIcon,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { facilityTypes, skillLevels } from "@shared/schema";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";

// Simplified schema for group events
const createGroupEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  eventDate: z.date({
    required_error: "Event date is required",
  }),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  locationName: z.string().min(1, "Location name is required"),
  address: z.string().min(1, "Address is required for accurate map placement"),
  sportType: z.string().min(1, "Sport type is required"),
  skillLevel: z.string().min(1, "Skill level is required"),
  maxParticipants: z.string().optional(),
  groupId: z.string().min(1, "Group is required"),
  notes: z.string().optional(),
});

type CreateGroupEventValues = z.infer<typeof createGroupEventSchema>;

export default function CreateGroupEventPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/groups/:groupId/create-event");
  const { toast } = useToast();

  // Get group ID from URL path parameter or query parameter
  const groupIdFromPath = params?.groupId;
  const urlParams = new URLSearchParams(window.location.search);
  const groupIdFromQuery = urlParams.get('groupId');
  const groupId = groupIdFromPath || groupIdFromQuery;

  // Get group details
  const { data: group, isLoading: isLoadingGroup } = useQuery({
    queryKey: ["/api/groups", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch group details");
      }
      return res.json();
    },
    enabled: !!groupId && !!user,
  });

  // Form
  const form = useForm<CreateGroupEventValues>({
    resolver: zodResolver(createGroupEventSchema),
    defaultValues: {
      name: "",
      description: "",
      locationName: "",
      address: "",
      sportType: group?.sportType || "",
      skillLevel: "all_levels",
      maxParticipants: "",
      groupId: groupId || "", 
      notes: "",
    },
  });

  // Update form values when group data loads
  useEffect(() => {
    if (group) {
      form.setValue('sportType', group.sportType || "");
      form.setValue('groupId', groupId || "");
    }
  }, [group, groupId, form]);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (values: CreateGroupEventValues) => {
      // Transform values to match the event schema
      const eventData = {
        name: values.name,
        description: values.description,
        eventDate: format(values.eventDate, "yyyy-MM-dd"),
        startTime: values.startTime,
        endTime: values.endTime,
        locationName: values.locationName,
        address: values.address,
        sportType: values.sportType,
        skillLevel: values.skillLevel,
        maxParticipants: values.maxParticipants
          ? parseInt(values.maxParticipants)
          : undefined,
        organizerId: user?.id,
        groupId: parseInt(values.groupId),
        notes: values.notes,
      };

      // Use the dedicated group events API endpoint
      const res = await apiRequest("POST", `/api/groups/${values.groupId}/events`, eventData);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create group event");
      }

      return res.json();
    },
    onSuccess: (createdEvent) => {
      toast({
        title: "Group event created successfully",
        description: "Your event has been published to your group",
      });
      // Invalidate all events related queries
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      // Invalidate the specific group's events using the dedicated API path
      queryClient.invalidateQueries({ 
        queryKey: [`/api/groups/${createdEvent.groupId}/events`] 
      });
      navigate(`/groups/${createdEvent.groupId}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create event",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: CreateGroupEventValues) => {
    createEventMutation.mutate(data);
  };

  useEffect(() => {
    // Redirect to groups page if no group ID is provided
    if (!groupId) {
      navigate("/community");
    }
  }, [groupId, navigate]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(`/groups/${groupId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Create Group Event</h1>
          </div>

          {isLoadingGroup ? (
            <div>Loading group details...</div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Event Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Event Name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Name</FormLabel>
                          <FormDescription>
                            Choose a clear, descriptive name for your group event
                          </FormDescription>
                          <FormControl>
                            <Input placeholder="Enter event name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Date and Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Event Date */}
                      <FormField
                        control={form.control}
                        name="eventDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground",
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "yyyy-MM-dd")
                                    ) : (
                                      <span>Select date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date <
                                    new Date(new Date().setHours(0, 0, 0, 0))
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Time */}
                        <FormField
                          control={form.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Start time" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({ length: 24 }).map((_, hour) =>
                                    [0, 30].map((minute) => {
                                      const timeValue = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                                      return (
                                        <SelectItem
                                          key={timeValue}
                                          value={timeValue}
                                        >
                                          {timeValue}
                                        </SelectItem>
                                      );
                                    }),
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* End Time */}
                        <FormField
                          control={form.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="End time" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({ length: 24 }).map((_, hour) =>
                                    [0, 30].map((minute) => {
                                      const timeValue = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                                      return (
                                        <SelectItem
                                          key={timeValue}
                                          value={timeValue}
                                        >
                                          {timeValue}
                                        </SelectItem>
                                      );
                                    }),
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Location */}
                    <FormField
                      control={form.control}
                      name="locationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Victoria Park Basketball Court"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Detailed address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Skill Level */}
                    <FormField
                      control={form.control}
                      name="skillLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Skill Level</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-wrap gap-4"
                            >
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="beginner" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Beginners
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="intermediate" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Intermediate
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="advanced" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Advanced
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="all_levels" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  All levels
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Sport Type */}
                    <FormField
                      control={form.control}
                      name="sportType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sport Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sport type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {facilityTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Max Participants */}
                    <FormField
                      control={form.control}
                      name="maxParticipants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Participants (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g., 10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes (Optional)</FormLabel>
                          <FormDescription>
                            Any special instructions or equipment to bring
                          </FormDescription>
                          <FormControl>
                            <Textarea
                              placeholder="Enter any additional information for participants"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={createEventMutation.isPending}
                >
                  {createEventMutation.isPending
                    ? "Creating Event..."
                    : "Create Group Event"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </main>
    </div>
  );
}