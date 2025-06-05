import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Award,
  Home,
  LogOut,
  Menu,
  Settings,
  User,
  Users,
  Calendar,
  BarChart,
  Map,
  CheckSquare,
} from "lucide-react";

export function AdminHeader() {
  const { user, logout } = useAuth();

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/admin/dashboard">
            <Button variant="link" className="font-bold text-xl">
              <Settings className="mr-2 h-5 w-5" />
              Admin Portal
            </Button>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-5">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="sm">
              <BarChart className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link to="/admin/users">
            <Button variant="ghost" size="sm">
              <Users className="mr-2 h-4 w-4" />
              Users
            </Button>
          </Link>
          <Link to="/admin/facilities">
            <Button variant="ghost" size="sm">
              <Map className="mr-2 h-4 w-4" />
              Facilities
            </Button>
          </Link>
          <Link to="/admin/events">
            <Button variant="ghost" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Events
            </Button>
          </Link>
          <Link to="/admin/achievements">
            <Button variant="ghost" size="sm">
              <Award className="mr-2 h-4 w-4" />
              Achievements
            </Button>
          </Link>
          <Link to="/admin/challenges">
            <Button variant="ghost" size="sm">
              <CheckSquare className="mr-2 h-4 w-4" />
              Challenges
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-full">
                <span className="hidden md:inline-block mr-2">{user.username}</span>
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link to="/">
                <DropdownMenuItem>
                  <Home className="mr-2 h-4 w-4" />
                  <span>Return to App</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile navigation */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <Link to="/admin/dashboard">
                  <DropdownMenuItem>
                    <BarChart className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/admin/users">
                  <DropdownMenuItem>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Users</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/admin/facilities">
                  <DropdownMenuItem>
                    <Map className="mr-2 h-4 w-4" />
                    <span>Facilities</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/admin/events">
                  <DropdownMenuItem>
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Events</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/admin/achievements">
                  <DropdownMenuItem>
                    <Award className="mr-2 h-4 w-4" />
                    <span>Achievements</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/admin/challenges">
                  <DropdownMenuItem>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span>Challenges</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link to="/">
                  <DropdownMenuItem>
                    <Home className="mr-2 h-4 w-4" />
                    <span>Return to App</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}