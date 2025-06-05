import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import MapView from "@/components/map/map-view";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { facilityTypes, skillLevels, insertEventSchema } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// Extended event schema with validation for our form - description field fixed to be truly optional
const createEventSchema = z.object({
  name: z.string().min(2, { message: "Please enter event name" }),
  description: z.string().optional(), // Removed the min() constraint to make it truly optional

  // Date and time fields
  eventDate: z.date({ required_error: "Please select event date" }),
  startTime: z.string({ required_error: "Please select start time" }),
  endTime: z.string({ required_error: "Please select end time" }),

  // Location
  facilityId: z.string().optional(),
  locationName: z.string().min(2, { message: "Please enter location name" }),
  address: z.string().min(5, { message: "Please enter address" }),

  // Participant info
  sportType: z.string({ required_error: "Please select event type" }),
  skillLevel: z.string({ required_error: "Please select skill level" }),
  minParticipants: z.string().optional(),
  maxParticipants: z.string().optional(),

  // Group info (optional)
  groupId: z.string().optional(),

  // Registration info (optional)
  registrationDeadline: z.date().optional(),
  registrationMethod: z.string().optional(),
  contactInfo: z.string().optional(),

  // Equipment and requirements (optional)
  equipmentRequired: z.string().optional(),

  // Schedule (optional)
  schedule: z.string().optional(),

  // Purpose (optional)
  purpose: z.string().optional(),

  // Notes (optional)
  notes: z.string().optional(),
});

type CreateEventValues = z.infer<typeof createEventSchema>;

export default function CreateEventPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [formData, setFormData] = useState({
    facilityId: '',
  });

  // Extract groupId from URL if it exists
  const urlParams = new URLSearchParams(window.location.search);
  const groupIdFromUrl = urlParams.get('groupId');
  
  // Get facilities for the map selector
  const facilitiesQuery = useQuery({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const res = await fetch("/api/facilities");
      if (!res.ok) {
        throw new Error("Failed to fetch facilities");
      }
      return res.json();
    },
  });
  
  // Get user's groups for the dropdown
  const { data: userGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ["/api/groups/my-groups"],
    queryFn: async () => {
      if (!user) return [];
      try {
        const res = await fetch("/api/groups/my-groups");
        if (!res.ok) {
          console.error("Error fetching user groups:", res.statusText);
          return [];
        }
        return res.json();
      } catch (error) {
        console.error("Failed to fetch user groups:", error);
        return [];
      }
    },
    enabled: !!user,
  });

  // Form
  const form = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: "",
      description: "",
      locationName: "",
      address: "",
      sportType: "",
      skillLevel: "all_levels",
      minParticipants: "",
      maxParticipants: "",
      groupId: groupIdFromUrl || "0",
      registrationMethod: "",
      contactInfo: "",
      equipmentRequired: "",
      schedule: "",
      purpose: "",
      notes: "",
    },
  });
  
  // Set group ID from URL parameter when it exists
  useEffect(() => {
    if (groupIdFromUrl) {
      form.setValue('groupId', groupIdFromUrl);
    }
  }, [groupIdFromUrl, form]);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (values: CreateEventValues) => {
      // Transform values to match the event schema
      const eventData = {
        name: values.name,
        description: values.description,
        facilityId: values.facilityId ? parseInt(values.facilityId) : undefined,
        eventDate: format(values.eventDate, "yyyy-MM-dd"),
        startTime: values.startTime,
        endTime: values.endTime,
        sportType: values.sportType,
        skillLevel: values.skillLevel,
        maxParticipants: values.maxParticipants
          ? parseInt(values.maxParticipants)
          : undefined,
        organizerId: user?.id,
        groupId: values.groupId && values.groupId !== "0" ? parseInt(values.groupId) : undefined,
        // Add notes, equipment, schedule as additional description
        // These would be in description field since our schema doesn't have separate fields for them
      };

      const res = await apiRequest("POST", "/api/events", eventData);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create event");
      }

      return res.json();
    },
    onSuccess: (createdEvent) => {
      toast({
        title: "Event created successfully",
        description: "Your event has been published",
      });
      // Invalidate all event-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      // If it's a group event, redirect to the group page
      if (createdEvent.groupId) {
        // Also invalidate the specific group's events
        queryClient.invalidateQueries({ 
          queryKey: ['/api/events', { groupId: createdEvent.groupId }] 
        });
        navigate(`/groups/${createdEvent.groupId}`);
      } else {
        // Otherwise go to community page
        navigate("/community");
      }
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
  const onSubmit = (data: CreateEventValues) => {
    createEventMutation.mutate(data);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Start an Event</h1>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Basic Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Activity Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>1. What is the event name?</FormLabel>
                        <FormDescription>
                          For example: Morning Run Club, Weekend Badminton
                        </FormDescription>
                        <FormControl>
                          <Input placeholder="Enter event name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date and Time */}
                  <div>
                    <FormLabel>2. What is the event date and time?</FormLabel>
                    <div className="grid gap-4 mt-2">
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
                              <FormLabel>Start Time</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select time" />
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
                              <FormLabel>End Time</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select time" />
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
                  </div>

                  {/* Location */}
                  <div>
                    <FormLabel>3. Where is the location?</FormLabel>
                    <div className="grid gap-4 mt-2">
                      <FormField
                        control={form.control}
                        name="locationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="For example: Sha Tin Sports Ground"
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
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Detailed address"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Will be marked on the map later
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Map component for facility selection */}
                      <div className="h-64 rounded-md overflow-hidden relative">
                        <MapView
                          facilities={facilitiesQuery.data || []}
                          selectedFacilityId={(() => {
                            const facilityIdValue = form.getValues('facilityId');
                            return facilityIdValue ? parseInt(String(facilityIdValue)) : null;
                          })()}
                          onSelectFacility={(facilityId: number) => {
                            form.setValue('facilityId', facilityId.toString());
                            setFormData({...formData, facilityId: facilityId.toString()});
                            // Find the facility to auto-populate the location name and address fields
                            const selectedFacility = facilitiesQuery.data?.find((f: any) => f.id === facilityId);
                            if (selectedFacility) {
                              form.setValue('locationName', selectedFacility.name);
                              form.setValue('address', selectedFacility.address || '');
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Participation Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Participation Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Participant Type */}
                  <FormField
                    control={form.control}
                    name="skillLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          4. Who is this event suitable for?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="beginner" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Beginners
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="advanced" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Experienced
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="all_levels" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                All skill levels
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Group Selection */}
                  <FormField
                    control={form.control}
                    name="groupId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Associate with a group? (optional)</FormLabel>
                        <FormDescription>
                          If selected, this event will only be visible to group members
                        </FormDescription>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a group (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">No group (public event)</SelectItem>
                            {userGroups?.map((group: { id: number; name: string }) => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Expected Participants */}
                  <div>
                    <FormLabel>
                      5. How many participants do you expect?
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <FormField
                        control={form.control}
                        name="minParticipants"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g., 2"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxParticipants"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum</FormLabel>
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
                    </div>
                  </div>

                  {/* Registration Information */}
                  <div>
                    <FormLabel>
                      6. Is registration required? Is there a deadline?
                    </FormLabel>
                    <div className="grid gap-4 mt-2">
                      {/* Registration Deadline */}
                      <FormField
                        control={form.control}
                        name="registrationDeadline"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Registration Deadline</FormLabel>
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
                                      <span>Select deadline</span>
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
                            <FormDescription>
                              Leave empty if registration is not required
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Registration Method / Contact Info */}
                      <FormField
                        control={form.control}
                        name="registrationMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration Method</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="For example: Through the platform, WhatsApp, etc."
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactInfo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Contact Information (Optional)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="For example: WhatsApp: 9123 4567"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Provide contact information for participants to
                              inquire
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Equipment Required */}
                  <FormField
                    control={form.control}
                    name="equipmentRequired"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          7. Do participants need to bring equipment?
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="For example: Bring your own badminton racket / swimming suit"
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

              {/* Activity Content and Purpose */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Content and Purpose</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Schedule */}
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          8. What is the schedule for this event?
                        </FormLabel>
                        <FormDescription>
                          Briefly write the timeline (e.g., 7:30 gathering, 8:00
                          start running, 9:00 finish)
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Event schedule"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Purpose */}
                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          9. What is the purpose of this event?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-wrap gap-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="practice" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Practice
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="social" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Social
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="competition" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Competition
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="learning" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Learn new skills
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
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
                        <FormLabel>
                          10. Are there any special requirements or notes?
                        </FormLabel>
                        <FormDescription>
                          For example: Bring water, sunscreen, arrive on time
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Special notes"
                            className="resize-none"
                            {...field}
                          />
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
                        <FormLabel>Activity Type</FormLabel>
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

                  {/* Optional: Image Upload */}
                  <div>
                    <FormLabel>
                      11. Would you like to upload a photo or promotional image?
                    </FormLabel>
                    <div className="mt-2 border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center">
                      <Button variant="outline" type="button">
                        Choose Image
                      </Button>
                      <FormDescription className="mt-2 text-center">
                        Supports JPG, PNG, GIF formats, maximum 5MB
                      </FormDescription>
                    </div>
                  </div>

                  {/* Description - Additional information */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Information (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any other information"
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
                  ? "Processing..."
                  : "Publish Event"}
              </Button>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
