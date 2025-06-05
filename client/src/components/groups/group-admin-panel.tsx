import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, User, UserCheck, UserMinus, UserX, Pencil, AlertTriangle, ShieldAlert, CalendarDays } from "lucide-react";
import { facilityTypes, districts } from "@shared/schema";
import { useLocation } from "wouter";
import { GroupEventManager } from "./group-event-manager";
import { PostModeration } from "./post-moderation";

// Types
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

type Member = {
  userId: number;
  username: string;
  fullName: string | null;
  role: "admin" | "moderator" | "member";
  status?: string;
  joinedAt: string;
};

interface GroupAdminPanelProps {
  group: Group;
  members: Member[];
  currentUserId: number;
  onClose?: () => void;
}

export function GroupAdminPanel({ group, members, currentUserId, onClose }: GroupAdminPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("settings");
  const [formData, setFormData] = useState<Partial<Group>>({
    name: group.name,
    description: group.description,
    sportType: group.sportType,
    district: group.district,
    isPrivate: group.isPrivate
  });

  // Pending members filter
  const pendingMembers = members.filter(member => member.status === "pending");
  const activeMembers = members.filter(member => member.status !== "pending");
  
  // Fetch group posts for moderation
  const { 
    data: posts = [], 
    isLoading: isLoadingPosts,
  } = useQuery({
    queryKey: [`/api/groups/${group.id}/posts`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${group.id}/posts`);
      if (!response.ok) {
        throw new Error("Failed to fetch group posts");
      }
      return response.json();
    },
    enabled: activeTab === "moderation", // Only fetch when moderation tab is active
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async (groupData: Partial<Group>) => {
      const response = await apiRequest("PUT", `/api/groups/${group.id}`, groupData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group settings updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${group.id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update group settings.",
        variant: "destructive",
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/groups/${group.id}/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "The member has been removed from the group.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${group.id}/members`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member.",
        variant: "destructive",
      });
    },
  });

  // Update member role mutation
  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await apiRequest(
        "PUT", 
        `/api/groups/${group.id}/members/${userId}/role`, 
        { role }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "Member role has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${group.id}/members`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member role.",
        variant: "destructive",
      });
    },
  });

  // Approve member mutation
  const approveMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(
        "PUT", 
        `/api/groups/${group.id}/members/${userId}/status`, 
        { status: "approved" }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member approved",
        description: "The member request has been approved.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${group.id}/members`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve member.",
        variant: "destructive",
      });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/groups/${group.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Group deleted",
        description: "The group has been permanently deleted.",
      });
      // Redirect to community page after deletion
      setLocation("/community");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group.",
        variant: "destructive",
      });
    },
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle switch changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateGroupMutation.mutate(formData);
  };

  // Handle group deletion with confirmation
  const handleDeleteGroup = () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this group? This action cannot be undone and will remove all group data including posts, events, and member records."
    );
    
    if (confirmed) {
      deleteGroupMutation.mutate();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Group Administration</CardTitle>
        <CardDescription>
          Manage your group settings, members, and events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="members">
              Members
              {pendingMembers.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-primary text-white rounded-full text-xs">
                  {pendingMembers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
          </TabsList>
          
          {/* Group Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    rows={4} 
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sportType">Sport Type</Label>
                    <Select 
                      name="sportType" 
                      value={formData.sportType} 
                      onValueChange={(value) => handleSelectChange("sportType", value)}
                    >
                      <SelectTrigger id="sportType">
                        <SelectValue placeholder="Select sport type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(facilityTypes).map((type) => (
                          <SelectItem key={type} value={type}>
                            {facilityTypes[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="district">District</Label>
                    <Select 
                      name="district" 
                      value={formData.district} 
                      onValueChange={(value) => handleSelectChange("district", value)}
                    >
                      <SelectTrigger id="district">
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(districts).map((district) => (
                          <SelectItem key={district} value={district}>
                            {districts[district]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="isPrivate" 
                    checked={formData.isPrivate}
                    onCheckedChange={(checked) => handleSwitchChange("isPrivate", checked)}
                  />
                  <Label htmlFor="isPrivate">Private Group</Label>
                </div>
                
                {formData.isPrivate !== group.isPrivate && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Privacy Change Warning</AlertTitle>
                    <AlertDescription>
                      {formData.isPrivate 
                        ? "Making this group private will require new members to be approved by an admin."
                        : "Making this group public will allow anyone to join without approval."}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="submit" 
                    disabled={updateGroupMutation.isPending}
                  >
                    {updateGroupMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>
          
          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            {/* Pending Member Requests Section (Only for private groups) */}
            {group.isPrivate && pendingMembers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Pending Requests</h3>
                <Card>
                  <CardContent className="p-4">
                    <ul className="divide-y">
                      {pendingMembers.map((member) => (
                        <li key={member.userId} className="py-3 flex items-center justify-between">
                          <div className="flex items-center">
                            <User className="h-5 w-5 mr-2 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{member.username}</p>
                              <p className="text-sm text-muted-foreground">
                                Requested to join
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => approveMemberMutation.mutate(member.userId)}
                              disabled={approveMemberMutation.isPending}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => removeMemberMutation.mutate(member.userId)}
                              disabled={removeMemberMutation.isPending}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Separator className="my-4" />
              </div>
            )}
            
            {/* Active Members Section */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Active Members</h3>
              <Card>
                <CardContent className="p-4">
                  <ul className="divide-y">
                    {activeMembers.map((member) => (
                      <li key={member.userId} className="py-3 flex items-center justify-between">
                        <div className="flex items-center">
                          <User className="h-5 w-5 mr-2 text-muted-foreground" />
                          <div>
                            <div className="flex items-center">
                              <p className="font-medium">{member.username}</p>
                              {member.role === "admin" && (
                                <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                                  Admin
                                </span>
                              )}
                              {member.role === "moderator" && (
                                <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                                  Moderator
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Joined {new Date(member.joinedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Only show management options if not the current user */}
                        {member.userId !== currentUserId && (
                          <div className="flex space-x-2">
                            <Select 
                              value={member.role}
                              onValueChange={(value) => updateMemberRoleMutation.mutate({ 
                                userId: member.userId, 
                                role: value 
                              })}
                              disabled={updateMemberRoleMutation.isPending}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Change role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => removeMemberMutation.mutate(member.userId)}
                              disabled={removeMemberMutation.isPending}
                            >
                              <UserMinus className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Moderation Tab */}
          <TabsContent value="moderation" className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Moderation Tools</h3>
              <p className="text-sm text-muted-foreground">
                As an admin, you can manage content and enforce community standards.
              </p>
              
              <Tabs defaultValue="posts" className="mt-4">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="posts">Post Moderation</TabsTrigger>
                  <TabsTrigger value="events">Event Management</TabsTrigger>
                </TabsList>
                
                <TabsContent value="posts" className="mt-4">
                  <PostModeration 
                    groupId={group.id}
                    posts={posts}
                    isLoading={isLoadingPosts}
                  />
                </TabsContent>
                
                <TabsContent value="events" className="mt-4">
                  <GroupEventManager 
                    groupId={group.id}
                    isAdmin={true}
                  />
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Danger Zone */}
            <div className="pt-6">
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    These actions are irreversible. Please proceed with caution.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={handleDeleteGroup}
                    disabled={deleteGroupMutation.isPending}
                  >
                    {deleteGroupMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 mr-2" />
                    )}
                    Delete Group
                  </Button>
                </CardContent>
                </Card>
              </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-end">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}