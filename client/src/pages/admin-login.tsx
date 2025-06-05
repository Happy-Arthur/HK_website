import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TokenRefresher } from "@/components/auth/token-refresher";
import { CookieDebugger } from "@/components/admin/cookie-debugger";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("Arthur");
  const [password, setPassword] = useState("password123");
  const { toast } = useToast();
  const { loginMutation } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await loginMutation.mutateAsync({ username, password });
      toast({
        title: "Login successful",
        description: "Redirecting to admin dashboard...",
      });
      setLocation("/admin/dashboard");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <TokenRefresher />
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Log in to access the admin dashboard
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
        <CardFooter className="flex flex-col">
          <div className="text-sm text-muted-foreground mb-4">
            <p>Default admin credentials are pre-filled.</p>
            <p className="mt-2">
              <Button 
                variant="link" 
                className="p-0 h-auto text-sm" 
                onClick={() => setLocation("/auth-debug")}
              >
                Having trouble logging in? Debug auth here
              </Button>
            </p>
          </div>
          <CookieDebugger />
        </CardFooter>
      </Card>
    </div>
  );
}