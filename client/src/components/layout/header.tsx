import {
  Search,
  Menu,
  Bell,
  User as UserIcon,
  Calendar,
  MapPin,
  MessageSquare,
  Users,
  Trophy,
  LogIn,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch connection requests (pending connections)
  const { data: pendingConnections = [] } = useQuery({
    queryKey: ["/api/connections/pending"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch("/api/connections/pending");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch upcoming events (simplified for now)
  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["/api/events/upcoming"],
    queryFn: async () => {
      if (!user) return [];
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const response = await fetch(
        `/api/events?from=${now.toISOString()}&to=${tomorrow.toISOString()}`,
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch nearby facilities (simplified for now)
  const { data: nearbyFacilities = [] } = useQuery({
    queryKey: ["/api/facilities/nearby"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch("/api/facilities");
      if (!response.ok) return [];
      const facilities = await response.json();
      // For now, just return the first 2 to simulate "nearby" facilities
      return facilities.slice(0, 2);
    },
    enabled: !!user,
  });

  // Calculate total notifications
  useEffect(() => {
    const totalNotifications =
      pendingConnections.length +
      upcomingEvents.length +
      nearbyFacilities.length;
    setNotificationCount(totalNotifications);
  }, [pendingConnections, upcomingEvents, nearbyFacilities]);

  const handleLogout = () => {
    logoutMutation.mutate();
    // Navigation handled by AuthContext's useEffect
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Close mobile menu when navigating
  const handleNavigation = (path: string) => {
    setLocation(path);
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-sm z-50 sticky top-0 w-full">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="h-8 w-8 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <h1 className="ml-2 text-xl font-bold text-primary">YukHaLa</h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-6">
          <button
            onClick={() => handleNavigation("/")}
            className={`text-neutral-dark hover:text-primary transition-colors ${location === "/" ? "text-primary font-medium" : ""}`}
          >
            Map
          </button>
          <button
            onClick={() => handleNavigation("/community")}
            className={`text-neutral-dark hover:text-primary transition-colors ${location === "/community" ? "text-primary font-medium" : ""}`}
          >
            Community
          </button>
          <button
            onClick={() => handleNavigation("/events/create")}
            className={`text-neutral-dark hover:text-primary transition-colors ${location === "/events/create" ? "text-primary font-medium" : ""}`}
          >
            Start an Event
          </button>
          {user && (
            <>
              <button
                onClick={() => handleNavigation("/connections")}
                className={`text-neutral-dark hover:text-primary transition-colors flex items-center ${location === "/connections" ? "text-primary font-medium" : ""}`}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Connections
              </button>
              <button
                onClick={() => handleNavigation("/achievements")}
                className={`text-neutral-dark hover:text-primary transition-colors ${location === "/achievements" ? "text-primary font-medium" : ""}`}
              >
                Achievements
              </button>
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-neutral-dark hover:text-primary"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* User Menu */}
        <div className="hidden md:flex items-center space-x-4">
          <button className="text-neutral-dark hover:text-primary">
            <Search className="w-6 h-6" />
          </button>

          {user ? (
            <>
              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Bell className="h-5 w-5" />
                    {notificationCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                      >
                        {notificationCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-72 z-[99999]"
                  align="end"
                  forceMount
                >
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Connection Requests */}
                  {pendingConnections.length > 0 && (
                    <div className="p-2">
                      <h4 className="text-sm font-medium mb-2">
                        Connection Requests
                      </h4>
                      {pendingConnections.map((connection, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between mb-2 p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center">
                            <UserIcon className="h-4 w-4 mr-2 text-primary" />
                            <span className="text-sm">
                              {connection.username || "User"} wants to connect
                            </span>
                          </div>
                          <Button
                            onClick={() => handleNavigation("/connections")}
                            variant="outline"
                            size="sm"
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upcoming Events */}
                  {upcomingEvents.length > 0 && (
                    <div className="p-2">
                      <h4 className="text-sm font-medium mb-2">
                        Upcoming Events
                      </h4>
                      {upcomingEvents.map((event, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between mb-2 p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-primary" />
                            <span className="text-sm">{event.name}</span>
                          </div>
                          <Button
                            onClick={() =>
                              handleNavigation(`/events/${event.id}`)
                            }
                            variant="outline"
                            size="sm"
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nearby Facilities */}
                  {nearbyFacilities.length > 0 && (
                    <div className="p-2">
                      <h4 className="text-sm font-medium mb-2">
                        Nearby Facilities
                      </h4>
                      {nearbyFacilities.map((facility, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between mb-2 p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-primary" />
                            <span className="text-sm">{facility.name}</span>
                          </div>
                          <Button
                            onClick={() => {
                              handleNavigation("/");
                              // Could add a function to center map on this facility
                            }}
                            variant="outline"
                            size="sm"
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {notificationCount === 0 && (
                    <div className="p-4 text-center text-muted-foreground">
                      No new notifications
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-white">
                        {getInitials(user.fullName || user.username)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56 z-[99999]"
                  align="end"
                  side="bottom"
                  sideOffset={6}
                  forceMount
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.fullName || user.username}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email || user.username}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleNavigation("/profile")}
                  >
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleNavigation("/settings")}
                  >
                    Settings
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <DropdownMenuItem
                      onClick={() => handleNavigation("/admin")}
                    >
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => handleNavigation("/auth")}>Sign In</Button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 py-4 fixed top-16 left-0 right-0 z-[9999] shadow-md">
          <div className="container mx-auto px-4">
            <nav className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleNavigation("/")}
                className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
              >
                <MapPin className="h-5 w-5 mb-1" />
                Map
              </button>
              <button
                onClick={() => handleNavigation("/community")}
                className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
              >
                <Users className="h-5 w-5 mb-1" />
                Community
              </button>
              <button
                onClick={() => handleNavigation("/events/create")}
                className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
              >
                <Calendar className="h-5 w-5 mb-1" />
                Create Event
              </button>
              {user && (
                <>
                  <button
                    onClick={() => handleNavigation("/connections")}
                    className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                  >
                    <MessageSquare className="h-5 w-5 mb-1" />
                    Connections
                  </button>
                  <button
                    onClick={() => handleNavigation("/achievements")}
                    className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                  >
                    <Trophy className="h-5 w-5 mb-1" />
                    Achievements
                  </button>
                </>
              )}
              {user ? (
                <>
                  <button
                    onClick={() => handleNavigation("/profile")}
                    className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                  >
                    <UserIcon className="h-5 w-5 mb-1" />
                    Profile
                  </button>
                  <button
                    onClick={() => handleNavigation("/settings")}
                    className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                  >
                    <Settings className="h-5 w-5 mb-1" />
                    Settings
                  </button>
                  {user.isAdmin && (
                    <button
                      onClick={() => handleNavigation("/admin")}
                      className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                    >
                      <Shield className="h-5 w-5 mb-1" />
                      Admin
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                  >
                    <LogOut className="h-5 w-5 mb-1" />
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleNavigation("/auth")}
                  className="py-3 text-primary font-medium flex flex-col items-center text-sm rounded-md hover:bg-slate-50"
                >
                  <LogIn className="h-5 w-5 mb-1" />
                  Sign In
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
