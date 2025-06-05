import React from "react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { UserAchievements } from "@/components/achievements/user-achievements";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2 } from "lucide-react";

export default function AchievementsPage() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    // Handle not authenticated case
    // (though this should be caught by ProtectedRoute already)
    return null;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <PageHeader
          heading="Achievements"
          subheading="Track your progress and earn rewards as you explore Hong Kong sports facilities."
        />
        
        <UserAchievements />
      </main>
    </div>
  );
}