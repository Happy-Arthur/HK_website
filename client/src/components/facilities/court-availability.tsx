import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { CourtAvailability } from "@shared/schema";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  RefreshCw,
  CalendarIcon,
  Wifi,
  WifiOff,
} from "lucide-react";

type CourtAvailabilityProps = {
  facilityId: number;
  sportType: string;
};

// Helper function from utils.ts
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

// Form schema for adding new court availability
const courtAvailabilitySchema = z.object({
  courtNumber: z.coerce.number().min(1, "Court number is required"),
  date: z.date({
    required_error: "Date is required",
  }),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  isAvailable: z.boolean().default(true),
});

// Helper hook for managing court availability
function useCourtAvailability(facilityId: number, date?: Date) {
  const { toast } = useToast();
  const [availabilityData, setAvailabilityData] = useState<CourtAvailability[]>(
    [],
  );

  // Format date as YYYY-MM-DD for the API
  const formattedDate = date
    ? date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // Simulate WebSocket connection
  const isRealTimeConnected = true;

  // Query to get court availability
  const { data, isLoading, error, refetch } = useQuery<CourtAvailability[]>({
    queryKey: [`/api/facilities/${facilityId}/availability`, formattedDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/facilities/${facilityId}/availability?date=${formattedDate}`,
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
        { isAvailable },
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
    mutationFn: async (
      availability: Omit<CourtAvailability, "id" | "updatedAt">,
    ) => {
      const res = await apiRequest(
        "POST",
        `/api/facilities/${facilityId}/availability`,
        availability,
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
    isRealTimeConnected,
  };
}

export function CourtAvailabilityManager({
  facilityId,
  sportType,
}: CourtAvailabilityProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedCourt, setExpandedCourt] = useState<number | null>(null);

  const { user } = useAuth();

  const {
    availability,
    isLoading,
    error,
    refetch,
    updateAvailability,
    isUpdating,
    createAvailability,
    isCreating,
    isRealTimeConnected,
  } = useCourtAvailability(facilityId, selectedDate);

  const form = useForm<z.infer<typeof courtAvailabilitySchema>>({
    resolver: zodResolver(courtAvailabilitySchema),
    defaultValues: {
      courtNumber: 1,
      date: selectedDate,
      startTime: "09:00",
      endTime: "17:00",
      isAvailable: true,
    },
  });

  // Group availability by court number
  const availabilityByCourtNumber =
    availability?.reduce(
      (acc, item) => {
        if (!acc[item.courtNumber]) {
          acc[item.courtNumber] = [];
        }
        acc[item.courtNumber].push(item);
        return acc;
      },
      {} as Record<number, CourtAvailability[]>,
    ) || {};

  const courtNumbers = Object.keys(availabilityByCourtNumber)
    .map(Number)
    .sort((a, b) => a - b);

  const handleSubmit = form.handleSubmit((data) => {
    createAvailability({
      facilityId,
      courtNumber: data.courtNumber,
      date: data.date.toISOString().split("T")[0], // Format as YYYY-MM-DD
      startTime: data.startTime,
      endTime: data.endTime,
      isAvailable: data.isAvailable,
    });

    setIsAddDialogOpen(false);
  });

  const toggleAvailability = (
    availabilityId: number,
    isCurrentlyAvailable: boolean,
  ) => {
    updateAvailability({
      availabilityId,
      isAvailable: !isCurrentlyAvailable,
    });
  };

  const toggleExpandCourt = (courtNumber: number) => {
    setExpandedCourt(expandedCourt === courtNumber ? null : courtNumber);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Court Availability</CardTitle>
            <CardDescription>
              View and manage court availability for this facility
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isRealTimeConnected ? (
              <Badge
                variant="outline"
                className="text-green-500 flex items-center gap-1"
              >
                <Wifi className="h-3 w-3" /> Live
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-gray-500 flex items-center gap-1"
              >
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[240px] justify-start text-left font-normal",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {user && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Add Court Times
                </Button>
              </DialogTrigger>
              <DialogContent
                className="sm:max-w-[425px]"
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 9999,
                }}
              >
                <DialogHeader>
                  <DialogTitle>Add New Court Availability</DialogTitle>
                  <DialogDescription>
                    Create court availability for {sportType} courts at this
                    facility.
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="courtNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Court Number</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="1"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter the court number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="date"
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
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
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
                                  date < new Date("1900-01-01")
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
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="isAvailable"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Availability Status</FormLabel>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(value === "available")
                            }
                            defaultValue={
                              field.value ? "available" : "unavailable"
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select availability status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">
                                Available
                              </SelectItem>
                              <SelectItem value="unavailable">
                                Unavailable
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={isCreating}
                        className="w-full"
                      >
                        {isCreating && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Court Availability
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 text-center">
            Error loading court availability data
          </div>
        ) : courtNumbers.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No court availability found for this date.{" "}
            {user && "Click 'Add Court Times' to create availability."}
          </div>
        ) : (
          <div className="space-y-4">
            {courtNumbers.map((courtNumber) => (
              <div key={courtNumber} className="border rounded-md">
                <div
                  className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted"
                  onClick={() => toggleExpandCourt(courtNumber)}
                >
                  <div className="font-medium">Court {courtNumber}</div>
                  <div className="flex items-center gap-2">
                    {expandedCourt === courtNumber ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>

                {expandedCourt === courtNumber && (
                  <div className="p-3 border-t">
                    <ul className="space-y-2">
                      {availabilityByCourtNumber[courtNumber]
                        .sort((a, b) => {
                          // Sort by time
                          return a.startTime.localeCompare(b.startTime);
                        })
                        .map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between items-center p-2 hover:bg-muted rounded-md"
                          >
                            <div>
                              <span className="font-medium">
                                {item.startTime.substring(0, 5)} -{" "}
                                {item.endTime.substring(0, 5)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  item.isAvailable ? "outline" : "destructive"
                                }
                                className={
                                  item.isAvailable
                                    ? "bg-green-50 text-green-600 hover:bg-green-100"
                                    : ""
                                }
                              >
                                {item.isAvailable ? "Available" : "Occupied"}
                              </Badge>

                              {user && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleAvailability(
                                      item.id,
                                      item.isAvailable,
                                    );
                                  }}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : item.isAvailable ? (
                                    "Mark Occupied"
                                  ) : (
                                    "Mark Available"
                                  )}
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
