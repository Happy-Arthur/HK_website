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

  // WebSocket connection for real-time messages
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Create a ref to track last pong time for connection monitoring
  const lastPongTimeRef = useRef<Date | null>(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Don't try to connect if no user data
    if (!user) {
      console.log("No user data available for WebSocket connection");
      return;
    }
    
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000; // 3 seconds
    
    // Function to create and set up the WebSocket
    const setupWebSocket = () => {
      try {
        // Create WebSocket connection using specific path to avoid Vite HMR conflicts
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log(`[${conversationKey.current}] Connecting to WebSocket: ${wsUrl}`);
        
        // Create a new WebSocket instance
        const newSocket = new WebSocket(wsUrl);
      
      // Set up event handlers
      newSocket.onopen = () => {
        console.log(`[${conversationKey.current}] WebSocket connection established`);
        
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
        
        // Send authentication message
        newSocket.send(JSON.stringify({
          type: "auth",
          userId: user.id
        }));
        
        // Join conversation channel
        newSocket.send(JSON.stringify({
          type: "join_conversation",
          conversationId: connection.connectionId
        }));
        
        // Set connection state to true AFTER authentication is sent
        setIsSocketConnected(true);
        
        console.log(`[${conversationKey.current}] Authenticated as user ${user.id} and joined conversation ${connection.connectionId}`);
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different types of messages with a switch statement for clarity
          switch (data.type) {
            case "message":
              // Only process messages for this conversation
              if (data.conversationId === connection.connectionId) {
                console.log(`[${conversationKey.current}] WebSocket message received:`, data);
                const newMessage = data.message;
                
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
              
            case "pong":
              // Update last pong time for connection health monitoring
              lastPongTimeRef.current = new Date();
              console.log(`[${conversationKey.current}] Received pong from server, connection healthy`);
              break;
              
            case "connected":
              console.log(`[${conversationKey.current}] Connected to WebSocket server with client ID:`, data.clientId);
              break;
              
            default:
              console.log(`[${conversationKey.current}] Received unhandled WebSocket message type: ${data.type}`, data);
          }
        } catch (error) {
          console.error(`[${conversationKey.current}] Error parsing WebSocket message:`, error);
        }
      };
      
      newSocket.onerror = (error) => {
        console.error(`[${conversationKey.current}] WebSocket error:`, error);
        setIsSocketConnected(false);
      };
      
      newSocket.onclose = (event) => {
        console.log(`[${conversationKey.current}] WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`);
        setIsSocketConnected(false);
        
        // Attempt to reconnect unless the connection was closed intentionally
        // or we've reached the maximum number of attempts
        if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`[${conversationKey.current}] Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          
          // Set a timer to reconnect with backoff
          const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1);
          reconnectTimer = setTimeout(() => {
            console.log(`[${conversationKey.current}] Reconnecting to WebSocket after ${delay}ms delay...`);
            setSocket(setupWebSocket());
          }, delay);
        }
      };
      
      return newSocket;
      } catch (error) {
        console.error(`[${conversationKey.current}] Error setting up WebSocket:`, error);
        return null;
      }
    };
    
    // Set up the initial WebSocket connection
    const newSocket = setupWebSocket();
    setSocket(newSocket);
    
    // Set up a ping interval to keep the connection alive
    // Many proxies and load balancers will close inactive connections
    const PING_INTERVAL = 30000; // 30 seconds
    const pingTimer = setInterval(() => {
      if (newSocket && newSocket.readyState === WebSocket.OPEN) {
        try {
          // Send a ping message to keep the connection alive
          newSocket.send(JSON.stringify({
            type: "ping",
            timestamp: new Date().toISOString()
          }));
          console.log(`[${conversationKey.current}] Sent WebSocket ping to keep connection alive`);
        } catch (error) {
          console.error(`[${conversationKey.current}] Error sending ping:`, error);
        }
      }
    }, PING_INTERVAL);
    
    // Clean up WebSocket connection on component unmount
    return () => {
      // Clear any pending timers
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      if (pingTimer) {
        clearInterval(pingTimer);
      }
      
      // Properly close the WebSocket if it exists
      if (newSocket) {
        try {
          if (newSocket.readyState === WebSocket.OPEN) {
            // Leave conversation channel before closing
            if (user) {
              newSocket.send(JSON.stringify({
                type: "leave_conversation",
                conversationId: connection.connectionId
              }));
            }
            
            // Close the connection properly
            newSocket.close(1000, "Component unmounting");
          } else if (newSocket.readyState === WebSocket.CONNECTING) {
            // If it's still connecting, we can close it immediately
            newSocket.close(1000, "Component unmounting");
          }
        } catch (error) {
          console.error(`[${conversationKey.current}] Error cleaning up WebSocket:`, error);
        }
      }
      
      console.log(`[${conversationKey.current}] WebSocket connection cleaned up on unmount`);
    };
  }, [connection.connectionId, connection.connectedUserId, user]);

  // Clear messages when connection ID changes to prevent message mixing
  useEffect(() => {
    // This effect ensures messages are completely reset when switching between conversations
    setMessages([]);
    console.log(`Conversation component mounted/updated with connection ID: ${connection.connectionId}`);
  }, [connection.connectionId]);
  
  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create loading ref at component level - not inside an effect
  const isLoadingRef = useRef(false);
  
  // Load initial messages from server
  useEffect(() => {    
    // Define the function to fetch messages
    const fetchMessages = async () => {
      // Prevent multiple concurrent fetches
      if (isLoadingRef.current) return;
      
      // Don't try to fetch if we don't have both user and connection
      if (!user || !connection) return;
      
      try {
        isLoadingRef.current = true;
        console.log(`[${conversationKey.current}] Fetching messages for conversation with ${connection.username}`);
        
        // Fetch messages from the API
        const response = await apiRequest("GET", `/api/messages/${connection.connectedUserId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Filter messages to only include those between the current user and connected user
          const filteredData = data.filter((msg: Message) => 
            (msg.senderId === user.id && msg.receiverId === connection.connectedUserId) || 
            (msg.senderId === connection.connectedUserId && msg.receiverId === user.id)
          );
          
          console.log(`[${conversationKey.current}] Fetched ${filteredData.length} messages for conversation with ${connection.username}`);
          
          // Create a Map using message IDs as keys to deduplicate
          const messageMap = new Map<number, Message>();
          
          // First add any existing messages to the map (unlikely after our clear)
          messages.forEach(msg => {
            if (msg.id) messageMap.set(msg.id, msg);
          });
          
          // Then add new messages, overwriting any with the same ID
          filteredData.forEach((msg: Message) => {
            if (msg.id) messageMap.set(msg.id, msg);
          });
          
          // Convert back to array and sort
          const uniqueMessages = Array.from(messageMap.values()).sort((a, b) => {
            const dateA = new Date(a.createdAt || a.timestamp || new Date().toISOString());
            const dateB = new Date(b.createdAt || b.timestamp || new Date().toISOString());
            return dateA.getTime() - dateB.getTime();
          });
          
          // Set the completely deduped message list 
          setMessages(uniqueMessages);
        } else {
          console.error(`[${conversationKey.current}] Failed to load messages:`, response.statusText);
          toast({
            title: "Failed to load messages",
            description: "Could not retrieve your conversation history",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error(`[${conversationKey.current}] Error loading messages:`, error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    // Reset message state when connection changes
    setMessages([]);
    
    // Always fetch fresh messages from server
    fetchMessages();
    
    // Set up polling to keep messages in sync
    const intervalId = setInterval(fetchMessages, 30000); // Poll every 30 seconds
    
    return () => {
      clearInterval(intervalId); // Clean up interval on component unmount
    };
  }, [connection.connectionId, connection.username, connection.connectedUserId, user?.id, toast]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Save the message to the database via API
      const response = await apiRequest("POST", "/api/messages", {
        receiverId: connection.connectedUserId,
        content
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      const savedMessage = await response.json();
      
      // Then, send via WebSocket for real-time delivery (optional but provides immediate feedback)
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "message",
          conversationId: connection.connectionId,
          message: savedMessage
        }));
      }
      
      return savedMessage;
    },
    onSuccess: (newMessage) => {
      // Add the new message to the local state WITHOUT sending WebSocket message
      // The WebSocket message will be sent automatically after the API call
      setMessages(prevMessages => {
        // Check if message already exists to prevent duplicates
        const exists = prevMessages.some(msg => msg.id === newMessage.id);
        if (exists) return prevMessages;
        
        // Add new message and maintain chronological order
        return [...prevMessages, newMessage].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || new Date().toISOString());
          const dateB = new Date(b.createdAt || b.timestamp || new Date().toISOString());
          return dateA.getTime() - dateB.getTime();
        });
      });
      
      // Scroll to the newest message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      
      // Invalidate queries to update message list if needed
      queryClient.invalidateQueries({ queryKey: [`/api/messages/${connection.connectedUserId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle sending a new message
  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    
    sendMessageMutation.mutate(messageText);
    setMessageText("");
  };

  // Format message time for display
  const formatMessageTime = (timestamp: string | undefined) => {
    if (!timestamp) return "recently";
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // If message is from today, just show the time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Otherwise show relative time
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "recently";
    }
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="flex-row items-center justify-between p-3 border-b">
        <div className="flex items-center gap-3">
          {isMobile && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar>
            <AvatarFallback>
              {connection.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">
              {connection.fullName || connection.username}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isSocketConnected ? "Online" : "Last seen " + 
                formatDistanceToNow(new Date(connection.createdAt), {
                  addSuffix: true,
                })}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-0">
        <div className="p-4 space-y-4">
          {messages.map((message) => {
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
                    {formatMessageTime(message.createdAt || message.timestamp)}
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
              if (e.key === "Enter") handleSendMessage();
            }}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!messageText.trim() || sendMessageMutation.isPending}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}