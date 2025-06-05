import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Map, CalendarDays, Heart, MessageSquare, Share2, Send } from "lucide-react";
import { Header } from "@/components/layout/header";
import { facilityTypes, districts, type Event as SchemaEvent } from "@shared/schema";
import { GroupAdminPanel } from "@/components/groups/group-admin-panel";
import { GroupEventManager } from "@/components/groups/group-event-manager";

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
  joinedAt: string;
};

type Post = {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  imageUrl: string | null;
  sportType: string | null;
  likes: number;
  userLiked?: boolean;
  comments?: Comment[];
};

type Comment = {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  postId: number;
};

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("posts");
  const [postContent, setPostContent] = useState("");
  const [commentContent, setCommentContent] = useState<Record<number, string>>({});
  const groupId = Number(id);
  
  // Add state for group events
  const [groupEvents, setGroupEvents] = useState<SchemaEvent[]>([]);

  // Fetch group details
  const { 
    data: group, 
    isLoading: isLoadingGroup,
    error: groupError 
  } = useQuery({
    queryKey: [`/api/groups/${groupId}`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${groupId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch group");
      }
      return response.json() as Promise<Group>;
    },
    enabled: !!groupId,
  });

  // Fetch group members
  const { 
    data: members = [], 
    isLoading: isLoadingMembers,
  } = useQuery({
    queryKey: [`/api/groups/${groupId}/members`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/members`);
      if (!response.ok) {
        throw new Error("Failed to fetch group members");
      }
      return response.json() as Promise<Member[]>;
    },
    enabled: !!groupId,
  });

  // Fetch group posts
  const { 
    data: posts = [], 
    isLoading: isLoadingPosts,
  } = useQuery({
    queryKey: [`/api/groups/${groupId}/posts`],
    queryFn: async () => {
      const response = await fetch(`/api/groups/${groupId}/posts`);
      if (!response.ok) {
        throw new Error("Failed to fetch group posts");
      }
      
      const postsData = await response.json() as Post[];
      
      // Fetch comments for each post
      const postsWithComments = await Promise.all(
        postsData.map(async (post) => {
          try {
            const commentsResponse = await fetch(`/api/posts/${post.id}/comments`);
            if (commentsResponse.ok) {
              const comments = await commentsResponse.json();
              return { ...post, comments };
            }
          } catch (error) {
            console.error(`Failed to fetch comments for post ${post.id}:`, error);
          }
          return post;
        })
      );
      
      return postsWithComments;
    },
    enabled: !!groupId,
  });

  // Fetch group events using the dedicated group events API
  const {
    data: events = [],
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery({
    queryKey: [`/api/groups/${groupId}/events`],
    queryFn: async () => {
      // User ID is no longer needed as a parameter since permission checks happen on the server
      if (!user?.id) {
        throw new Error("You need to be signed in to view group events");
      }
      
      const url = `/api/groups/${groupId}/events`;
      console.log("Fetching group events with URL:", url);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch group events");
      }
      
      return response.json();
    },
    enabled: !!groupId && !!user?.id, // Only fetch if user is logged in and groupId exists
    // Only refetch events when the tab changes to events
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Check if user is a member
  const isMember = members.some(member => member.userId === user?.id);
  const userRole = members.find(member => member.userId === user?.id)?.role || null;
  const isAdmin = userRole === "admin";
  const isModerator = userRole === "moderator" || isAdmin;

  // Join group mutation
  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/join`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "You've joined the group!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join group",
        variant: "destructive",
      });
    },
  });

  // Leave group mutation
  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/leave`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Left group",
        description: "You've left the group successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave group",
        variant: "destructive",
      });
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/posts`, { content });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post created",
        description: "Your post has been published",
      });
      setPostContent("");
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/like`);
      return response.json();
    },
    onSuccess: (data, postId) => {
      // Update local post data to reflect like status change
      queryClient.setQueryData([`/api/groups/${groupId}/posts`], (oldData: Post[] = []) => {
        return oldData.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: data.liked ? post.likes + 1 : post.likes - 1,
                userLiked: data.liked 
              } 
            : post
        );
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to like post",
        variant: "destructive",
      });
    },
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      return response.json();
    },
    onSuccess: (newComment, variables) => {
      toast({
        title: "Comment added",
        description: "Your comment has been added",
      });
      
      // Clear the comment input
      setCommentContent(prev => ({ ...prev, [variables.postId]: "" }));
      
      // Update the post's comments locally
      queryClient.setQueryData([`/api/groups/${groupId}/posts`], (oldData: Post[] = []) => {
        return oldData.map(post => {
          if (post.id === variables.postId) {
            const updatedComments = [...(post.comments || []), newComment];
            return { ...post, comments: updatedComments };
          }
          return post;
        });
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  // Handle post submit
  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    createPostMutation.mutate(postContent);
  };

  // Handle comment submit
  const handleCommentSubmit = (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    const content = commentContent[postId];
    if (!content || !content.trim()) return;
    createCommentMutation.mutate({ postId, content });
  };

  // Handle error with useEffect
  useEffect(() => {
    if (groupError) {
      toast({
        title: "Error",
        description: "Failed to load group. Please try again later.",
        variant: "destructive",
      });
    }
  }, [groupError, toast]);

  // If loading, show skeleton
  if (isLoadingGroup) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <Skeleton className="h-10 w-60 mb-2" />
            <Skeleton className="h-6 w-40 mb-6" />
            <Skeleton className="h-32 w-full mb-6" />
            <Skeleton className="h-10 w-full mb-2" />
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If no group found, show not found
  if (!group && !isLoadingGroup) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Group Not Found</h1>
            <p className="text-muted-foreground mb-6">The group you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => setLocation("/community")}>
              Back to Community
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Group Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold">{group?.name}</h1>
                <div className="flex items-center space-x-2 my-2">
                  {group?.sportType && (
                    <Badge className="capitalize">
                      {group.sportType}
                    </Badge>
                  )}
                  {group?.district && (
                    <Badge variant="outline" className="capitalize">
                      {group.district.replace(/_/g, ' ')}
                    </Badge>
                  )}
                  {group?.isPrivate && (
                    <Badge variant="secondary">Private</Badge>
                  )}
                </div>
              </div>
              
              <div>
                {!isMember ? (
                  <Button 
                    onClick={() => joinGroupMutation.mutate()} 
                    disabled={joinGroupMutation.isPending}
                    className="flex items-center"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join Group
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => leaveGroupMutation.mutate()} 
                    disabled={leaveGroupMutation.isPending}
                  >
                    Leave Group
                  </Button>
                )}
              </div>
            </div>
            
            <div className="prose prose-sm max-w-none mb-6">
              <p>{group?.description}</p>
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground mb-6">
              <Users className="h-4 w-4 mr-1" />
              <span>
                {group?.memberCount || members.length} member{(group?.memberCount || members.length) !== 1 ? 's' : ''}
              </span>
              <Separator orientation="vertical" className="h-4 mx-2" />
              <CalendarDays className="h-4 w-4 mr-1" />
              <span>Created {group?.createdAt && new Date(group.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
              <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
              <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>
              )}
            </TabsList>
            
            {/* Posts Tab */}
            <TabsContent value="posts">
              {/* Post Creation */}
              {isMember && (
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <form onSubmit={handlePostSubmit}>
                      <Textarea
                        placeholder="Share something with the group..."
                        className="mb-4 min-h-24"
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={createPostMutation.isPending || !postContent.trim()}
                        >
                          {createPostMutation.isPending ? "Posting..." : "Post"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Posts List */}
              {isLoadingPosts ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="w-full">
                      <CardHeader>
                        <div className="flex items-center">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="ml-4">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24 mt-1" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-16 w-full" />
                      </CardContent>
                      <CardFooter>
                        <Skeleton className="h-8 w-24" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : posts.length > 0 ? (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <Card key={post.id} className="w-full">
                      <CardHeader>
                        <div className="flex items-center">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{post.username[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="ml-4">
                            <CardTitle className="text-md">{post.username}</CardTitle>
                            <CardDescription>
                              {new Date(post.createdAt).toLocaleString()}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-line">{post.content}</p>
                        {post.imageUrl && (
                          <img 
                            src={post.imageUrl} 
                            alt="Post attachment" 
                            className="mt-4 rounded-md max-h-96 object-contain" 
                          />
                        )}
                      </CardContent>
                      <CardFooter className="flex flex-col items-start gap-4">
                        <div className="flex items-center space-x-4 w-full">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-1"
                            onClick={() => likePostMutation.mutate(post.id)}
                            disabled={likePostMutation.isPending}
                          >
                            <Heart 
                              className={`h-4 w-4 ${post.userLiked ? "fill-red-500 text-red-500" : ""}`} 
                            />
                            <span>{post.likes} {post.likes === 1 ? "Like" : "Likes"}</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-1"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>{post.comments?.length || 0} {post.comments?.length === 1 ? "Comment" : "Comments"}</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-1 ml-auto"
                          >
                            <Share2 className="h-4 w-4" />
                            <span>Share</span>
                          </Button>
                        </div>
                        
                        {/* Comments section */}
                        {post.comments && post.comments.length > 0 && (
                          <div className="border-t pt-4 w-full">
                            <h4 className="text-sm font-medium mb-2">Comments</h4>
                            <div className="space-y-4">
                              {post.comments.map((comment: Comment) => (
                                <div key={comment.id} className="flex gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="bg-muted rounded-md px-3 py-2 flex-1">
                                    <div className="flex justify-between items-start">
                                      <span className="font-medium text-sm">{comment.username}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(comment.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-sm mt-1">{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Comment form */}
                        {isMember && (
                          <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="w-full flex gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{user?.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex">
                              <Textarea
                                placeholder="Write a comment..."
                                className="min-h-12 flex-1 resize-none"
                                value={commentContent[post.id] || ""}
                                onChange={(e) => setCommentContent(prev => ({
                                  ...prev,
                                  [post.id]: e.target.value
                                }))}
                              />
                              <Button 
                                type="submit" 
                                size="icon" 
                                variant="ghost" 
                                className="ml-2"
                                disabled={createCommentMutation.isPending || !(commentContent[post.id]?.trim())}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          </form>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No posts yet</h3>
                  <p className="text-muted-foreground">
                    {isMember 
                      ? "Be the first to post in this group!"
                      : "Join the group to see and create posts."}
                  </p>
                </div>
              )}
            </TabsContent>
            
            {/* Members Tab */}
            <TabsContent value="members">
              {isLoadingMembers ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="ml-4">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24 mt-1" />
                          </div>
                          <Skeleton className="h-8 w-24 ml-auto" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : members.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {members.map((member) => (
                    <Card key={member.userId}>
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback>
                              {(member.fullName || member.username)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="ml-4">
                            <h3 className="font-medium">{member.fullName || member.username}</h3>
                            <div className="flex items-center">
                              <Badge variant="outline" className="text-xs">
                                {member.role}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-2">
                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {user?.id !== member.userId && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="ml-auto"
                              onClick={() => setLocation(`/users/profile/${member.userId}`)}
                            >
                              View Profile
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No members yet</h3>
                  <p className="text-muted-foreground">Be the first to join this group!</p>
                </div>
              )}
            </TabsContent>
            
            {/* Events Tab */}
            <TabsContent value="events">
              {isLoadingEvents ? (
                <div className="space-y-4 py-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="w-full">
                      <CardHeader>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-32 mt-1" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-16 w-full" />
                      </CardContent>
                      <CardFooter>
                        <Skeleton className="h-8 w-24" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : eventsError ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="text-lg font-medium">Error loading events</h3>
                  <p className="text-muted-foreground mb-6">{(eventsError as Error).message || "Failed to load events"}</p>
                  
                  {user ? (
                    isMember ? (
                      <Button 
                        onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/events`] })}
                        className="flex items-center gap-2 mx-auto"
                      >
                        Try Again
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => joinGroupMutation.mutate()} 
                        className="flex items-center gap-2 mx-auto"
                        disabled={joinGroupMutation.isPending}
                      >
                        <UserPlus className="h-4 w-4" />
                        Join Group to See Events
                      </Button>
                    )
                  ) : (
                    <Button 
                      onClick={() => setLocation("/auth")} 
                      className="flex items-center gap-2 mx-auto"
                    >
                      Sign in to View Events
                    </Button>
                  )}
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-6 py-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Upcoming Events</h3>
                    {isMember && (
                      <Button 
                        onClick={() => setLocation(`/groups/${groupId}/create-event`)}
                        className="flex items-center gap-2"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Create Group Event
                      </Button>
                    )}
                  </div>
                  
                  {events.map((event: SchemaEvent) => (
                    <Card key={event.id} className="w-full cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setLocation(`/groups/${groupId}/events/${event.id}`)}>
                      <CardHeader>
                        <CardTitle>{event.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(event.eventDate).toLocaleDateString()} | {event.startTime} - {event.endTime}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-2">{event.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge>{event.sportType}</Badge>
                          <Badge variant="outline">{event.skillLevel}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No upcoming events</h3>
                  <p className="text-muted-foreground mb-6">
                    There are no events planned for this group yet.
                  </p>
                  {isMember && (
                    <Button 
                      onClick={() => setLocation(`/groups/${groupId}/create-event`)}
                      className="flex items-center gap-2"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Create Group Event
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
            
            {/* Admin Tab */}
            {isAdmin && (
              <TabsContent value="admin">
                {group && user && (
                  <GroupAdminPanel
                    group={group}
                    members={members}
                    currentUserId={user.id}
                  />
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
}