import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Search,
  Trash2,
  Users,
  Flag,
  Edit,
  Check,
  Calendar,
  Mail,
  ArrowLeft,
  Trophy,
} from "lucide-react";
import { Link } from "wouter";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { TokenRefresher } from "@/components/auth/token-refresher";
import { AdminDebug } from "@/components/admin/admin-debug";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import WebSearch from "@/components/admin/web-search";

type Group = {
  id: number;
  name: string;
  description: string | null;
  creatorId: number;
  sportType: string | null;
  district: string | null;
  createdAt: string | null;
  isPrivate: boolean;
  memberCount: number | null;
  imageUrl: string | null;
};

type GroupMember = {
  groupId: number;
  userId: number;
  role: "member" | "admin" | "owner";
  username: string;
  email?: string;
};

type User = {
  id: number;
  username: string;
  email: string | null;
  createdAt: string | null;
  firstname?: string | null;
  lastname?: string | null;
  bio?: string | null;
  preferredSports?: string[] | null;
  skillLevel?: Record<string, string> | null;
  profileImage?: string | null;
  isAdmin?: boolean;
};

type Post = {
  id: number;
  content: string;
  userId: number;
  username?: string;
  groupId: number | null;
  createdAt: string;
  updatedAt: string | null;
  imageUrl: string | null;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
};

type Event = {
  id: number;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  facilityId: number | null;
  facilityName?: string;
  creatorId: number;
  type: string | null;
  address: string | null;
  location: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
  imageUrl: string | null;
  website: string | null;
  eventDate?: string;
  sportType?: string;
  skillLevel?: string;
  maxParticipants?: number;
  isOfficial?: boolean;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [facilitySearchQuery, setFacilitySearchQuery] = useState("");
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [viewingGroupId, setViewingGroupId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [importingFacility, setImportingFacility] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [editingFacility, setEditingFacility] = useState<any | null>(null);

  // Check if user has admin privileges
  const isAdmin = user?.isAdmin === true;

  // Fetch all groups
  const {
    data: groups,
    isLoading: isLoadingGroups,
    error: groupsError,
  } = useQuery({
    queryKey: ["/api/admin/groups"],
    queryFn: async () => {
      if (!isAdmin) return null;
      console.log("Fetching groups for admin");
      try {
        const res = await fetch("/api/admin/groups", {
          credentials: "include", // Explicitly include credentials
        });

        console.log("Admin groups fetch status:", res.status);

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Failed to fetch groups: ${res.status} - ${errorText}`);
          throw new Error(`Failed to fetch groups: ${errorText}`);
        }

        const data = await res.json();
        console.log(`Successfully fetched ${data.length} groups`);
        return data;
      } catch (error) {
        console.error("Error fetching groups:", error);
        throw error;
      }
    },
    enabled: !!isAdmin,
  });

  // Fetch group members when a group is selected
  const {
    data: groupMembers,
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery({
    queryKey: ["/api/admin/groups", viewingGroupId, "members"],
    queryFn: async () => {
      if (!isAdmin || !viewingGroupId) return null;
      console.log(`Fetching members for group ${viewingGroupId}`);
      try {
        const res = await fetch(`/api/admin/groups/${viewingGroupId}/members`, {
          credentials: "include", // Explicitly include credentials
        });

        console.log(
          `Group ${viewingGroupId} members fetch status:`,
          res.status,
        );

        if (!res.ok) {
          const errorText = await res.text();
          console.error(
            `Failed to fetch members: ${res.status} - ${errorText}`,
          );
          throw new Error(`Failed to fetch members: ${errorText}`);
        }

        const data = await res.json();
        console.log(
          `Successfully fetched ${data.length} members for group ${viewingGroupId}`,
        );
        return data;
      } catch (error) {
        console.error("Error fetching members:", error);
        throw error;
      }
    },
    enabled: !!isAdmin && !!viewingGroupId,
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      console.log(`Deleting group ${groupId}`);
      const res = await apiRequest("DELETE", `/api/admin/groups/${groupId}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete group: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Group deleted",
        description: "The group has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async ({
      userId,
      groupId,
      message,
    }: {
      userId: number;
      groupId: number;
      message: string;
    }) => {
      console.log(
        `Sending notification to user ${userId} about group ${groupId}`,
      );
      const res = await apiRequest("POST", `/api/admin/notify`, {
        userId,
        groupId,
        message,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to send notification: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Notification sent",
        description: "The notification has been sent successfully",
      });
      setNotifyDialogOpen(false);
      setNotificationMessage("");
      setSelectedUserId(null);
      setSelectedGroupId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle user admin status mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log(`Toggling admin status for user ${userId}`);
      const res = await apiRequest(
        "POST",
        `/api/admin/users/${userId}/toggle-admin`,
      );
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to toggle admin status: ${errorText}`);
      }
      return await res.json();
    },
    // In your admin dashboard, modify the toggleAdminMutation:
    onSuccess: async (data, variables) => {
      toast({
        title: "Admin status updated",
        description: "The user's admin status has been updated",
      });

      // If the user toggled their own admin status, refresh their token
      if (user && variables === user.id) {
        try {
          const res = await apiRequest("POST", "/api/refresh-token");
          const refreshData = await res.json();

          // Update the token in localStorage
          if (refreshData.token) {
            localStorage.setItem("auth_token", refreshData.token);
          }

          // Update the user data in the cache
          queryClient.setQueryData(["/api/user"], refreshData);

          // Notify the user to refresh their page
          toast({
            title: "Admin privileges updated",
            description:
              "Please refresh the page to apply your new permissions",
          });
        } catch (error) {
          console.error("Failed to refresh token:", error);
          toast({
            title: "Token refresh failed",
            description:
              "Please log out and log back in to apply admin changes",
            variant: "destructive",
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update admin status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch all users
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!isAdmin,
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log(`Deleting user ${userId}`);
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete user: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch all posts
  const {
    data: posts,
    isLoading: isLoadingPosts,
    error: postsError,
  } = useQuery({
    queryKey: ["/api/admin/posts"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!isAdmin,
  });

  // Edit post mutation
  const editPostMutation = useMutation({
    mutationFn: async ({
      postId,
      content,
    }: {
      postId: number;
      content: string;
    }) => {
      console.log(`Editing post ${postId}`);
      const res = await apiRequest("PUT", `/api/admin/posts/${postId}`, {
        content,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to update post: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Post updated",
        description: "The post has been successfully updated",
      });
      setEditPostDialogOpen(false);
      setEditingPost(null);
      setEditPostContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      console.log(`Deleting post ${postId}`);
      const res = await apiRequest("DELETE", `/api/admin/posts/${postId}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete post: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Post deleted",
        description: "The post has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch events
  const {
    data: events,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery({
    queryKey: ["/api/events"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!isAdmin,
  });

  // Fetch facilities
  const {
    data: facilities,
    isLoading: isLoadingFacilities,
    error: facilitiesError,
    refetch: refetchFacilities,
  } = useQuery({
    queryKey: ["/api/facilities"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!isAdmin,
  });

  // Import facility mutation
  const importFacilityMutation = useMutation({
    mutationFn: async (query: string) => {
      console.log(`Importing facility with query: ${query}`);
      const res = await apiRequest("POST", `/api/admin/facilities/import`, {
        query,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to import facility: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Facility imported",
        description: "The facility has been successfully imported",
      });
      setImportingFacility(false);
      setImportQuery("");
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to import facility",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update facility mutation
  const updateFacilityMutation = useMutation({
    mutationFn: async (facility: any) => {
      console.log(`Updating facility ${facility.id}`);
      const res = await apiRequest(
        "PUT",
        `/api/admin/facilities/${facility.id}`,
        facility,
      );
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to update facility: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Facility updated",
        description: "The facility has been successfully updated",
      });
      setEditingFacility(null);
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update facility",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (event: Event) => {
      console.log(`Updating event ${event.id}`);
      const res = await apiRequest(
        "PUT",
        `/api/admin/events/${event.id}`,
        event,
      );
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to update event: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "The event has been successfully updated",
      });
      setEditingEvent(null);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      console.log(`Deleting event ${eventId}`);
      const res = await apiRequest("DELETE", `/api/admin/events/${eventId}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete event: ${errorText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "The event has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter groups based on search
  const filteredGroups =
    Array.isArray(groups) && searchQuery
      ? groups.filter(
          (group: Group) =>
            group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (group.description &&
              group.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase())),
        )
      : Array.isArray(groups)
        ? groups
        : [];

  // Filter events based on search
  const filteredEvents =
    Array.isArray(events) && eventSearchQuery
      ? events.filter(
          (event: Event) =>
            event.name.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
            (event.description &&
              event.description
                .toLowerCase()
                .includes(eventSearchQuery.toLowerCase())),
        )
      : Array.isArray(events)
        ? events
        : [];

  // Filter users based on search
  const filteredUsers =
    Array.isArray(users) && userSearchQuery
      ? users.filter(
          (user: User) =>
            user.username
              .toLowerCase()
              .includes(userSearchQuery.toLowerCase()) ||
            (user.email &&
              user.email.toLowerCase().includes(userSearchQuery.toLowerCase())),
        )
      : Array.isArray(users)
        ? users
        : [];

  // Filter posts based on search query
  const filteredPosts =
    Array.isArray(posts) && postSearchQuery
      ? posts.filter(
          (post: Post) =>
            post.content
              .toLowerCase()
              .includes(postSearchQuery.toLowerCase()) ||
            (post.username &&
              post.username
                .toLowerCase()
                .includes(postSearchQuery.toLowerCase())),
        )
      : Array.isArray(posts)
        ? posts
        : [];

  // Filter facilities based on search
  const filteredFacilities =
    Array.isArray(facilities) && facilitySearchQuery
      ? facilities.filter(
          (facility: any) =>
            facility.name
              .toLowerCase()
              .includes(facilitySearchQuery.toLowerCase()) ||
            (facility.address &&
              facility.address
                .toLowerCase()
                .includes(facilitySearchQuery.toLowerCase())) ||
            (facility.sportType &&
              facility.sportType
                .toLowerCase()
                .includes(facilitySearchQuery.toLowerCase())),
        )
      : Array.isArray(facilities)
        ? facilities
        : [];

  return (
    <div className="container py-10">
      <div className="flex items-center mb-8 gap-4">
        <Link to="/">
          <Button
            variant="outline"
            size="icon"
            className="mr-2"
            title="Back to Home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Token refresher handles authentication issues */}
      <TokenRefresher />

      <AdminDebug />

      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="flex overflow-x-auto space-x-2 mb-6">
          <TabsTrigger className="flex-none px-4 py-2" value="groups">
            Groups Management
          </TabsTrigger>
          <TabsTrigger className="flex-none px-4 py-2" value="events">
            Events Management
          </TabsTrigger>
          <TabsTrigger className="flex-none px-4 py-2" value="facilities">
            Facilities Management
          </TabsTrigger>
          <TabsTrigger className="flex-none px-4 py-2" value="users">
            User Management
          </TabsTrigger>
          <TabsTrigger className="flex-none px-4 py-2" value="posts">
            Posts Management
          </TabsTrigger>
          <TabsTrigger className="flex-none px-4 py-2" value="achievements">
            Achievements Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle>Groups Management</CardTitle>
              <CardDescription>
                Manage all groups in the system. You can view, delete, and
                manage group members.
              </CardDescription>
              <div className="flex items-center space-x-2 mt-4">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingGroups ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : groupsError ? (
                <div className="text-center text-red-500 p-4">
                  Error loading groups: {groupsError.toString()}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Sport Type</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Private</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-8"
                        >
                          No groups found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map((group: Group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">
                            {group.name}
                          </TableCell>
                          <TableCell>{group.sportType || "N/A"}</TableCell>
                          <TableCell>{group.memberCount || 0}</TableCell>
                          <TableCell>
                            {group.isPrivate ? "Yes" : "No"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingGroupId(group.id)}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Members
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Are you sure?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the group "
                                      {group.name}" and all associated data.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteGroupMutation.mutate(group.id)
                                      }
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Group Members Dialog */}
              {viewingGroupId && (
                <Dialog
                  open={!!viewingGroupId}
                  onOpenChange={(open) => {
                    if (!open) setViewingGroupId(null);
                  }}
                >
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>
                        Members of{" "}
                        {Array.isArray(groups)
                          ? groups.find((g: Group) => g.id === viewingGroupId)
                              ?.name
                          : ""}
                      </DialogTitle>
                      <DialogDescription>
                        Manage the members of this group.
                      </DialogDescription>
                    </DialogHeader>

                    {isLoadingMembers ? (
                      <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : membersError ? (
                      <div className="text-center text-red-500 p-4">
                        Error loading members: {membersError.toString()}
                      </div>
                    ) : (
                      <div className="py-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Username</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupMembers?.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center text-gray-500 py-8"
                                >
                                  No members found
                                </TableCell>
                              </TableRow>
                            ) : (
                              groupMembers.map((member: GroupMember) => (
                                <TableRow key={member.userId}>
                                  <TableCell className="font-medium">
                                    {member.username}
                                  </TableCell>
                                  <TableCell>{member.email || "N/A"}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        member.role === "owner"
                                          ? "bg-blue-100 text-blue-800"
                                          : member.role === "admin"
                                            ? "bg-purple-100 text-purple-800"
                                            : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {member.role}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedUserId(member.userId);
                                          setSelectedGroupId(member.groupId);
                                          setNotifyDialogOpen(true);
                                        }}
                                      >
                                        <Flag className="h-4 w-4 mr-1" />
                                        Notify
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Import Events</CardTitle>
              <CardDescription>
                Search for and import events from external sources using
                Perplexity API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebSearch
                onAddSuccess={() => {
                  toast({
                    title: "Event imported",
                    description: "Event has been successfully imported",
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Events Management</CardTitle>
              <CardDescription>
                Manage all events in the system. You can view, edit, and delete
                events.
              </CardDescription>
              <div className="flex items-center space-x-2 mt-4">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search events..."
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : eventsError ? (
                <div className="text-center text-red-500 p-4">
                  Error loading events: {eventsError.toString()}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-8"
                        >
                          No events found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEvents.map((event: Event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.name}
                          </TableCell>
                          <TableCell>{event.type || "N/A"}</TableCell>
                          <TableCell>
                            {new Date(event.startTime).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {event.location || event.address || "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingEvent(event)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Are you sure?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the event "
                                      {event.name}" and all associated data.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteEventMutation.mutate(event.id)
                                      }
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Event Edit Dialog */}
              {editingEvent && (
                <Dialog
                  open={!!editingEvent}
                  onOpenChange={(open) => {
                    if (!open) setEditingEvent(null);
                  }}
                >
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Edit Event: {editingEvent.name}</DialogTitle>
                      <DialogDescription>
                        Update the event details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eventName">Event Name</Label>
                          <Input
                            id="eventName"
                            value={editingEvent.name}
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventType">Event Type</Label>
                          <Input
                            id="eventType"
                            value={editingEvent.type || ""}
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                type: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eventDescription">Description</Label>
                        <Textarea
                          id="eventDescription"
                          value={editingEvent.description || ""}
                          onChange={(e) =>
                            setEditingEvent({
                              ...editingEvent,
                              description: e.target.value,
                            })
                          }
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eventStartTime">Start Time</Label>
                          <Input
                            id="eventStartTime"
                            type="datetime-local"
                            value={
                              editingEvent.startTime
                                ? typeof editingEvent.startTime === "string"
                                  ? editingEvent.startTime.includes("T")
                                    ? editingEvent.startTime.slice(0, 16)
                                    : editingEvent.startTime
                                  : (editingEvent.startTime as any)
                                      ?.toISOString?.()
                                      ?.slice(0, 16) || ""
                                : ""
                            }
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                startTime: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventEndTime">End Time</Label>
                          <Input
                            id="eventEndTime"
                            type="datetime-local"
                            value={
                              editingEvent.endTime
                                ? typeof editingEvent.endTime === "string"
                                  ? editingEvent.endTime.includes("T")
                                    ? editingEvent.endTime.slice(0, 16)
                                    : editingEvent.endTime
                                  : (editingEvent.endTime as any)
                                      ?.toISOString?.()
                                      ?.slice(0, 16) || ""
                                : ""
                            }
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                endTime: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eventLocation">Location</Label>
                          <Input
                            id="eventLocation"
                            value={editingEvent.location || ""}
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                location: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventAddress">Address</Label>
                          <Input
                            id="eventAddress"
                            value={editingEvent.address || ""}
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eventDistrict">District</Label>
                          <Input
                            id="eventDistrict"
                            value={editingEvent.district || ""}
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                district: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventSportType">Sport Type</Label>
                          <Input
                            id="eventSportType"
                            value={editingEvent.sportType || ""}
                            onChange={(e) =>
                              setEditingEvent({
                                ...editingEvent,
                                sportType: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setEditingEvent(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => updateEventMutation.mutate(editingEvent)}
                        disabled={updateEventMutation.isPending}
                      >
                        {updateEventMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facilities">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Import Facilities</CardTitle>
              <CardDescription>
                Search for and import facilities from external sources using
                Google Maps API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebSearch
                onAddSuccess={() => {
                  toast({
                    title: "Facility imported",
                    description: "Facility has been successfully imported",
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["/api/facilities"],
                  });
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Facilities Management</CardTitle>
              <CardDescription>
                Manage sports facilities in the system. You can view, import,
                and edit facilities.
              </CardDescription>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Search facilities..."
                    value={facilitySearchQuery}
                    onChange={(e) => setFacilitySearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Button onClick={() => setImportingFacility(true)}>
                  Import New Facility
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingFacilities ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : facilitiesError ? (
                <div className="text-center text-red-500 p-4">
                  Error loading facilities: {facilitiesError.toString()}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Sport Type</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFacilities.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-8"
                        >
                          No facilities found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFacilities.map((facility: any) => (
                        <TableRow key={facility.id}>
                          <TableCell className="font-medium">
                            {facility.name}
                          </TableCell>
                          <TableCell>{facility.sportType || "N/A"}</TableCell>
                          <TableCell>{facility.address || "N/A"}</TableCell>
                          <TableCell>{facility.district || "N/A"}</TableCell>
                          <TableCell>
                            {facility.rating !== undefined &&
                            facility.rating !== null
                              ? `${Number(facility.rating).toFixed(1)} / 5.0`
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingFacility(facility);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Import Facility Dialog */}
              {importingFacility && (
                <Dialog
                  open={importingFacility}
                  onOpenChange={(open) => {
                    if (!open) setImportingFacility(false);
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import New Facility</DialogTitle>
                      <DialogDescription>
                        Search for a facility to import or enter facility
                        details manually.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="importQuery">Search Query</Label>
                        <Input
                          id="importQuery"
                          placeholder="Enter facility name or location"
                          value={importQuery}
                          onChange={(e) => setImportQuery(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Example: "basketball court in Kowloon" or "Victoria
                          Park Tennis Courts"
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setImportingFacility(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          importFacilityMutation.mutate(importQuery)
                        }
                        disabled={
                          !importQuery.trim() ||
                          importFacilityMutation.isPending
                        }
                      >
                        {importFacilityMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Import
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Edit Facility Dialog */}
              {editingFacility && (
                <Dialog
                  open={!!editingFacility}
                  onOpenChange={(open) => {
                    if (!open) setEditingFacility(null);
                  }}
                >
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        Edit Facility: {editingFacility.name}
                      </DialogTitle>
                      <DialogDescription>
                        Update the facility details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="facilityName">Facility Name</Label>
                          <Input
                            id="facilityName"
                            value={editingFacility.name}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="facilitySportType">Sport Type</Label>
                          <Input
                            id="facilitySportType"
                            value={editingFacility.sportType || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                sportType: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facilityDescription">Description</Label>
                        <Textarea
                          id="facilityDescription"
                          value={editingFacility.description || ""}
                          onChange={(e) =>
                            setEditingFacility({
                              ...editingFacility,
                              description: e.target.value,
                            })
                          }
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="facilityAddress">Address</Label>
                          <Input
                            id="facilityAddress"
                            value={editingFacility.address || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="facilityDistrict">District</Label>
                          <Input
                            id="facilityDistrict"
                            value={editingFacility.district || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                district: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="facilityLatitude">Latitude</Label>
                          <Input
                            id="facilityLatitude"
                            type="number"
                            step="0.000001"
                            value={editingFacility.latitude || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                latitude: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="facilityLongitude">Longitude</Label>
                          <Input
                            id="facilityLongitude"
                            type="number"
                            step="0.000001"
                            value={editingFacility.longitude || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                longitude: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="facilityOpenTime">Opening Time</Label>
                          <Input
                            id="facilityOpenTime"
                            type="time"
                            value={editingFacility.openTime || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                openTime: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="facilityCloseTime">
                            Closing Time
                          </Label>
                          <Input
                            id="facilityCloseTime"
                            type="time"
                            value={editingFacility.closeTime || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                closeTime: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="facilityWebsite">Website</Label>
                        <Input
                          id="facilityWebsite"
                          value={editingFacility.website || ""}
                          onChange={(e) =>
                            setEditingFacility({
                              ...editingFacility,
                              website: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="facilityImageUrl">
                            Facility Photo URL
                          </Label>
                          <Input
                            id="facilityImageUrl"
                            value={editingFacility.imageUrl || ""}
                            onChange={(e) =>
                              setEditingFacility({
                                ...editingFacility,
                                imageUrl: e.target.value,
                              })
                            }
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>

                        {editingFacility.imageUrl && (
                          <div className="mt-2 border rounded-md overflow-hidden">
                            <div className="aspect-video relative bg-muted max-h-[200px]">
                              <img
                                src={editingFacility.imageUrl}
                                alt={editingFacility.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    "https://images.unsplash.com/photo-1544033527-b543afc4383f?q=80&w=400&h=300&fit=crop";
                                  e.currentTarget.alt =
                                    "Image preview unavailable";
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setEditingFacility(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          updateFacilityMutation.mutate(editingFacility)
                        }
                        disabled={updateFacilityMutation.isPending}
                      >
                        {updateFacilityMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage all users in the system. You can view, delete, and adjust
                user permissions.
              </CardDescription>
              <div className="flex items-center space-x-2 mt-4">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : usersError ? (
                <div className="text-center text-red-500 p-4">
                  Error loading users: {usersError.toString()}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-8"
                        >
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((userData: User) => (
                        <TableRow key={userData.id}>
                          <TableCell className="font-medium">
                            {userData.username}
                          </TableCell>
                          <TableCell>{userData.email || "N/A"}</TableCell>
                          <TableCell>
                            {userData.createdAt
                              ? formatDistanceToNow(
                                  new Date(userData.createdAt),
                                  {
                                    addSuffix: true,
                                  },
                                )
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Switch
                                checked={userData.isAdmin === true}
                                onCheckedChange={() =>
                                  toggleAdminMutation.mutate(userData.id)
                                }
                                disabled={userData.id === 3} // Can't toggle the primary admin
                              />
                              <span className="ml-2">
                                {userData.isAdmin === true ? "Yes" : "No"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUserId(userData.id);
                                  setNotificationMessage("");
                                  setNotifyDialogOpen(true);
                                }}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Notify
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={
                                      userData.id === 1 || userData.id === 3
                                    } // Can't delete admin users
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Are you sure?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the user "
                                      {userData.username}" and all associated
                                      data. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteUserMutation.mutate(userData.id)
                                      }
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle>Posts Management</CardTitle>
              <CardDescription>
                Manage all posts in the system. You can view, edit, and delete
                posts.
              </CardDescription>
              <div className="flex items-center space-x-2 mt-4">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search posts by content or username..."
                  value={postSearchQuery}
                  onChange={(e) => setPostSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPosts ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : postsError ? (
                <div className="text-center text-red-500 p-4">
                  Error loading posts: {postsError.toString()}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Author</TableHead>
                      <TableHead className="w-1/2">Content</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Likes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-8"
                        >
                          No posts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPosts.map((post: Post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-medium">
                            {post.username || `User #${post.userId}`}
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {post.content}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(post.createdAt), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell>{post.likeCount || 0}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingPost(post);
                                  setEditPostContent(post.content);
                                  setEditPostDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Are you sure?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this post and
                                      all associated comments and likes. This
                                      action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deletePostMutation.mutate(post.id)
                                      }
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Edit Post Dialog */}
              <Dialog
                open={editPostDialogOpen}
                onOpenChange={setEditPostDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Post</DialogTitle>
                    <DialogDescription>
                      Update the content of this post. This will immediately be
                      visible to all users.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="post-content">Content</Label>
                      <Textarea
                        id="post-content"
                        placeholder="Post content..."
                        value={editPostContent}
                        onChange={(e) => setEditPostContent(e.target.value)}
                        rows={6}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setEditPostDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingPost) {
                          editPostMutation.mutate({
                            postId: editingPost.id,
                            content: editPostContent,
                          });
                        }
                      }}
                      disabled={!editPostContent.trim()}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="achievements">
          <Card>
            <CardHeader>
              <CardTitle>Achievements Management</CardTitle>
              <CardDescription>
                Manage the achievements system. View, create, edit, and delete
                achievements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Achievements</h2>
                <Link to="/admin/achievements">
                  <Button>
                    <span>Manage Achievements</span>
                    <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-600 mb-4">
                    The achievements system allows users to earn badges and
                    points as they interact with the platform. Achievements can
                    be awarded for activities such as:
                  </p>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    <li>Checking in to facilities</li>
                    <li>Posting reviews</li>
                    <li>Participating in events</li>
                    <li>Creating and joining groups</li>
                    <li>Creating posts and social interactions</li>
                  </ul>
                  <p className="text-sm text-slate-600 mt-4">
                    Click the "Manage Achievements" button to access the full
                    achievements management interface where you can create,
                    edit, and delete achievements.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
                    <div className="p-3 rounded-full bg-primary/10 mr-4">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">
                        Default Achievements
                      </h3>
                      <p className="text-sm text-slate-600">
                        The system has default achievements that users can earn
                      </p>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
                    <div className="p-3 rounded-full bg-primary/10 mr-4">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">User Engagement</h3>
                      <p className="text-sm text-slate-600">
                        Achievements boost user engagement and retention
                      </p>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center">
                    <div className="p-3 rounded-full bg-primary/10 mr-4">
                      <Edit className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Customizable</h3>
                      <p className="text-sm text-slate-600">
                        Create custom achievements for special events
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notification Dialog */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>
              Send a notification to the selected user. This will be delivered
              via email if the user has an email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notification-message">Message</Label>
              <Textarea
                id="notification-message"
                placeholder="Your notification message..."
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotifyDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUserId) {
                  sendNotificationMutation.mutate({
                    userId: selectedUserId,
                    groupId: selectedGroupId || 0,
                    message: notificationMessage,
                  });
                }
              }}
              disabled={!notificationMessage.trim() || !selectedUserId}
            >
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
