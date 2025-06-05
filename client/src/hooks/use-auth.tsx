import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      console.log("Making query request to: /api/user");
      try {
        // Create headers object with potential token from localStorage
        const headers: HeadersInit = {};
        const storedToken = localStorage.getItem("auth_token");
        if (storedToken) {
          console.log(
            "Found auth token in localStorage, adding to request header",
          );
          headers["Authorization"] = `Bearer ${storedToken}`;
        }

        // Make the request with the headers and credentials
        const res = await fetch("/api/user", {
          headers,
          credentials: "include", // Always include cookies
        });

        if (res.status === 401) {
          console.log("User not authenticated, redirecting to auth page");
          console.warn("Authentication error in query to /api/user");
          return null;
        }
        if (!res.ok) {
          throw new Error(
            `Error fetching user: ${res.status} ${res.statusText}`,
          );
        }
        const userData = await res.json();
        console.log("User data retrieved:", userData.username);
        return userData;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error fetching user";
        console.error("Error fetching user data:", errorMessage);
        throw new Error(errorMessage);
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login for user:", credentials.username);
      const res = await apiRequest("POST", "/api/login", credentials);

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: "Login failed" }));
        throw new Error(errorData.message || "Login failed");
      }

      const userData = await res.json();
      console.log("Login successful for user:", userData.username);

      // Store token in localStorage as a fallback in case cookies don't work
      if (userData.token) {
        console.log("Storing auth token in localStorage as fallback");
        localStorage.setItem("auth_token", userData.token);

        // Remove token from user data before storing in query cache
        const { token, ...userWithoutToken } = userData;
        return userWithoutToken;
      }

      return userData;
    },
    onSuccess: (userData: SelectUser) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.username}!`,
      });

      // Force a page reload to update state throughout the app
      window.location.href = "/";
    },
    onError: (error: Error) => {
      console.error("Login error:", error.message);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      console.log("Attempting registration for user:", credentials.username);
      const res = await apiRequest("POST", "/api/register", credentials);

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: "Registration failed" }));
        throw new Error(errorData.message || "Registration failed");
      }

      const userData = await res.json();
      console.log("Registration successful for user:", userData.username);

      // Store token in localStorage as a fallback if present
      if (userData.token) {
        console.log("Storing auth token in localStorage from registration");
        localStorage.setItem("auth_token", userData.token);

        // Remove token from user data before storing in query cache
        const { token, ...userWithoutToken } = userData;
        return userWithoutToken;
      }

      return userData;
    },
    onSuccess: (userData: SelectUser) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({
        title: "Registration successful",
        description: `Welcome, ${userData.username}! Let's set up your profile.`,
      });

      // Force a page reload to update state and redirect to profile setup
      window.location.href = "/profile-setup";
    },
    onError: (error: Error) => {
      console.error("Registration error:", error.message);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Attempting logout");
      const res = await apiRequest("POST", "/api/logout");

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      // Clear localStorage token
      localStorage.removeItem("auth_token");
      console.log("Removed auth token from localStorage");

      console.log("Logout successful");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });

      // Force a page reload to ensure clean state
      window.location.replace ("/auth");
    },
    onError: (error: Error) => {
      console.error("Logout error:", error.message);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Effect to automatically redirect based on auth state
  useEffect(() => {
    // Wait until loading is complete so we know the true auth state
    if (isLoading) return;

    // Don't redirect if we're already at the correct page
    const currentPath = location.split("?")[0]; // Ignore query params

    if (!user) {
      // User is not authenticated
      const publicPaths = ["/auth", "/register", "/forgot-password"];

      // Only redirect to auth page if we're not already on a public path
      if (!publicPaths.includes(currentPath)) {
        console.log(
          "Not authenticated and not on public path. Redirecting to /auth",
        );
        setLocation("/auth");
      }
    } else {
      // User is authenticated
      const authOnlyPaths = ["/auth", "/register"];

      // Redirect away from auth pages when already logged in
      if (authOnlyPaths.includes(currentPath)) {
        console.log("Already authenticated. Redirecting to home");
        setLocation("/");
      }

      // Redirect to profile setup if user doesn't have complete profile
      if (
        currentPath !== "/profile-setup" &&
        (!user.fullName ||
          !user.preferredSports ||
          user.preferredSports.length === 0)
      ) {
        console.log(
          "User missing profile information. Redirecting to profile setup",
        );
        setLocation("/profile-setup");
      }
    }
  }, [user, isLoading, location, setLocation]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
