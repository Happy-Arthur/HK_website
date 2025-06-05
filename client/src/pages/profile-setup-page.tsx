import ProfileForm, { ProfileFormValues } from "@/components/auth/profile-form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect } from "react";
import { Redirect } from "wouter";

export default function ProfileSetupPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  // Handle profile form submission
  async function onSubmit(data: ProfileFormValues) {
    try {
      // Update user profile
      const response = await apiRequest("POST", "/api/user/profile", data);

      if (response.ok) {
        // Parse the updated user data
        const updatedUserData = await response.json();
        
        // Update the user data in the query cache
        queryClient.setQueryData(["/api/user"], updatedUserData);
        
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully completed.",
        });

        // Navigate to home page after profile setup
        window.location.replace("/");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    }
  }

  // Redirect to home if user is already logged in and has completed profile
  // In a real app, you'd check if the user has already completed their profile
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Initialize default values for the form
  const defaultValues: Partial<ProfileFormValues> = {
    fullName: user.fullName || "",
    email: user.email || "",
    preferredSports: user.preferredSports || [],
    skillLevel: (user.skillLevel || {}) as Record<string, string>,
    preferredLocations: user.preferredLocations || [],
    bio: user.bio || "",
    phoneNumber: user.phoneNumber || "",
  };

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground mt-2">
            Tell us about your sports preferences to enhance your experience
          </p>
        </div>

        <ProfileForm defaultValues={defaultValues} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
