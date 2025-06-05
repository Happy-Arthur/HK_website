import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

export function TestAuth() {
  const { user, isLoading, loginMutation, logoutMutation, registerMutation } = useAuth();
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("password123");
  const [email, setEmail] = useState("test@example.com");
  const [fullName, setFullName] = useState("Test User");
  const [authState, setAuthState] = useState<null | string>(null);

  const handleLogin = () => {
    setAuthState("Logging in...");
    loginMutation.mutate(
      { username, password },
      {
        onSuccess: () => {
          setAuthState("Login successful");
        },
        onError: (error) => {
          setAuthState(`Login failed: ${error.message}`);
        },
      }
    );
  };

  const handleLogout = () => {
    setAuthState("Logging out...");
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setAuthState("Logout successful");
      },
      onError: (error) => {
        setAuthState(`Logout failed: ${error.message}`);
      },
    });
  };

  const handleRegister = () => {
    setAuthState("Registering...");
    registerMutation.mutate(
      { username, password, email, fullName },
      {
        onSuccess: () => {
          setAuthState("Registration successful");
        },
        onError: (error) => {
          setAuthState(`Registration failed: ${error.message}`);
        },
      }
    );
  };

  const checkCookies = () => {
    setAuthState("Checking cookies...");
    const cookies = document.cookie;
    setAuthState(`Cookies: ${cookies || "No cookies found"}`);
  };

  const testCookieSet = () => {
    setAuthState("Setting test cookie...");
    document.cookie = "test_cookie=1; path=/";
    setAuthState("Test cookie set. Check browser network tab for cookie warnings.");
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Auth System Test</h1>

      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Current Auth State</CardTitle>
            <CardDescription>
              This section shows your current authentication status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading auth state...</span>
              </div>
            ) : user ? (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Logged in as:</span> {user.username}
                </p>
                <p>
                  <span className="font-semibold">User ID:</span> {user.id}
                </p>
                <p>
                  <span className="font-semibold">Email:</span> {user.email || "N/A"}
                </p>
                <p>
                  <span className="font-semibold">Admin:</span>{" "}
                  {user.isAdmin ? "Yes" : "No"}
                </p>
              </div>
            ) : (
              <p>Not logged in</p>
            )}

            {authState && (
              <div className="mt-4 p-3 bg-slate-100 rounded">
                <p className="text-sm">{authState}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={checkCookies}>
              Check Cookies
            </Button>
            <Button variant="outline" onClick={testCookieSet}>
              Test Cookie Set
            </Button>
            {user ? (
              <Button variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
            ) : (
              <Button variant="default" onClick={handleLogin}>
                Quick Login
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>
                Test the login functionality with predefined credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Login
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Register</CardTitle>
              <CardDescription>
                Test the registration functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-username">Username</Label>
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleRegister}
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Register
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="prose max-w-none">
        <h2>Authentication Debug Information</h2>
        <p>
          This page helps debug authentication issues by providing direct access
          to login, register, and logout functionality.
        </p>
        <h3>Default Test Credentials</h3>
        <ul>
          <li>
            <strong>Username:</strong> testuser
          </li>
          <li>
            <strong>Password:</strong> password123
          </li>
        </ul>
        <h3>Helpful Tips</h3>
        <ul>
          <li>Check browser console for detailed error messages</li>
          <li>
            Use the "Check Cookies" button to verify if auth cookies are being
            set properly
          </li>
          <li>
            If you're having CORS issues, make sure the backend and frontend are
            configured correctly
          </li>
        </ul>
      </div>
    </div>
  );
}