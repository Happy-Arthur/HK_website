import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { facilityTypes, districts } from "@shared/schema";
import { Header } from "@/components/layout/header";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMutation } from "@tanstack/react-query";

// Profile form schema
const profileFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  phoneNumber: z.string().optional(),
  bio: z.string().optional(),
  preferredSports: z.array(z.string()).min(1, {
    message: "Please select at least one sport you're interested in.",
  }),
  skillLevel: z.record(z.string(), z.string()).optional(),
  preferredLocations: z.array(z.string()).min(1, {
    message: "Please select at least one preferred location.",
  }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  const [, setLocation] = useLocation();
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("POST", "/api/user/profile", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
      return await res.json();
    },
    onSuccess: (updatedUserData) => {
      // Directly update the user data in the cache
      queryClient.setQueryData(["/api/user"], updatedUserData);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      // Redirect to home page after profile update
      setTimeout(() => setLocation('/'), 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Create form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      bio: "",
      preferredSports: [],
      skillLevel: {},
      preferredLocations: [],
    },
  });

  // Handle form submission
  const onSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  // Update form with user data when it becomes available
  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        bio: user.bio || "",
        preferredSports: user.preferredSports || [],
        skillLevel: user.skillLevel || {},
        preferredLocations: user.preferredLocations || [],
      });
      setSelectedSports(user.preferredSports || []);
    }
  }, [user, form]);

  // Show loading state
  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // Redirect to login if user is not authenticated
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Function to get user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  // Handle sport selection
  const handleSportToggle = (sport: string) => {
    if (selectedSports.includes(sport)) {
      const updatedSports = selectedSports.filter(s => s !== sport);
      setSelectedSports(updatedSports);
      form.setValue("preferredSports", updatedSports);
    } else {
      const updatedSports = [...selectedSports, sport];
      setSelectedSports(updatedSports);
      form.setValue("preferredSports", updatedSports);
    }
  };

  // Set skill level for a sport
  const handleSkillLevelChange = (sport: string, level: string) => {
    const currentSkillLevels = form.getValues("skillLevel") || {};
    form.setValue("skillLevel", {
      ...currentSkillLevels,
      [sport]: level,
    });
  };

  return (
    <>
      <Header />
      <div className="container mx-auto py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col items-center text-center mb-8">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="bg-primary text-white text-2xl">
                {getInitials(user.fullName || user.username)}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="text-muted-foreground mt-2">
              Manage your personal information and preferences
            </p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your profile details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="your.email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+852 XXXX XXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <FormField
                      control={form.control}
                      name="preferredSports"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel>Preferred Sports</FormLabel>
                            <FormDescription>
                              Select the sports you're interested in
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {facilityTypes.map((sport) => (
                              <FormItem
                                key={sport}
                                className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={selectedSports.includes(sport)}
                                    onCheckedChange={() => handleSportToggle(sport)}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {sport.charAt(0).toUpperCase() + sport.slice(1)}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {selectedSports.length > 0 && (
                    <div>
                      <h3 className="text-md font-medium mb-2">Skill Levels</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedSports.map((sport) => (
                          <div 
                            key={`skill-${sport}`} 
                            className="p-3 border rounded-md"
                          >
                            <label className="block mb-2 text-sm font-medium">
                              {sport.charAt(0).toUpperCase() + sport.slice(1)}
                            </label>
                            <Select
                              defaultValue={form.getValues().skillLevel?.[sport] || "beginner"}
                              onValueChange={(value) => handleSkillLevelChange(sport, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                                <SelectItem value="expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <FormField
                      control={form.control}
                      name="preferredLocations"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel>Preferred Locations</FormLabel>
                            <FormDescription>
                              Select the districts you prefer to play in
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {districts.map((district) => (
                              <FormItem
                                key={district}
                                className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={(form.getValues().preferredLocations || []).includes(district)}
                                    onCheckedChange={(checked) => {
                                      const current = form.getValues().preferredLocations || [];
                                      const updated = checked
                                        ? [...current, district]
                                        : current.filter(d => d !== district);
                                      form.setValue("preferredLocations", updated, { shouldValidate: true });
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {district.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell others about yourself and your sports experience..."
                            className="resize-none h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Share your sports background, interests, or what you're looking to achieve.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}