import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, Copy, Key, RefreshCw, Unlock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ARTHUR_ID = 3;
const ARTHUR_USERNAME = "Arthur";

export default function AuthDebugPage() {
  const { user, isLoading } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [authDebugResult, setAuthDebugResult] = useState<any>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [tokenGenerateStatus, setTokenGenerateStatus] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [testRequestStatus, setTestRequestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testRequestResult, setTestRequestResult] = useState<any>(null);

  // Get token from localStorage on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setTokenInput(storedToken);
    }
  }, []);

  // Copy token to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        console.log("Token copied to clipboard");
      },
      (err) => {
        console.error("Failed to copy token: ", err);
      }
    );
  };

  // Generate fake admin token for Arthur
  const generateFakeToken = () => {
    setTokenGenerateStatus("generating");
    try {
      const fakePayload = {
        id: ARTHUR_ID,
        username: ARTHUR_USERNAME,
        fullName: "Arthur Chen",
        email: "arthur125a@gmail.com",
        isAdmin: true,
        preferredSports: ["basketball", "badminton", "swimming", "other"],
        skillLevel: {
          other: "expert",
          swimming: "expert",
          badminton: "beginner",
          basketball: "intermediate"
        },
        preferredLocations: ["north", "islands"],
        createdAt: new Date().toISOString()
      };

      // Encode fakePayload to base64
      const encodedPayload = btoa(JSON.stringify(fakePayload));

      // Create a fake JWT token (header.payload.signature)
      const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.fakesignature`;
      setTokenInput(fakeToken);
      setTokenGenerateStatus("success");
    } catch (error) {
      console.error("Error generating token:", error);
      setTokenGenerateStatus("error");
    }
  };

  // Check the validity of a token
  const checkToken = async () => {
    if (!tokenInput) return;
    
    setIsCheckingToken(true);
    
    try {
      const response = await fetch("/api/admin/debug", {
        headers: {
          "Authorization": `Bearer ${tokenInput}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAuthDebugResult(data);
      } else {
        const errorData = await response.json().catch(() => ({ message: `Error ${response.status}: ${response.statusText}` }));
        setAuthDebugResult({
          error: true,
          message: errorData.message || `Authentication failed with status ${response.status}`
        });
      }
    } catch (error) {
      setAuthDebugResult({
        error: true,
        message: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsCheckingToken(false);
    }
  };

  // Set token in localStorage
  const setToken = () => {
    if (!tokenInput) return;
    localStorage.setItem('auth_token', tokenInput);
    console.log("Token saved to localStorage");
  };

  // Make a test request to a protected endpoint
  const makeTestRequest = async () => {
    setTestRequestStatus("loading");
    try {
      const response = await fetch("/api/auth-status", {
        headers: {
          "Authorization": `Bearer ${tokenInput}`
        }
      });
      
      const data = await response.json();
      setTestRequestResult(data);
      setTestRequestStatus("success");
    } catch (error) {
      setTestRequestResult({
        error: true,
        message: error instanceof Error ? error.message : "An unknown error occurred during test request"
      });
      setTestRequestStatus("error");
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold">Authentication Debug Tool</h1>
      
      {/* Current user info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Authentication Status</CardTitle>
          <CardDescription>
            Details about your current login status from the auth context
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading authentication status...</span>
            </div>
          ) : user ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-semibold">Authenticated</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">User ID:</div>
                <div>{user.id}</div>
                <div className="font-medium">Username:</div>
                <div>{user.username}</div>
                <div className="font-medium">Admin Status:</div>
                <div>{user.isAdmin ? "Admin User ✓" : "Regular User"}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <span>Not authenticated</span>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Token management */}
      <Card>
        <CardHeader>
          <CardTitle>JWT Token Management</CardTitle>
          <CardDescription>
            Manage authentication tokens for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Authentication Token</Label>
            <div className="flex space-x-2">
              <Textarea 
                id="token" 
                placeholder="Paste JWT token here..." 
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="font-mono text-xs"
                rows={3}
              />
              {tokenInput && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(tokenInput)}
                  title="Copy token to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button onClick={generateFakeToken} disabled={tokenGenerateStatus === "generating"}>
              {tokenGenerateStatus === "generating" ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Generate Admin Token
                </>
              )}
            </Button>
            
            <Button onClick={setToken} variant="secondary" disabled={!tokenInput}>
              <Unlock className="mr-2 h-4 w-4" />
              Save Token to LocalStorage
            </Button>
            
            <Button onClick={checkToken} variant="outline" disabled={!tokenInput || isCheckingToken}>
              {isCheckingToken ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Verify Token"
              )}
            </Button>
          </div>
          
          {authDebugResult && (
            <div className="mt-4 border rounded-md p-4 bg-gray-50">
              <h3 className="text-lg font-medium mb-2">
                {authDebugResult.error 
                  ? "Token Verification Failed" 
                  : "Token Verification Result"
                }
              </h3>
              {authDebugResult.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{authDebugResult.message}</AlertDescription>
                </Alert>
              ) : (
                <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                  {JSON.stringify(authDebugResult, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Test API Request */}
      <Card>
        <CardHeader>
          <CardTitle>Test API Request</CardTitle>
          <CardDescription>
            Test an authenticated request to verify your token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={makeTestRequest} 
            disabled={!tokenInput || testRequestStatus === "loading"}
          >
            {testRequestStatus === "loading" ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Make Test Request to /api/auth-status"
            )}
          </Button>
          
          {testRequestResult && (
            <div className="mt-4 border rounded-md p-4 bg-gray-50">
              <h3 className="text-lg font-medium mb-2">
                {testRequestStatus === "error" 
                  ? "Test Request Failed" 
                  : "Test Request Result"
                }
              </h3>
              <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                {JSON.stringify(testRequestResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-sm text-gray-500">
          This test will send your token to the server to verify authentication.
        </CardFooter>
      </Card>
    </div>
  );
}