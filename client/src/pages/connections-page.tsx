import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, MessageSquare } from "lucide-react";
import { queryClient, apiRequest } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Conversation, Connection, Message } from "@/components/connect/conversation";

export default function ConnectionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("accepted");
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  // Query accepted connections
  const acceptedConnectionsQuery = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/connections");
      const data = await response.json();
      return data.filter((conn: Connection) => conn.status === "accepted");
    },
  });

  // Query pending connection requests
  const pendingConnectionsQuery = useQuery<Connection[]>({
    queryKey: ["/api/connections/pending"],
  });

  // Handle connection changes
  useEffect(() => {
    // Always reset messages when the selected connection changes
    setLocalMessages([]);
    
    // Create a cleanup function to clear messages when unmounting
    // This ensures no messages leak between conversations
    return () => {
      // Clear messages one more time when unmounting to prevent any possible leakage
      setLocalMessages([]);
    };
    
    // We don't need to fetch messages here anymore, as the Conversation component
    // will handle that internally. This avoids duplicate data and potential state issues.
    
    // Note: we're still using the key={`conversation-${selectedConnection.connectionId}`}
    // in the Conversation component to ensure it fully remounts when changing connections.
  }, [selectedConnection?.connectionId]);

  // Mutations for accepting and rejecting connection requests
  const acceptConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const [userId, connectedUserId] = connectionId.split("-");
      const response = await apiRequest("PUT", `/api/connections/${userId}/${connectedUserId}`, {
        status: "accepted",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection accepted",
        description: "You are now connected with this user",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connections/pending"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error accepting connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const [userId, connectedUserId] = connectionId.split("-");
      const response = await apiRequest("PUT", `/api/connections/${userId}/${connectedUserId}`, {
        status: "rejected",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection rejected",
        description: "You have rejected this connection request",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connections/pending"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error rejecting connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Header />
      <div className="flex flex-col h-full max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Your Connections</h1>
          <p className="text-muted-foreground">
            Manage your connections and chat with other players
          </p>
        </div>

        <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] gap-4 justify-center items-center">
          {/* Connections list panel - Centered with mx-auto for mobile */}
          <Card className={`${selectedConnection && isMobile ? 'hidden' : 'flex flex-col'} md:w-1/3 w-full max-w-md mx-auto md:mx-0`}>
            <CardHeader className="px-4 py-3 text-center">
              <Tabs defaultValue="accepted" onValueChange={setActiveTab} value={activeTab} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="accepted" className="flex-1">
                    Connections
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="flex-1 relative">
                    Requests
                    {pendingConnectionsQuery.data?.length ? (
                      <Badge variant="destructive" className="ml-2">
                        {pendingConnectionsQuery.data?.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-4 flex-1 overflow-y-auto p-0">
                  <TabsContent value="accepted" className="m-0 h-full">
                  {acceptedConnectionsQuery.isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <p>Loading connections...</p>
                    </div>
                  ) : acceptedConnectionsQuery.data?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
                      <h3 className="font-medium">No connections yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start connecting with other players to chat with them
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {acceptedConnectionsQuery.data?.map((connection) => (
                        <div
                          key={connection.connectionId}
                          onClick={() => setSelectedConnection(connection)}
                          className={`flex items-center gap-3 p-3 hover:bg-muted cursor-pointer transition-colors ${
                            selectedConnection?.connectionId === connection.connectionId
                              ? "bg-muted"
                              : ""
                          }`}
                        >
                          <Avatar>
                            <AvatarFallback>
                              {connection.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className="font-medium truncate">
                                {connection.fullName || connection.username}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(connection.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {/* Last message preview would go here */}
                              Click to start chatting
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pending" className="m-0 h-full">
                  {pendingConnectionsQuery.isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <p>Loading requests...</p>
                    </div>
                  ) : pendingConnectionsQuery.data?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <UserPlus className="h-12 w-12 text-muted-foreground mb-2" />
                      <h3 className="font-medium">No pending requests</h3>
                      <p className="text-sm text-muted-foreground">
                        When someone wants to connect, you'll see them here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {pendingConnectionsQuery.data?.map((connection) => (
                        <div
                          key={connection.connectionId}
                          className="flex items-center gap-3 p-3 hover:bg-muted transition-colors"
                        >
                          <Avatar>
                            <AvatarFallback>
                              {connection.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {connection.fullName || connection.username}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Wants to connect with you
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-full"
                              onClick={() => acceptConnectionMutation.mutate(connection.connectionId)}
                              disabled={acceptConnectionMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-full"
                              onClick={() => rejectConnectionMutation.mutate(connection.connectionId)}
                              disabled={rejectConnectionMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                </div>
              </Tabs>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-0">
              {/* Content is now inside the Tabs component */}
            </CardContent>
          </Card>

          {/* Chat panel - hidden on mobile until a connection is selected */}
          <div className={`flex-1 ${!selectedConnection && isMobile ? 'hidden' : ''}`}>
            {selectedConnection ? (
              <Conversation 
                key={`conversation-${selectedConnection.connectionId}`}
                connection={selectedConnection} 
                initialMessages={localMessages}
                onBack={isMobile ? () => setSelectedConnection(null) : undefined}
              />
            ) : (
              <Card className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-muted-foreground max-w-md mt-2">
                  Choose a connection from the list to start chatting
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}