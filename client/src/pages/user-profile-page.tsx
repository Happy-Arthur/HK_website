import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useParams, Redirect } from "wouter";
import { Header } from "@/components/layout/header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  CalendarDays, 
  Mail, 
  MapPin, 
  Phone,
  User,
  MessageSquare,
  Loader2,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  ShieldAlert
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

type UserProfile = {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  preferredSports: string[] | null;
  skillLevel: Record<string, string> | null;
  preferredLocations: string[] | null;
  bio: string | null;
  createdAt: string | null;
  restricted?: boolean; // Flag to indicate if profile view is restricted
};

export default function UserProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const [connecting, setConnecting] = useState(false);

  // Fetch user profile
  const { data: profile, isLoading, error } = useQuery<UserProfile[]>({
    queryKey: [`/api/users?userId=${userId}`],
    enabled: !isNaN(userId),
  });

  // Fetch user connections to check connection status
  const { data: connections } = useQuery({
    queryKey: ["/api/connections"],
    queryFn: async () => {
      const response = await fetch("/api/connections");
      if (!response.ok) {
        throw new Error("Failed to fetch connections");
      }
      return response.json();
    },
    enabled: !!user,
  });

  const userProfile = profile && profile.length > 0 ? profile[0] : null;

  // Check if already connected
  const connectionStatus = useMemo(() => {
    if (!connections || !user) return { connected: false, pending: false };
    
    // Check if connected (either direction)
    const connection = connections.find((conn: any) => 
      (conn.connectedUserId === parseInt(userId as string) && conn.userId === user.id) || 
      (conn.userId === parseInt(userId as string) && conn.connectedUserId === user.id)
    );
    
    if (!connection) return { connected: false, pending: false };
    
    return { 
      connected: connection.status === "accepted",
      pending: connection.status === "pending"
    };
  }, [connections, user, userId]);

  // Handle connection request
  const handleConnect = async () => {
    if (!user) return;
    
    setConnecting(true);
    try {
      const response = await apiRequest("POST", "/api/connections", {
        connectedUserId: userId
      });
      
      if (response.ok) {
        // Invalidate connections query to update UI
        queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
        setConnecting(false);
      } else {
        throw new Error("Failed to connect with user");
      }
    } catch (error) {
      console.error("Error connecting with user:", error);
      setConnecting(false);
    }
  };

  // Redirect if trying to view own profile
  if (user && user.id === userId) {
    return <Redirect to="/profile" />;
  }

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto flex items-center justify-center min-h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  // Handle error state
  if (error || !userProfile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">User Not Found</h1>
            <p className="text-muted-foreground mb-6">The user profile you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => window.history.back()}
            className="mb-4 text-sm hover:bg-slate-100"
            size="sm"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Button>

          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
              <AvatarFallback className="text-lg sm:text-xl">
                {getInitials(userProfile.fullName || userProfile.username)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{userProfile.fullName || userProfile.username}</h1>
                  <p className="text-muted-foreground text-sm sm:text-base">@{userProfile.username}</p>
                </div>
                
                {user && (
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <Button 
                      onClick={() => setLocation(`/messages/${userId}`)}
                      className="flex items-center text-sm sm:text-base"
                      size="sm"
                      variant="secondary"
                    >
                      <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Message
                    </Button>
                    
                    {connectionStatus.connected ? (
                      <Button variant="outline" className="flex items-center text-sm sm:text-base" size="sm" disabled>
                        <CheckCircle className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Connected
                      </Button>
                    ) : connectionStatus.pending ? (
                      <Button variant="outline" className="flex items-center text-sm sm:text-base" size="sm" disabled>
                        <Clock className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Pending
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleConnect}
                        variant="outline"
                        className="text-sm sm:text-base"
                        size="sm"
                        disabled={connecting}
                      >
                        {connecting ? (
                          <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        ) : (
                          <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {userProfile.bio && (
                <p className="mt-4">{userProfile.bio}</p>
              )}
              
              <div className="flex items-center gap-2 mt-4">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Joined {userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
            </div>
          </div>
          
          {userProfile.restricted && (
            <Alert variant="warning" className="mb-4 sm:mb-6 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertTitle className="text-sm font-medium">Restricted Profile View</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm">
                You can only view limited information as you're not in the same group as this user. Join the same group to see full profile details.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Contact Information */}
            <Card className="shadow-sm">
              <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-lg sm:text-xl">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
                {userProfile.restricted ? (
                  <div className="flex items-center text-muted-foreground text-sm">
                    <ShieldAlert className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Contact information is hidden. Join the same group to see contact details.</span>
                  </div>
                ) : (
                  <>
                    {userProfile.email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm sm:text-base break-all">{userProfile.email}</span>
                      </div>
                    )}
                    {userProfile.phoneNumber && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm sm:text-base">{userProfile.phoneNumber}</span>
                      </div>
                    )}
                    {(!userProfile.email && !userProfile.phoneNumber) && (
                      <p className="text-muted-foreground text-sm">No contact information available</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Sports & Skills */}
            <Card className="shadow-sm">
              <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-lg sm:text-xl">Sports & Skills</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 py-3 sm:py-4">
                {userProfile.preferredSports && userProfile.preferredSports.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Preferred Sports</h3>
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {userProfile.preferredSports.map((sport) => (
                          <Badge key={sport} variant="secondary" className="capitalize text-xs sm:text-sm py-1">
                            {sport.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {userProfile.skillLevel && Object.keys(userProfile.skillLevel).length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">Skill Levels</h3>
                        <div className="space-y-2 text-sm">
                          {Object.entries(userProfile.skillLevel).map(([sport, level]) => (
                            <div key={sport} className="flex justify-between items-center">
                              <span className="capitalize">{sport.replace(/_/g, ' ')}</span>
                              <Badge variant="outline" className="text-xs">{level}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No sports preferences available</p>
                )}
              </CardContent>
            </Card>
            
            {/* Locations */}
            {userProfile.preferredLocations && userProfile.preferredLocations.length > 0 && (
              <Card className="md:col-span-2 shadow-sm">
                <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                  <CardTitle className="text-lg sm:text-xl">Preferred Locations</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 py-3 sm:py-4">
                  <div className="flex flex-wrap gap-2">
                    {userProfile.preferredLocations.map((location) => (
                      <div key={location} className="flex items-center bg-muted rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm">
                        <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="capitalize">{location.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}