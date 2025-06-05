import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Header } from "@/components/layout/header";
import { z } from "zod";
import { facilityTypes, districts, insertFacilitySchema } from "@shared/schema";

// Extend the facility schema with validation rules
const facilityFormSchema = insertFacilitySchema.extend({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  address: z.string().min(5, { message: "Address is required" }),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

type FacilityFormValues = z.infer<typeof facilityFormSchema>;

export default function FacilityFormPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const facilityId = new URLSearchParams(location.split('?')[1]).get('id');
  
  // Redirect if not admin
  useEffect(() => {
    if (user && !user.isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      navigate("/admin");
    }
  }, [user, navigate, toast]);

  // Get facility data if editing
  const facilityQuery = useQuery({
    queryKey: ["/api/facilities", facilityId],
    queryFn: async () => {
      if (!facilityId) return null;
      const res = await apiRequest("GET", `/api/facilities/${facilityId}`);
      return await res.json();
    },
    enabled: !!facilityId && !!user?.isAdmin,
  });

  // Form setup
  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "basketball",
      district: "central",
      address: "",
      latitude: 22.2783,  // Default to HK center
      longitude: 114.1747,
      openTime: "07:00:00",
      closeTime: "23:00:00",
      courts: 1,
      amenities: [],
      ageRestriction: "all_ages",
      genderSuitability: "all_genders",
    },
  });

  // Update form values when facility data is loaded
  useEffect(() => {
    if (facilityQuery.data) {
      form.reset({
        name: facilityQuery.data.name || "",
        description: facilityQuery.data.description || "",
        type: facilityQuery.data.type || "basketball",
        district: facilityQuery.data.district || "central",
        address: facilityQuery.data.address || "",
        latitude: facilityQuery.data.latitude || 22.2783,
        longitude: facilityQuery.data.longitude || 114.1747,
        openTime: facilityQuery.data.openTime || "07:00:00",
        closeTime: facilityQuery.data.closeTime || "23:00:00",
        courts: facilityQuery.data.courts || 1,
        amenities: facilityQuery.data.amenities || [],
        ageRestriction: facilityQuery.data.ageRestriction || "all_ages",
        genderSuitability: facilityQuery.data.genderSuitability || "all_genders",
      });
    }
  }, [facilityQuery.data, form]);

  // Create facility mutation
  const createFacilityMutation = useMutation({
    mutationFn: async (data: FacilityFormValues) => {
      const res = await apiRequest("POST", "/api/facilities", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Facility created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update facility mutation
  const updateFacilityMutation = useMutation({
    mutationFn: async (data: FacilityFormValues) => {
      const res = await apiRequest("PUT", `/api/facilities/${facilityId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Facility updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facilities", facilityId] });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FacilityFormValues) => {
    if (facilityId) {
      updateFacilityMutation.mutate(data);
    } else {
      createFacilityMutation.mutate(data);
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isLoading = 
    facilityId && facilityQuery.isLoading || 
    createFacilityMutation.isPending || 
    updateFacilityMutation.isPending;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="container mx-auto py-8">
        <Button 
          variant="outline" 
          className="mb-4"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>{facilityId ? "Edit Facility" : "Add New Facility"}</CardTitle>
            <CardDescription>
              {facilityId ? "Update facility information" : "Create a new sports facility"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {facilityId && facilityQuery.isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facility Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter facility name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facility Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
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

                    <FormField
                      control={form.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>District</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select district" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {districts.map((district) => (
                                <SelectItem key={district} value={district}>
                                  {district.split('_').map(word => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                  ).join(' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the facility" 
                            className="min-h-[100px]" 
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
                          <Input placeholder="Enter facility address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" {...field} />
                          </FormControl>
                          <FormDescription>
                            Hong Kong is around 22° N
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" {...field} />
                          </FormControl>
                          <FormDescription>
                            Hong Kong is around 114° E
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="openTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opening Time</FormLabel>
                          <FormControl>
                            <Input type="time" step="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="closeTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Closing Time</FormLabel>
                          <FormControl>
                            <Input type="time" step="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="courts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Courts</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ageRestriction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age Restriction</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select age restriction" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all_ages">All Ages</SelectItem>
                              <SelectItem value="adults_only">Adults Only (18+)</SelectItem>
                              <SelectItem value="seniors">Seniors (60+)</SelectItem>
                              <SelectItem value="youth">Youth (Under 18)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="genderSuitability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender Suitability</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender suitability" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all_genders">All Genders</SelectItem>
                              <SelectItem value="women_only">Women Only</SelectItem>
                              <SelectItem value="men_only">Men Only</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {facilityId ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {facilityId ? "Update Facility" : "Create Facility"}
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}