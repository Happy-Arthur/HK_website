import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";
import { Header } from "@/components/layout/header";
import { TokenRefresher } from "@/components/auth/token-refresher";
import { CookieDebugger } from "@/components/admin/cookie-debugger";

export default function TestLoginPage() {
  const [username, setUsername] = useState("Arthur");
  const [password, setPassword] = useState("password123");
  const { toast } = useToast();
  const { user, loginMutation, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showDebug, setShowDebug] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await loginMutation.mutateAsync({ username, password });
      toast({
        title: "Login successful",
        description: "You have successfully logged in.",
      });
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleGoToAdmin = () => {
    setLocation("/admin-dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TokenRefresher />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Login Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Quick Login</CardTitle>
              <CardDescription>
                Use this form to test login functionality with admin credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Auth Status</CardTitle>
              <CardDescription>
                Current login status and admin access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <Shield className="h-5 w-5 text-green-500 mr-2" />
                      <p className="font-medium text-green-800">Logged In Successfully</p>
                    </div>
                    <p className="mt-2 text-sm text-green-700">
                      Logged in as: <span className="font-semibold">{user.username}</span>
                    </p>
                    <p className="mt-1 text-sm text-green-700">
                      Admin Status: <span className="font-semibold">{user.isAdmin ? "Yes" : "No"}</span>
                    </p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    {user.isAdmin && (
                      <Button onClick={handleGoToAdmin} className="w-full">
                        Go to Admin Dashboard
                      </Button>
                    )}
                    <Button onClick={handleLogout} variant="outline" className="w-full">
                      {logoutMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging out...
                        </>
                      ) : (
                        "Logout"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-amber-500 mr-2" />
                    <p className="font-medium text-amber-800">Not Logged In</p>
                  </div>
                  <p className="mt-2 text-sm text-amber-700">
                    Please use the login form to authenticate.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Debug Tools */}
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-xl">Auth Debugging Tools</CardTitle>
              <CardDescription>
                Troubleshoot authentication issues
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? "Hide" : "Show"} Debug Info
            </Button>
          </CardHeader>
          {showDebug && (
            <CardContent>
              <CookieDebugger />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}