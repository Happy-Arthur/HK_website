import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Send, ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";
import { queryClient, apiRequest } from "../../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";

// Define types for our messages
export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  timestamp?: string;
  createdAt: string;
  read: boolean;
}

export interface Connection {
  connectionId: string;
  userId: number;
  connectedUserId: number;
  status: string;
  username: string;
  fullName: string;
  createdAt: string;
}

interface ConversationProps {
  connection: Connection;
  onBack?: () => void;
  initialMessages?: Message[];
}

export function Conversation({ connection, onBack, initialMessages = [] }: ConversationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [messageText, setMessageText] = useState("");
  
  // Track a unique "key" for this conversation instance to prevent data leakage between conversations
  const conversationKey = useRef<string>(`${connection.connectionId}-${Date.now()}`);
  
  // Use a function for state initialization to create a deep copy of initialMessages
  const [messages, setMessages] = useState<Message[]>(() => {
    console.log(`Initializing conversation ${conversationKey.current} with ${initialMessages.length} initial messages`);
    return [...initialMessages];
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    try {
      console.log(`[${conversationKey.current}] WebSocket message received:`, message);
      
      // Handle different types of messages
      switch (message.type) {
        case "message":
          // Only process messages for this conversation
          if (message.conversationId === connection.connectionId) {
            const newMessage = message.message;
            
            // Only process messages that belong to THIS conversation with our specific user
            const isRelevantMessage = 
              (newMessage.senderId === user?.id && newMessage.receiverId === connection.connectedUserId) ||
              (newMessage.senderId === connection.connectedUserId && newMessage.receiverId === user?.id);
            
            if (!isRelevantMessage) {
              console.log(`[${conversationKey.current}] Ignoring message - not relevant to this conversation`);
              return;
            }
            
            // Only process messages from other users (our own are handled by the send mutation)
            if (newMessage.senderId !== user?.id) {
              // Add the new message directly to state if it doesn't exist already
              setMessages(prevMessages => {
                // Check if this message already exists
                const exists = prevMessages.some(msg => msg.id === newMessage.id);
                if (exists) {
                  console.log(`[${conversationKey.current}] Ignoring duplicate message ID ${newMessage.id}`);
                  return prevMessages;
                }
                
                console.log(`[${conversationKey.current}] Adding message ID ${newMessage.id} from ${newMessage.senderId} to ${newMessage.receiverId}`);
                
                // Add the new message to existing messages and sort by timestamp
                const updatedMessages = [...prevMessages, newMessage].sort((a, b) => {
                  const dateA = new Date(a.createdAt || a.timestamp || new Date().toISOString());
                  const dateB = new Date(b.createdAt || b.timestamp || new Date().toISOString());
                  return dateA.getTime() - dateB.getTime();
                });
                
                // Scroll to bottom on next render
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 50);
                
                return updatedMessages;
              });
              
              // Mark messages as read
              if (user) {
                apiRequest("POST", `/api/messages/${newMessage.senderId}/read`, {})
                  .catch(err => console.error(`[${conversationKey.current}] Error marking messages as read:`, err));
              }
            } else {
              console.log(`[${conversationKey.current}] Ignoring own message in WebSocket - already handled by send mutation`);
            }
          }
          break;
          
        case "auth_success":
          console.log(`[${conversationKey.current}] Successfully authenticated WebSocket connection`);
          // Join the conversation after authentication is successful
          joinConversation(connection.connectionId);
          break;
          
        case "pong":
          console.log(`[${conversationKey.current}] Received pong from server, connection healthy`);
          break;
          
        case "connected":
          console.log(`[${conversationKey.current}] Connected to WebSocket server with client ID:`, message.clientId);
          break;
          
        default:
          console.log(`[${conversationKey.current}] Received unhandled WebSocket message type: ${message.type}`, message);
      }
    } catch (error) {
      console.error(`[${conversationKey.current}] Error handling WebSocket message:`, error);
    }
  }, [connection.connectionId, connection.connectedUserId, user]);

  // Use our enhanced WebSocket hook
  const { 
    isConnected,
    isAuthenticated,
    error,
    sendMessage,
    joinConversation,
    leaveConversation,
    sendChatMessage
  } = useWebSocket({
    onMessage: handleWebSocketMessage,
    reconnectInterval: 3000,
    reconnectAttempts: 5,
    heartbeatInterval: 25000
  });
  
  // Join the conversation when websocket is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log(`[${conversationKey.current}] WebSocket authenticated, joining conversation ${connection.connectionId}`);
      joinConversation(connection.connectionId);
    }
  }, [isAuthenticated, connection.connectionId, joinConversation]);
  
  // When component unmounts, leave the conversation
  useEffect(() => {
    return () => {
      if (isConnected && isAuthenticated) {
        console.log(`[${conversationKey.current}] Leaving conversation ${connection.connectionId}`);
        leaveConversation(connection.connectionId);
      }
    };
  }, [isConnected, isAuthenticated, connection.connectionId, leaveConversation]);

  // Scroll to the bottom of the message list when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Format the time for the message bubble
  const formatMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };

  // Send a new message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: { content: string; receiverId: number }) => {
      const response = await apiRequest("POST", "/api/messages", message);
      return await response.json();
    },
    onSuccess: (newMessage: Message) => {
      console.log(`[${conversationKey.current}] Message sent successfully:`, newMessage);
      
      // Add the new message to the UI
      setMessages(prev => {
        // Check if this message already exists
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) {
          console.log(`[${conversationKey.current}] Ignoring duplicate message ID ${newMessage.id}`);
          return prev;
        }
        
        // Add the new message to existing messages and sort by timestamp
        const updatedMessages = [...prev, newMessage].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || new Date().toISOString());
          const dateB = new Date(b.createdAt || b.timestamp || new Date().toISOString());
          return dateA.getTime() - dateB.getTime();
        });
        
        // Clear input and scroll to bottom
        setMessageText("");
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
        
        return updatedMessages;
      });
      
      // Also send the message through WebSocket for real-time delivery
      if (isConnected && isAuthenticated) {
        console.log(`[${conversationKey.current}] Sending message through WebSocket`);
        sendChatMessage(connection.connectionId, newMessage);
      } else {
        console.warn(`[${conversationKey.current}] WebSocket not connected/authenticated, message only saved to database`);
      }
      
      // Invalidate the messages query to refresh the list
      queryClient.invalidateQueries({ queryKey: [`/api/messages/${connection.connectedUserId}`] });
    },
    onError: (error: Error) => {
      console.error(`[${conversationKey.current}] Error sending message:`, error);
      toast({
        title: "Message not sent",
        description: "There was an error sending your message. Please try again.",
        variant: "destructive"
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !user) return;
    
    sendMessageMutation.mutate({
      content: messageText.trim(),
      receiverId: connection.connectedUserId
    });
  };

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className="flex items-center gap-2 text-xs">
      <div 
        className={`w-2 h-2 rounded-full ${isConnected && isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`} 
      />
      <span>{isConnected && isAuthenticated ? 'Connected' : 'Disconnected'}</span>
    </div>
  );

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-100px)]">
      <CardHeader className="p-3 flex-none border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {isMobile && onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="mr-1">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            )}
            <Avatar>
              <AvatarFallback>{connection.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{connection.fullName}</div>
              <ConnectionStatus />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon">
              <Phone className="h-4 w-4" />
              <span className="sr-only">Call</span>
            </Button>
            <Button variant="ghost" size="icon">
              <Video className="h-4 w-4" />
              <span className="sr-only">Video call</span>
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-4">
          {messages.map(message => {
            const isCurrentUser = message.senderId === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    isCurrentUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="text-sm">{message.content}</div>
                  <div
                    className={`text-xs mt-1 ${
                      isCurrentUser ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {formatMessageTime(message.createdAt || message.timestamp || "")}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!messageText.trim() || sendMessageMutation.isPending || !isConnected}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}