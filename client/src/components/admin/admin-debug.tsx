import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CookieDebugger } from "./cookie-debugger";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export function AdminDebug() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [debugResults, setDebugResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [groupsData, setGroupsData] = useState<any>(null);
  const [groupsLoading, setGroupsLoading] = useState<boolean>(false);
  const [eventsData, setEventsData] = useState<any>(null);
  const [eventsLoading, setEventsLoading] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [authStatusLoading, setAuthStatusLoading] = useState<boolean>(false);
  const [cookieTest, setCookieTest] = useState<any>(null);
  const [cookieTestLoading, setCookieTestLoading] = useState<boolean>(false);

  // Convert data to pretty JSON string
  const formatData = (data: any) => {
    return JSON.stringify(data, null, 2);
  };

  const runDebug = async () => {
    setIsLoading(true);
    try {
      console.log("Checking admin debug endpoint...");
      const response = await fetch("/api/admin/debug", {
        credentials: "include" // Explicitly include credentials
      });
      
      // Log response details for debugging
      console.log("Admin debug response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Admin debug error:", errorText);
        setDebugResults({ 
          error: `API Error: ${response.status} ${response.statusText}`, 
          details: errorText 
        });
        return;
      }
      
      const data = await response.json();
      console.log("Admin debug success:", data);
      setDebugResults(data);
    } catch (error) {
      console.error("Admin debug fetch error:", error);
      setDebugResults({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      console.log("Fetching admin groups...");
      const response = await fetch("/api/admin/groups", {
        credentials: "include" // Explicitly include credentials
      });
      
      console.log("Admin groups response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Admin groups error:", errorText);
        setGroupsData({ 
          error: `API Error: ${response.status} ${response.statusText}`, 
          details: errorText 
        });
        return;
      }
      
      const data = await response.json();
      console.log(`Successfully fetched ${data.length} groups`);
      setGroupsData(data);
    } catch (error) {
      console.error("Admin groups fetch error:", error);
      setGroupsData({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      console.log("Fetching admin events...");
      const response = await fetch("/api/admin/events", {
        credentials: "include" // Explicitly include credentials
      });
      
      console.log("Admin events response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Admin events error:", errorText);
        setEventsData({ 
          error: `API Error: ${response.status} ${response.statusText}`, 
          details: errorText 
        });
        return;
      }
      
      const data = await response.json();
      console.log(`Successfully fetched ${data.length} events`);
      setEventsData(data);
    } catch (error) {
      console.error("Admin events fetch error:", error);
      setEventsData({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setEventsLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    setAuthStatusLoading(true);
    try {
      console.log("Checking auth status...");
      
      // Check for localStorage token
      const storedToken = localStorage.getItem('auth_token');
      const hasLocalStorageToken = !!storedToken;
      console.log("Has localStorage auth token:", hasLocalStorageToken);
      
      // If token exists, check if it's valid JWT format
      let tokenInfo = null;
      if (storedToken) {
        try {
          // Just check basic JWT structure (3 parts separated by dots)
          const parts = storedToken.split('.');
          if (parts.length === 3) {
            // Try to decode the payload part (middle section)
            const payload = JSON.parse(atob(parts[1]));
            tokenInfo = {
              valid: true,
              payload: payload,
              expires: new Date(payload.exp * 1000).toLocaleString(),
              user: payload.username,
              userId: payload.id,
              isAdmin: payload.isAdmin
            };
          } else {
            tokenInfo = { valid: false, reason: "Not a valid JWT format" };
          }
        } catch (error) {
          tokenInfo = { valid: false, reason: "Failed to parse token", error: (error as Error).message };
        }
      }
      
      // Set headers with token if available in localStorage
      const headers: HeadersInit = {};
      if (hasLocalStorageToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }
      
      const response = await fetch("/api/auth-status", {
        credentials: "include", // Explicitly include credentials
        headers
      });
      
      console.log("Auth status response:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Auth status error:", errorText);
        setAuthStatus({ 
          error: `API Error: ${response.status} ${response.statusText}`, 
          details: errorText,
          authenticated: false,
          hasLocalStorageToken,
          tokenInfo
        });
        return;
      }
      
      const data = await response.json();
      console.log("Auth status:", data);
      
      // Merge server response with client-side token info
      setAuthStatus({
        ...data,
        hasLocalStorageToken,
        tokenInfo
      });
    } catch (error) {
      console.error("Auth status fetch error:", error);
      setAuthStatus({ 
        error: error instanceof Error ? error.message : "Unknown error",
        authenticated: false
      });
    } finally {
      setAuthStatusLoading(false);
    }
  };
  
  const testCookies = async () => {
    setCookieTestLoading(true);
    try {
      console.log("Testing cookie functionality...");
      
      // First, test by directly setting a client-side cookie
      const directTestValue = "direct-test-" + Date.now();
      document.cookie = `direct_test=${directTestValue};path=/;max-age=300`;
      
      // Get current cookies
      const currentCookies = document.cookie;
      console.log("Current client-side cookies:", currentCookies);
      
      // Check if direct cookie setting worked
      const directCookieWorks = currentCookies.includes("direct_test");
      console.log("Direct cookie setting works:", directCookieWorks);
      
      // Check for localStorage token
      const storedToken = localStorage.getItem('auth_token');
      const hasLocalStorageToken = !!storedToken;
      console.log("Has localStorage auth token:", hasLocalStorageToken);
      
      // If token exists, check if it's valid JWT format
      let tokenInfo = null;
      if (storedToken) {
        try {
          // Just check basic JWT structure (3 parts separated by dots)
          const parts = storedToken.split('.');
          if (parts.length === 3) {
            // Try to decode the payload part (middle section)
            const payload = JSON.parse(atob(parts[1]));
            tokenInfo = {
              valid: true,
              payload: payload,
              expires: new Date(payload.exp * 1000).toLocaleString(),
              user: payload.username,
              userId: payload.id,
              isAdmin: payload.isAdmin
            };
          } else {
            tokenInfo = { valid: false, reason: "Not a valid JWT format" };
          }
        } catch (error) {
          tokenInfo = { valid: false, reason: "Failed to parse token", error: (error as Error).message };
        }
      }
      
      // Test third-party cookie blocking
      let thirdPartyCookiesBlocked = false;
      try {
        // Create an iframe to test third-party cookies
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Try to access cookies from iframe
        try {
          iframe.contentWindow?.document.cookie;
          thirdPartyCookiesBlocked = false;
        } catch (e) {
          console.log("Third-party cookies appear to be blocked:", e);
          thirdPartyCookiesBlocked = true;
        }
        
        // Cleanup
        document.body.removeChild(iframe);
      } catch (e) {
        console.error("Error testing third-party cookies:", e);
      }
      
      // Test setting and retrieving a cookie via the API
      const response = await fetch("/api/test-cookie", {
        credentials: "include", // Explicitly include credentials
        headers: hasLocalStorageToken ? { 
          'Authorization': `Bearer ${storedToken}` 
        } : {}
      });
      
      console.log("Cookie test response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Cookie test error:", errorText);
        setCookieTest({ 
          error: `API Error: ${response.status} ${response.statusText}`, 
          details: errorText,
          directCookieWorks,
          thirdPartyCookiesBlocked,
          hasLocalStorageToken,
          tokenInfo
        });
        return;
      }
      
      const data = await response.json();
      console.log("Cookie test response:", data);
      
      // Check if we can read the test cookie (it's non-httpOnly)
      setTimeout(() => {
        const updatedCookies = document.cookie;
        console.log("Cookies after test:", updatedCookies);
        
        // Check browser info
        const browserInfo = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          language: navigator.language,
          vendor: navigator.vendor
        };
        
        // Update the result with client-side cookie info
        setCookieTest({
          ...data,
          clientCookiesBefore: currentCookies,
          clientCookiesAfter: updatedCookies,
          testCookieFound: updatedCookies.includes("test_cookie"),
          directCookieWorks,
          thirdPartyCookiesBlocked,
          hasLocalStorageToken,
          tokenInfo,
          browserInfo
        });
      }, 500); // Short delay to ensure cookie is set
    } catch (error) {
      console.error("Cookie test error:", error);
      setCookieTest({ 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setCookieTestLoading(false);
    }
  };

  // Clear auth token from localStorage
  const clearAuthToken = () => {
    try {
      localStorage.removeItem('auth_token');
      toast({
        title: "Auth token cleared",
        description: "Successfully removed auth token from localStorage",
      });
      // Refresh auth status to update UI
      checkAuthStatus();
    } catch (error) {
      console.error("Error clearing auth token:", error);
      toast({
        title: "Error clearing token",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Copy the current token to clipboard for debugging
  const copyTokenToClipboard = () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast({
          title: "No token found",
          description: "There is no auth token in localStorage to copy",
          variant: "destructive",
        });
        return;
      }

      navigator.clipboard.writeText(token).then(() => {
        toast({
          title: "Token copied",
          description: "Auth token has been copied to clipboard",
        });
      }).catch(err => {
        throw err;
      });
    } catch (error) {
      console.error("Error copying token:", error);
      toast({
        title: "Error copying token",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Run auth check on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const isAdmin = user?.id === 1;

  return (
    <div className="space-y-6">
      <CookieDebugger />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Admin API Debug</CardTitle>
          <CardDescription>
            Test and debug admin API endpoints. Current user: {user?.username || "Not logged in"} (ID: {user?.id})
            {isAdmin ? " - Admin" : " - Not Admin"}
          </CardDescription>
          <div className="mt-2 text-xs text-muted-foreground border border-yellow-300 bg-yellow-50 p-2 rounded">
            <p><strong>Browser compatibility note:</strong> Some browsers block third-party cookies by default, which may affect authentication. 
            If you're experiencing login issues, try using Chrome or Firefox with third-party cookies enabled, or add this site to your allowed cookies list.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={runDebug}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Check Admin Debug Endpoint
              </Button>
              <Button
                variant="outline"
                onClick={fetchGroups}
                disabled={groupsLoading}
              >
                {groupsLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Test Groups API
              </Button>
              <Button
                variant="outline"
                onClick={fetchEvents}
                disabled={eventsLoading}
              >
                {eventsLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Test Events API
              </Button>
              <Button
                variant="outline"
                onClick={checkAuthStatus}
                disabled={authStatusLoading}
              >
                {authStatusLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Check Auth Status
              </Button>
              <Button
                variant="outline"
                onClick={testCookies}
                disabled={cookieTestLoading}
              >
                {cookieTestLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Test Cookies
              </Button>
            </div>
            
            {/* Token management section */}
            <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
              <h3 className="text-sm font-medium mb-2">Auth Token Management</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearAuthToken}
                >
                  Clear LocalStorage Token
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyTokenToClipboard}
                >
                  Copy Token to Clipboard
                </Button>
              </div>
              {authStatus?.tokenInfo && (
                <div className="text-xs mt-2">
                  <p>
                    Token Status: {authStatus.tokenInfo.valid ? 
                      <span className="text-green-600 font-medium">Valid</span> : 
                      <span className="text-red-600 font-medium">Invalid</span>}
                  </p>
                  {authStatus.tokenInfo.valid && (
                    <>
                      <p>User: {authStatus.tokenInfo.user} (ID: {authStatus.tokenInfo.userId})</p>
                      <p>Expires: {authStatus.tokenInfo.expires}</p>
                      <p>Admin: {authStatus.tokenInfo.isAdmin ? "Yes" : "No"}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <Accordion type="single" collapsible className="w-full">
              {authStatus && (
                <AccordionItem value="auth-status">
                  <AccordionTrigger>
                    Auth Status {authStatus.authenticated ? "✅" : "❌"}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                      <pre className="whitespace-pre-wrap">{formatData(authStatus)}</pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              )}
              
              {debugResults && (
                <AccordionItem value="debug-results">
                  <AccordionTrigger>Admin Debug Results</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                      <pre className="whitespace-pre-wrap">{formatData(debugResults)}</pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              )}
              
              {groupsData && (
                <AccordionItem value="groups-data">
                  <AccordionTrigger>Groups API Results</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                      <pre className="whitespace-pre-wrap">{formatData(groupsData)}</pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              )}
              
              {eventsData && (
                <AccordionItem value="events-data">
                  <AccordionTrigger>Events API Results</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                      <pre className="whitespace-pre-wrap">{formatData(eventsData)}</pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              )}
              
              {cookieTest && (
                <AccordionItem value="cookie-test">
                  <AccordionTrigger>
                    Cookie Test {cookieTest.testCookieFound ? "✅" : "❌"}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                      <pre className="whitespace-pre-wrap">{formatData(cookieTest)}</pre>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}