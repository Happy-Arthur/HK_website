import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AchievementCard, type AchievementProgress } from "./achievement-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Award, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// Achievement categories
const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "checkin", label: "Check-ins" },
  { value: "events", label: "Events" },
  { value: "social", label: "Social" },
  { value: "reviews", label: "Reviews" },
];

export function UserAchievements() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch user achievements
  const { data: achievementsData = { achievements: [], totalPoints: 0 }, isLoading } = useQuery({
    queryKey: ["/api/achievements/my"],
    queryFn: async () => {
      if (!user) return { achievements: [], totalPoints: 0 };
      const response = await fetch("/api/achievements/my");
      if (!response.ok) {
        throw new Error("Failed to fetch user achievements");
      }
      return response.json();
    },
    enabled: !!user,
  });
  
  // Extract the achievements array from the response
  const achievements: AchievementProgress[] = achievementsData.achievements || [];
  
  // Calculate stats
  const totalPoints = achievements.reduce(
    (sum, a) => sum + (a.completed ? a.achievement.points : 0),
    0
  );
  
  const completedCount = achievements.filter(a => a.completed).length;
  const totalCount = achievements.length;
  
  // Filter achievements based on search query and category
  const filteredAchievements = achievements.filter(achievement => {
    const matchesSearch = 
      searchQuery === "" || 
      achievement.achievement.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      achievement.achievement.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === "all" || 
      achievement.achievement.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Separate completed and in-progress achievements
  const completedAchievements = filteredAchievements.filter(a => a.completed);
  const inProgressAchievements = filteredAchievements.filter(a => !a.completed && a.achievement.isActive);
  const lockedAchievements = filteredAchievements.filter(a => !a.achievement.isActive);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle category selection change
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  // Render skeleton loaders during loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
          <Award className="h-10 w-10 text-primary mr-4" />
          <div>
            <h3 className="text-lg font-medium">Achievement Progress</h3>
            <p className="text-2xl font-bold">{completedCount} / {totalCount}</p>
          </div>
        </div>
        
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
          <TrendingUp className="h-10 w-10 text-primary mr-4" />
          <div>
            <h3 className="text-lg font-medium">Total Points</h3>
            <p className="text-2xl font-bold">{totalPoints}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-8"
            />
          </div>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({filteredAchievements.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedAchievements.length})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({inProgressAchievements.length})</TabsTrigger>
          <TabsTrigger value="locked">Locked ({lockedAchievements.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {filteredAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAchievements.map(achievement => (
                <AchievementCard key={achievement.achievementId} achievement={achievement} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No achievements match your search criteria.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          {completedAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedAchievements.map(achievement => (
                <AchievementCard key={achievement.achievementId} achievement={achievement} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                You haven't completed any achievements in this category yet.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="in-progress" className="mt-6">
          {inProgressAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inProgressAchievements.map(achievement => (
                <AchievementCard key={achievement.achievementId} achievement={achievement} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                You don't have any in-progress achievements in this category.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="locked" className="mt-6">
          {lockedAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedAchievements.map(achievement => (
                <AchievementCard key={achievement.achievementId} achievement={achievement} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No locked achievements in this category.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}