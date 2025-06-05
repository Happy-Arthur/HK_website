// client/src/components/quick-login.tsx
// This is a simple component to help test authentication quickly

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { checkAuthStatus } from "@/lib/auth-debug";

export default function QuickLogin() {
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("password");
  const { loginMutation, user, logoutMutation } = useAuth();

  const handleLogin = async () => {
    try {
      await loginMutation.mutateAsync({ username, password });
      console.log("Login mutation completed");

      // Check auth status to debug
      setTimeout(async () => {
        await checkAuthStatus();
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      console.log("Logout successful");
      // Check auth status after logout
      setTimeout(async () => {
        await checkAuthStatus();
      }, 1000);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const checkStatus = async () => {
    const status = await checkAuthStatus();
    console.log("Current auth status:", status);
  };

  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-medium mb-4">Quick Authentication Test</h3>

      {user ? (
        <div>
          <p className="mb-2">
            Logged in as: <strong>{user.username}</strong> (ID: {user.id})
          </p>
          <div className="flex space-x-2">
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
            <Button onClick={checkStatus}>Check Status</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Username:</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password:</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleLogin}>Login</Button>
            <Button onClick={checkStatus} variant="outline">
              Check Status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
