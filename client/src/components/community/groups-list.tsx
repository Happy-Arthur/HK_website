import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus2, 
  UserX2, 
  Lock, 
  Unlock,
  Circle
} from "lucide-react";
import { facilityTypes } from "@shared/schema";
import { CreateGroupDialog } from "./create-group-dialog";

type Group = {
  id: number;
  name: string;
  description: string;
  sportType: string;
  district: string;
  imageUrl: string | null;
  creatorId: number;
  isPrivate: boolean;
  memberCount: number;
  createdAt: string;
};

export function GroupsList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sportTypeFilter, setSportTypeFilter] = useState("");
  const [view, setView] = useState<"all" | "my-groups">("all");

  // Fetch all groups with filters
  const { 
    data: allGroups, 
    isLoading: isLoadingAllGroups, 
    error: allGroupsError 
  } = useQuery({
    queryKey: ["/api/groups", searchQuery, sportTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("query", searchQuery);
      if (sportTypeFilter && sportTypeFilter !== "all") params.append("type", sportTypeFilter);
      
      const url = `/api/groups${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      
      return response.json() as Promise<Group[]>;
    },
  });
  
  // Fetch user's joined groups
  const {
    data: myGroups,
    isLoading: isLoadingMyGroups,
    error: myGroupsError
  } = useQuery({
    queryKey: ["/api/groups/my-groups"],
    queryFn: async () => {
      const response = await fetch("/api/groups/my-groups");
      
      if (!response.ok) {
        if (response.status === 401) {
          // User not logged in - this is expected
          return [];
        }
        throw new Error("Failed to fetch your groups");
      }
      
      return response.json() as Promise<Group[]>;
    },
    enabled: !!user, // Only run this query if the user is logged in
  });

  // Handle errors with useEffect instead of during render
  useEffect(() => {
    if (allGroupsError) {
      toast({
        title: "Error",
        description: "Failed to load groups. Please try again later.",
        variant: "destructive",
      });
    }
    
    if (myGroupsError && myGroupsError instanceof Error) {
      // Only show error for my groups if it's not a 401 (unauthorized)
      toast({
        title: "Error",
        description: "Failed to load your groups. Please try again later.",
        variant: "destructive",
      });
    }
  }, [allGroupsError, myGroupsError, toast]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The query will be automatically triggered due to the queryKey
  };

  // Compute the groups to display based on current view
  const displayGroups = useMemo(() => {
    if (view === "my-groups") {
      return myGroups || [];
    } else {
      return allGroups || [];
    }
  }, [view, allGroups, myGroups]);
  
  // Render loading state
  if (isLoadingAllGroups && view === "all") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">Sport Groups</h2>
          <CreateGroupDialog />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <Tabs 
            value={view} 
            onValueChange={(v) => setView(v as "all" | "my-groups")}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="all">All Groups</TabsTrigger>
              {user && <TabsTrigger value="my-groups">My Groups</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-64">
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (isLoadingMyGroups && view === "my-groups") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <h2 className="text-2xl font-bold">My Groups</h2>
          <CreateGroupDialog />
        </div>
        
        <div className="flex items-center gap-4 mb-6">
          <Tabs 
            value={view} 
            onValueChange={(v) => setView(v as "all" | "my-groups")}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="all">All Groups</TabsTrigger>
              {user && <TabsTrigger value="my-groups">My Groups</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="h-64">
              <CardHeader>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">
          {view === "my-groups" ? "My Groups" : "Sport Groups"}
        </h2>
        <CreateGroupDialog />
      </div>
      
      {/* View Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <Tabs 
          value={view} 
          onValueChange={(v) => setView(v as "all" | "my-groups")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="all">All Groups</TabsTrigger>
            {user && <TabsTrigger value="my-groups">My Groups</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>
      
      {/* Search and Filter - only show in "all" view */}
      {view === "all" && (
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search groups..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={sportTypeFilter}
              onValueChange={setSportTypeFilter}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sport type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sports</SelectItem>
                {facilityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
      )}
      
      {/* Groups List */}
      {displayGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayGroups.map((group) => (
            <Card key={group.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {group.name}
                      {group.isPrivate && (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {group.district.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {group.sportType === "basketball" ? (
                      <Circle className="h-3 w-3 fill-primary" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    )}
                    {group.sportType.charAt(0).toUpperCase() + group.sportType.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {group.description}
                </p>
              </CardContent>
              
              <CardFooter className="flex justify-between border-t pt-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="h-4 w-4 mr-1" />
                  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                </div>
                
                <Button asChild size="sm" variant="outline">
                  <Link to={`/groups/${group.id}`}>
                    View Group
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">
            {view === "my-groups" 
              ? "You haven't joined any groups yet" 
              : "No groups found"
            }
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {view === "my-groups"
              ? "Join an existing group or create your own!"
              : searchQuery || sportTypeFilter 
                ? "Try adjusting your filters to find more groups" 
                : "Be the first to create a group!"
            }
          </p>
          {view === "my-groups" && (
            <Button 
              onClick={() => setView("all")}
              variant="outline"
              className="mb-4"
            >
              Browse all groups
            </Button>
          )}
          <CreateGroupDialog />
        </div>
      )}
    </div>
  );
}