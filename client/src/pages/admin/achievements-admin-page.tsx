import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/query-client";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Award, Edit, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-request";

// Define the achievement schema for the form
const achievementFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  category: z.string(),
  points: z.coerce.number().int().min(1, "Points must be at least 1"),
  requirement: z.coerce.number().int().min(1, "Requirement must be at least 1"),
  level: z.coerce.number().int().min(1, "Level must be at least 1"),
  isActive: z.boolean().default(true),
  badgeUrl: z.string().optional(),
});

type AchievementFormValues = z.infer<typeof achievementFormSchema>;

// Categories for the select dropdown
const ACHIEVEMENT_CATEGORIES = [
  { value: "check_in", label: "Check-in" },
  { value: "review", label: "Review" },
  { value: "event", label: "Event" },
  { value: "social", label: "Social" },
  { value: "group", label: "Group" },
  { value: "challenge", label: "Challenge" },
  { value: "post", label: "Post" },
  { value: "milestone", label: "Milestone" },
];

export default function AchievementsAdminPage() {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all achievements
  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ["/api/achievements"],
    queryFn: async () => {
      const response = await fetch("/api/achievements");
      if (!response.ok) {
        throw new Error("Failed to fetch achievements");
      }
      return response.json();
    },
  });

  // Filter achievements based on search query
  const filteredAchievements = achievements.filter((achievement: any) =>
    achievement.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    achievement.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    achievement.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Form for creating/editing achievements
  const form = useForm<AchievementFormValues>({
    resolver: zodResolver(achievementFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "check_in",
      points: 10,
      requirement: 1,
      level: 1,
      isActive: true,
      badgeUrl: "/achievements/default.svg",
    },
  });

  // Create achievement mutation
  const createMutation = useMutation({
    mutationFn: async (data: AchievementFormValues) => {
      return apiRequest("/api/achievements", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Achievement created",
        description: "The achievement has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      form.reset();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create achievement. Please try again.",
        variant: "destructive",
      });
      console.error("Error creating achievement:", error);
    },
  });

  // Update achievement mutation
  const updateMutation = useMutation({
    mutationFn: async (data: AchievementFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest(`/api/achievements/${id}`, {
        method: "PUT",
        data: updateData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Achievement updated",
        description: "The achievement has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update achievement. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating achievement:", error);
    },
  });

  // Delete achievement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/achievements/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Achievement deleted",
        description: "The achievement has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete achievement. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting achievement:", error);
    },
  });

  // Handle form submission
  const onSubmit = (data: AchievementFormValues) => {
    if (currentAchievement) {
      updateMutation.mutate({ ...data, id: currentAchievement.id });
    } else {
      createMutation.mutate(data);
    }
  };

  // Open edit dialog for creating a new achievement
  const handleCreate = () => {
    setCurrentAchievement(null);
    form.reset({
      name: "",
      description: "",
      category: "check_in",
      points: 10,
      requirement: 1,
      level: 1,
      isActive: true,
      badgeUrl: "/achievements/default.svg",
    });
    setIsEditDialogOpen(true);
  };

  // Open edit dialog for editing an existing achievement
  const handleEdit = (achievement: any) => {
    setCurrentAchievement(achievement);
    form.reset({
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      points: achievement.points,
      requirement: achievement.requirement,
      level: achievement.level,
      isActive: achievement.isActive,
      badgeUrl: achievement.badgeUrl || "/achievements/default.svg",
    });
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const handleDeleteConfirm = (achievement: any) => {
    setCurrentAchievement(achievement);
    setIsDeleteDialogOpen(true);
  };

  // Format category for display
  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AdminHeader />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Manage Achievements</h1>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Achievement
          </Button>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Achievement Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
                <Award className="h-10 w-10 text-primary mr-4" />
                <div>
                  <h3 className="text-lg font-medium">Total Achievements</h3>
                  <p className="text-2xl font-bold">{achievements.length}</p>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
                <Award className="h-10 w-10 text-primary mr-4" />
                <div>
                  <h3 className="text-lg font-medium">Active Achievements</h3>
                  <p className="text-2xl font-bold">
                    {achievements.filter((a: any) => a.isActive).length}
                  </p>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
                <Award className="h-10 w-10 text-primary mr-4" />
                <div>
                  <h3 className="text-lg font-medium">Categories</h3>
                  <p className="text-2xl font-bold">
                    {new Set(achievements.map((a: any) => a.category)).size}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="mb-6">
          <div className="relative">
            <Input
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-10">
            <div className="spinner h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading achievements...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAchievements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      No achievements found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAchievements.map((achievement: any) => (
                    <TableRow key={achievement.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{achievement.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {achievement.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatCategory(achievement.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>{achievement.points}</TableCell>
                      <TableCell>{achievement.requirement}</TableCell>
                      <TableCell>{achievement.level}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            achievement.isActive
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                          }
                        >
                          {achievement.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(achievement)}
                          title="Edit achievement"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteConfirm(achievement)}
                          title="Delete achievement"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
      
      {/* Edit/Create Achievement Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {currentAchievement ? "Edit Achievement" : "Create Achievement"}
            </DialogTitle>
            <DialogDescription>
              {currentAchievement
                ? "Update the details of an existing achievement."
                : "Create a new achievement to reward users."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="First Check-in" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACHIEVEMENT_CATEGORIES.map((category) => (
                            <SelectItem
                              key={category.value}
                              value={category.value}
                            >
                              {category.label}
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
                        {...field}
                        placeholder="Check in to your first sports facility"
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="points"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Points</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          placeholder="10"
                        />
                      </FormControl>
                      <FormDescription>
                        Points awarded for completing this achievement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="requirement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirement</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          placeholder="1"
                        />
                      </FormControl>
                      <FormDescription>
                        Number of actions required to complete
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          placeholder="1"
                        />
                      </FormControl>
                      <FormDescription>
                        Difficulty level of the achievement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="badgeUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="/achievements/default.svg"
                        />
                      </FormControl>
                      <FormDescription>
                        Path to the achievement badge image
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Active Status
                        </FormLabel>
                        <FormDescription>
                          Is this achievement currently active and available to users?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {currentAchievement ? "Update Achievement" : "Create Achievement"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the achievement "
              {currentAchievement?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(currentAchievement?.id)}
            >
              Delete Achievement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}