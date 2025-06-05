import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

type WebSocketMessage = {
  type: string;
  data?: any;
  message?: string;
};

type UseWebSocketOptions = {
  onMessage?: (message: WebSocketMessage) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  skipAuthCheck?: boolean; // Skip the authentication check - useful for public updates
  heartbeatInterval?: number; // Interval to send ping messages to keep the connection alive
};

const defaultOptions: UseWebSocketOptions = {
  reconnectInterval: 3000, // 3 seconds
  reconnectAttempts: 5,
  skipAuthCheck: false,
  heartbeatInterval: 30000, // 30 seconds
};

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const heartbeatTimerRef = useRef<number | null>(null);
  const authTimeoutRef = useRef<number | null>(null);
  
  const opts = { ...defaultOptions, ...options };
  
  // Function to authenticate with the WebSocket server
  const authenticate = useCallback(() => {
    if (!user || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.log('Cannot authenticate WebSocket: user not authenticated or socket not open');
      return;
    }
    
    try {
      // Get token from cookie
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };
      
      const authToken = getCookie('auth_token');
      
      if (!authToken) {
        console.error('No auth token found in cookies for WebSocket authentication');
        setError(new Error('No authentication token available'));
        return;
      }
      
      console.log('Authenticating WebSocket connection...');
      socketRef.current.send(JSON.stringify({
        type: 'auth',
        token: authToken,
      }));
      
    } catch (err) {
      console.error('Error authenticating WebSocket:', err);
      setError(err instanceof Error ? err : new Error('Failed to authenticate WebSocket'));
    }
  }, [user]);
  
  // Function to start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    
    heartbeatTimerRef.current = window.setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && isAuthenticated) {
        console.log('Sending ping to keep WebSocket connection alive');
        socketRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, opts.heartbeatInterval) as unknown as number;
  }, [opts.heartbeatInterval, isAuthenticated]);
  
  // Create a WebSocket connection with exponential backoff
  const connect = useCallback(() => {
    // Check if user is authenticated first (unless we're skipping the check)
    if (!opts.skipAuthCheck && !user) {
      console.log('WebSocket: Not connecting because user is not authenticated');
      setError(new Error('User not authenticated'));
      return;
    }
    
    try {
      // Cancel any pending authentication timeout
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      
      // Close existing connection if any
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Create a new WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      // Log debugging information
      console.log('WebSocket connection details:');
      console.log(`Protocol: ${protocol}`);
      console.log(`Host: ${host}`);
      console.log(`WebSocket URL: ${wsUrl}`);
      console.log(`User authenticated: ${!!user}`);
      
      // Calculate exponential backoff delay
      const exponentialDelay = Math.min(
        30000, // Max 30 seconds
        1000 * Math.pow(2, reconnectCountRef.current) // Exponential backoff
      );
      
      console.log(`Connecting to WebSocket at ${wsUrl} (backoff: ${exponentialDelay}ms)`);
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        setError(null);
        
        // After connection is established, authenticate with the server
        if (!opts.skipAuthCheck && user) {
          // Set a timeout for authentication
          authTimeoutRef.current = window.setTimeout(() => {
            if (!isAuthenticated) {
              console.error('WebSocket authentication timed out');
              setError(new Error('WebSocket authentication timed out'));
              socket.close(4000, 'Authentication timeout');
            }
          }, 10000) as unknown as number; // 10 seconds timeout
          
          authenticate();
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message);
          setLastMessage(message);
          
          // Handle authentication success
          if (message.type === 'auth_success') {
            console.log('WebSocket authenticated successfully');
            setIsAuthenticated(true);
            
            // Clear the authentication timeout
            if (authTimeoutRef.current) {
              clearTimeout(authTimeoutRef.current);
              authTimeoutRef.current = null;
            }
            
            // Start heartbeat after successful authentication
            startHeartbeat();
            
            // Reset reconnect counter as we've successfully connected and authenticated
            reconnectCountRef.current = 0;
          }
          
          // Handle authentication error
          if (message.type === 'error' && message.message?.includes('Authentication failed')) {
            console.error('WebSocket authentication failed:', message.message);
            setError(new Error(`Authentication failed: ${message.message}`));
            setIsAuthenticated(false);
          }
          
          if (opts.onMessage) {
            opts.onMessage(message);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      
      socket.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError(new Error("WebSocket connection error"));
        setIsAuthenticated(false);
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket connection closed: Code ${event.code}, Reason: ${event.reason || 'No reason provided'}, Was Clean: ${event.wasClean}`);
        setIsConnected(false);
        setIsAuthenticated(false);
        
        // Clear the heartbeat timer
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
        
        // Clear the authentication timeout
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
        
        // Don't reconnect if closed cleanly with code 1000 (normal closure) or 
        // 1001 (going away) or 4000 (authentication timeout)
        if (event.code === 1000 || event.code === 1001 || event.code === 4000) {
          console.log('Clean WebSocket closure, not reconnecting');
          return;
        }
        
        // Attempt to reconnect with exponential backoff
        if (reconnectCountRef.current < (opts.reconnectAttempts || 5)) {
          const attemptNumber = reconnectCountRef.current + 1;
          const delay = Math.min(
            30000, // Max 30 seconds
            1000 * Math.pow(2, reconnectCountRef.current) // Exponential backoff
          );
          
          console.log(`Attempting to reconnect (${attemptNumber}/${opts.reconnectAttempts}) after ${delay}ms`);
          reconnectCountRef.current += 1;
          
          setTimeout(connect, delay);
        } else {
          console.error(`WebSocket connection failed after ${opts.reconnectAttempts} attempts`);
          setError(new Error(`WebSocket connection failed after ${opts.reconnectAttempts} attempts`));
        }
      };
      
      socketRef.current = socket;
    } catch (err) {
      console.error("Failed to connect to WebSocket:", err);
      setError(err instanceof Error ? err : new Error("Unknown error connecting to WebSocket"));
    }
  }, [
    user, 
    opts.onMessage, 
    opts.reconnectAttempts, 
    opts.reconnectInterval, 
    opts.skipAuthCheck, 
    authenticate,
    startHeartbeat,
    isAuthenticated
  ]);
  
  // Send a message through the WebSocket
  const sendMessage = useCallback((message: any) => {
    if (!socketRef.current) {
      console.warn("WebSocket not initialized. Message not sent.");
      return false;
    }
    
    if (socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`WebSocket not open (state: ${socketRef.current.readyState}). Message not sent.`);
      return false;
    }
    
    if (!isAuthenticated && !opts.skipAuthCheck) {
      console.warn("WebSocket not authenticated. Message not sent.");
      return false;
    }
    
    try {
      socketRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    } catch (err) {
      console.error("Error sending WebSocket message:", err);
      return false;
    }
  }, [isAuthenticated, opts.skipAuthCheck]);
  
  // Subscribe to a facility's updates
  const subscribeFacility = useCallback((facilityId: number) => {
    return sendMessage({
      type: 'subscribe_facility',
      facilityId
    });
  }, [sendMessage]);
  
  // Join a conversation
  const joinConversation = useCallback((conversationId: string) => {
    return sendMessage({
      type: 'join_conversation',
      conversationId
    });
  }, [sendMessage]);
  
  // Leave a conversation
  const leaveConversation = useCallback((conversationId: string) => {
    return sendMessage({
      type: 'leave_conversation',
      conversationId
    });
  }, [sendMessage]);
  
  // Send a message to a conversation
  const sendChatMessage = useCallback((conversationId: string, message: any) => {
    return sendMessage({
      type: 'message',
      conversationId,
      message
    });
  }, [sendMessage]);
  
  // Connect when the component mounts or when the user changes
  useEffect(() => {
    connect();
    
    // Clean up the WebSocket connection and timers when the component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounting");
      }
      
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };
  }, [connect, user]);
  
  return {
    isConnected,
    isAuthenticated,
    lastMessage,
    error,
    sendMessage,
    subscribeFacility,
    joinConversation,
    leaveConversation,
    sendChatMessage
  };
}