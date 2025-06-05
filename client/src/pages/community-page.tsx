import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Loader2, UserPlus, MessageCircle, Users, Search, ThumbsUp, Calendar, Clock } from "lucide-react";
import { GroupsList } from "@/components/community/groups-list";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

type Player = {
  id: number;
  username: string;
  fullName: string;
  preferredSports?: string[];
  skillLevel?: Record<string, string>;
  createdAt?: string;
};

type Post = {
  id: number;
  content: string;
  userId: number;
  username: string;
  fullName?: string;
  groupId?: number | null;
  imageUrl?: string | null;
  likes: number;
  createdAt: string;
};

type Connection = {
  connectionId: string;
  userId: number;
  connectedUserId: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  username: string;
  fullName?: string;
};

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("groups");
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [postContent, setPostContent] = useState("");
  const [selectedSportFilter, setSelectedSportFilter] = useState("all");

  // Fetch players data
  const playersQuery = useQuery({
    queryKey: ["/api/users", playerSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (playerSearchQuery) params.append("query", playerSearchQuery);
      
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch players");
      }
      return response.json() as Promise<Player[]>;
    },
    enabled: activeTab === "players",
  });

  // Fetch posts data
  const postsQuery = useQuery({
    queryKey: ["/api/posts", selectedSportFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSportFilter && selectedSportFilter !== "all") 
        params.append("sportType", selectedSportFilter);
      
      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      return response.json() as Promise<Post[]>;
    },
    enabled: activeTab === "posts",
  });

  // Fetch user connections
  const connectionsQuery = useQuery({
    queryKey: ["/api/connections"],
    queryFn: async () => {
      const response = await fetch("/api/connections");
      if (!response.ok) {
        throw new Error("Failed to fetch connections");
      }
      return response.json() as Promise<Connection[]>;
    },
    enabled: !!user && activeTab === "players",
  });

  // Create a new post
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/posts", { content });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post created",
        description: "Your post has been published!",
      });
      setPostContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create post",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Like or unlike a post
  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/like`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to like post",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Function to handle liking or unliking a post
  const handleLikePost = (postId: number) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to like posts",
        variant: "destructive",
      });
      return;
    }
    likePostMutation.mutate(postId);
  };

  // Connect with a player
  const connectMutation = useMutation({
    mutationFn: async (connectedUserId: number) => {
      const response = await apiRequest("POST", "/api/connections", { connectedUserId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection request sent",
        description: "Your connection request has been sent",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send connection request",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Helper to check if connection exists
  const isConnected = (playerId: number) => {
    if (!connectionsQuery.data) return false;
    
    return connectionsQuery.data.some(conn => 
      (conn.connectedUserId === playerId || conn.userId === playerId) && 
      conn.status === "accepted"
    );
  };
  
  const isPending = (playerId: number) => {
    if (!connectionsQuery.data || !user) return false;
    
    return connectionsQuery.data.some(conn => 
      ((conn.connectedUserId === playerId && conn.userId === user.id) || 
       (conn.userId === playerId && conn.connectedUserId === user.id)) && 
      conn.status === "pending"
    );
  };

  // Handle post submission
  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) {
      toast({
        title: "Empty post",
        description: "Please enter some content for your post",
        variant: "destructive",
      });
      return;
    }
    
    createPostMutation.mutate(postContent.trim());
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "recently";
    }
  };

  // Get player's primary sport
  const getPrimarySport = (player: Player) => {
    if (!player.preferredSports || player.preferredSports.length === 0) {
      return "Not specified";
    }
    return player.preferredSports[0].charAt(0).toUpperCase() + player.preferredSports[0].slice(1);
  };

  // Get player's skill level for primary sport
  const getSkillLevel = (player: Player) => {
    if (!player.skillLevel || !player.preferredSports || player.preferredSports.length === 0) {
      return "Not specified";
    }
    
    const primarySport = player.preferredSports[0];
    const level = player.skillLevel[primarySport];
    
    return level ? level.charAt(0).toUpperCase() + level.slice(1) : "Not specified";
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Community</h1>
        </div>

        <Tabs
          defaultValue={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="players" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Players</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>Posts</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Groups</span>
            </TabsTrigger>
          </TabsList>

          {/* Players Tab */}
          <TabsContent value="players" className="mt-6">
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search players by name or sport"
                className="max-w-md pl-10"
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
              />
            </div>

            {playersQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                          <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                        </div>
                        <div className="flex justify-between">
                          <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                          <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                        </div>
                        <div className="h-9 bg-muted rounded animate-pulse mt-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : playersQuery.error ? (
              <div className="text-center py-10">
                <p className="text-red-500">Error loading players. Please try again later.</p>
              </div>
            ) : !playersQuery.data || playersQuery.data.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No players found</h3>
                <p className="text-muted-foreground">
                  {playerSearchQuery ? "Try adjusting your search" : "Be the first to join!"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {playersQuery.data.filter(p => p.id !== user?.id).map((player) => (
                  <Card key={player.id}>
                    <CardHeader className="flex flex-row items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-white">
                          {player.fullName
                            ? player.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                            : player.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{player.fullName || player.username}</CardTitle>
                        <CardDescription>@{player.username}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                          Sport:
                        </span>
                        <span className="font-medium">{getPrimarySport(player)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                          Level:
                        </span>
                        <span className="font-medium">{getSkillLevel(player)}</span>
                      </div>
                      <div className="flex justify-between mb-4">
                        <span className="text-sm text-muted-foreground">
                          <Clock className="inline-block h-3 w-3 mr-1" />
                          Joined:
                        </span>
                        <span className="text-sm">
                          {player.createdAt 
                            ? formatDate(player.createdAt)
                            : "Recently"}
                        </span>
                      </div>
                      
                      {user && (
                        <Button
                          variant={isConnected(player.id) ? "default" : "outline"}
                          size="sm"
                          className="w-full flex items-center gap-2"
                          disabled={isPending(player.id) || connectMutation.isPending || isConnected(player.id)}
                          onClick={() => connectMutation.mutate(player.id)}
                        >
                          {connectMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Connecting...
                            </>
                          ) : isConnected(player.id) ? (
                            <>Connected</>
                          ) : isPending(player.id) ? (
                            <>Pending</>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4" />
                              Connect
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="mt-6">
            {user && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <form onSubmit={handlePostSubmit}>
                    <Textarea
                      placeholder="Share something with the community..."
                      className="mb-4"
                      rows={3}
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={createPostMutation.isPending || !postContent.trim()}
                      >
                        {createPostMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Posting...
                          </>
                        ) : (
                          "Post"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {postsQuery.isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-muted rounded animate-pulse w-24" />
                          <div className="h-3 bg-muted rounded animate-pulse w-16" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-16 bg-muted rounded animate-pulse mb-4" />
                      <div className="flex gap-4">
                        <div className="h-4 bg-muted rounded animate-pulse w-20" />
                        <div className="h-4 bg-muted rounded animate-pulse w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : postsQuery.error ? (
              <div className="text-center py-10">
                <p className="text-red-500">Error loading posts. Please try again later.</p>
              </div>
            ) : !postsQuery.data || postsQuery.data.length === 0 ? (
              <div className="text-center py-10">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No posts yet</h3>
                <p className="text-muted-foreground">
                  Be the first to share something with the community!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {postsQuery.data.map((post) => (
                  <Card key={post.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary text-white">
                            {post.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">
                            {post.fullName || `@${post.username}`}
                          </CardTitle>
                          <CardDescription>{formatDate(post.createdAt)}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
                      {post.imageUrl && (
                        <div className="mb-4 rounded-md overflow-hidden">
                          <img 
                            src={post.imageUrl} 
                            alt="Post attachment" 
                            className="w-full h-auto max-h-[300px] object-cover"
                          />
                        </div>
                      )}
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <button 
                          className="flex items-center gap-1 hover:text-primary" 
                          onClick={() => handleLikePost(post.id)}
                        >
                          <ThumbsUp className="h-4 w-4" /> 
                          {post.likes || 0} Likes
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="mt-6">
            <GroupsList />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
