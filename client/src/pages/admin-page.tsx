import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already logged in as admin
  useEffect(() => {
    if (user?.isAdmin) {
      setLocation("/admin/dashboard");
    }
  }, [user, setLocation]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-6 w-6 text-primary" />
            Admin Area
          </CardTitle>
          <CardDescription>
            Access the administrative functions of the Hong Kong Sports Hub
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="text-center space-y-4">
              {user.isAdmin ? (
                <>
                  <p className="text-lg font-medium">Welcome, Admin {user.fullName || user.username}!</p>
                  <p>You have access to the admin dashboard.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">Access Restricted</p>
                  <p className="text-muted-foreground">
                    Your account doesn't have administrative privileges.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-lg font-medium">Authentication Required</p>
              <p className="text-muted-foreground">
                Please log in with an admin account to access this area.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {user ? (
            user.isAdmin ? (
              <Button onClick={() => setLocation("/admin/dashboard")}>
                Go to Admin Dashboard
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setLocation("/")}>
                Back to Home
              </Button>
            )
          ) : (
            <Button onClick={() => setLocation("/admin-login")}>
              Admin Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}