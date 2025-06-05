import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Cookie Debugger Component
 * 
 * This component helps diagnose cookie-related issues in the admin dashboard.
 * It provides utilities for:
 * - Viewing all cookies 
 * - Creating test cookies
 * - Testing secure/httpOnly flags
 * - Testing manual token storage
 */
export function CookieDebugger() {
  const { toast } = useToast();
  const [cookies, setCookies] = useState<{[key: string]: string}>({});
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cookieName, setCookieName] = useState('test_cookie');
  const [cookieValue, setCookieValue] = useState('test_value_' + Date.now());
  const [isHttpOnly, setIsHttpOnly] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [sameSite, setSameSite] = useState<'strict' | 'lax' | 'none'>('none');
  const [manualToken, setManualToken] = useState('');
  
  // Load cookies on mount and periodically
  useEffect(() => {
    loadCookies();
    const interval = setInterval(loadCookies, 5000);
    return () => clearInterval(interval);
  }, []);

  // Parse document cookies into an object
  const loadCookies = () => {
    const cookiesObj: {[key: string]: string} = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name) cookiesObj[name] = value || '';
    });
    setCookies(cookiesObj);
  };

  // Check auth status from server
  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      // Make a request to the auth-status endpoint
      const res = await fetch('/api/auth-status', {
        credentials: 'include',
        headers: {
          'Authorization': localStorage.getItem('auth_token') ? 
            `Bearer ${localStorage.getItem('auth_token')}` : ''
        }
      });
      
      if (!res.ok) {
        throw new Error(`Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      setAuthStatus(data);
      
      toast({
        title: data.authenticated ? 'Authenticated' : 'Not authenticated',
        description: data.authenticated ? 
          `Logged in as ${data.user?.username}` : 'No valid authentication found',
        variant: data.authenticated ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('Error checking auth status:', error);
      toast({
        title: 'Error checking auth status',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create a test cookie
  const createTestCookie = () => {
    try {
      // Build cookie string
      let cookieStr = `${cookieName}=${cookieValue}; path=/`;
      
      // Add attributes based on settings
      if (isSecure) cookieStr += '; Secure';
      if (sameSite) cookieStr += `; SameSite=${sameSite}`;
      
      // Set cookie
      document.cookie = cookieStr;
      
      // Note: we can't directly set HttpOnly cookies from JS, 
      // so we'll make a server request for that case
      if (isHttpOnly) {
        fetch(`/api/test-cookie?name=${cookieName}&value=${cookieValue}&httpOnly=${isHttpOnly}`, {
          credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
          toast({
            title: 'HttpOnly cookie created on server',
            description: `Cookie "${cookieName}" created via server request`,
          });
          loadCookies();
        })
        .catch(err => {
          console.error('Error setting HttpOnly cookie:', err);
          toast({
            title: 'Error setting HttpOnly cookie',
            description: err instanceof Error ? err.message : 'Server request failed',
            variant: 'destructive'
          });
        });
      } else {
        toast({
          title: 'Cookie created',
          description: `Cookie "${cookieName}=${cookieValue}" created with ${isSecure ? 'Secure' : ''} ${sameSite ? `SameSite=${sameSite}` : ''}`,
        });
        loadCookies();
      }
    } catch (error) {
      console.error('Error creating cookie:', error);
      toast({
        title: 'Error creating cookie',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  // Set manual token in localStorage and cookies
  const setManualAuthToken = () => {
    try {
      if (!manualToken) {
        toast({
          title: 'No token provided',
          description: 'Please enter a token value',
          variant: 'destructive'
        });
        return;
      }
      
      // Store in localStorage
      localStorage.setItem('auth_token', manualToken);
      
      // Try to set as a cookie too (won't work for HttpOnly)
      document.cookie = `auth_token=${manualToken}; path=/; SameSite=None; Secure`;
      
      toast({
        title: 'Token set',
        description: 'Auth token has been set in localStorage and as a cookie',
      });
      
      loadCookies();
    } catch (error) {
      console.error('Error setting token:', error);
      toast({
        title: 'Error setting token',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  // Clear a specific cookie
  const clearCookie = (name: string) => {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    toast({
      title: 'Cookie cleared',
      description: `Cookie "${name}" has been removed`,
    });
    loadCookies();
  };

  // Clear all cookies for this domain
  const clearAllCookies = () => {
    Object.keys(cookies).forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
    toast({
      title: 'All cookies cleared',
      description: 'All accessible cookies have been removed',
    });
    loadCookies();
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Auth & Cookie Debugger</CardTitle>
        <CardDescription>
          Diagnose and debug authentication and cookie issues
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current cookies section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Current Cookies</h3>
            <div className="bg-gray-50 p-3 rounded-md">
              {Object.keys(cookies).length === 0 ? (
                <p className="text-gray-500 italic">No cookies found for this domain</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(cookies).map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between">
                      <div>
                        <Badge variant={name === 'auth_token' ? 'default' : 'outline'} className="mr-2">
                          {name}
                        </Badge>
                        <span className="text-xs text-gray-500 truncate max-w-[200px]">
                          {value.length > 20 ? `${value.substring(0, 20)}...` : value}
                        </span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => clearCookie(name)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2">
              <Button size="sm" variant="outline" onClick={loadCookies}>
                Refresh
              </Button>
              <Button size="sm" variant="destructive" onClick={clearAllCookies}>
                Clear All Cookies
              </Button>
            </div>
          </div>
          
          {/* Auth status section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Authentication Status</h3>
            <Button
              onClick={checkAuthStatus}
              disabled={isLoading}
              className="w-full mb-3"
            >
              {isLoading ? 'Checking...' : 'Check Auth Status'}
            </Button>
            
            {authStatus && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Status:</div>
                  <div className={authStatus.authenticated ? 'text-green-600' : 'text-red-600'}>
                    {authStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
                  </div>
                  
                  <div className="font-medium">User:</div>
                  <div>
                    {authStatus.user ? (
                      <span>
                        {authStatus.user.username} (ID: {authStatus.user.id})
                        {authStatus.user.isAdmin && (
                          <Badge className="ml-1" variant="secondary">Admin</Badge>
                        )}
                      </span>
                    ) : 'None'}
                  </div>
                  
                  {authStatus.debug && (
                    <>
                      <div className="font-medium">Auth Cookie:</div>
                      <div>{authStatus.debug.hasAuthCookie ? 'Present' : 'Missing'}</div>
                      
                      <div className="font-medium">Auth Header:</div>
                      <div>{authStatus.debug.hasAuthHeader ? 'Present' : 'Missing'}</div>
                      
                      <div className="font-medium">Cookie Count:</div>
                      <div>{authStatus.debug.cookieKeys?.length || 0}</div>
                      
                      <div className="font-medium">Origin/Host:</div>
                      <div className="truncate">
                        {authStatus.debug.origin}/{authStatus.debug.host}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Create test cookie section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Create Test Cookie</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cookie-name">Cookie Name</Label>
                  <Input
                    id="cookie-name"
                    value={cookieName}
                    onChange={e => setCookieName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cookie-value">Cookie Value</Label>
                  <Input
                    id="cookie-value"
                    value={cookieValue}
                    onChange={e => setCookieValue(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="secure" 
                    checked={isSecure}
                    onCheckedChange={(checked) => setIsSecure(!!checked)}
                  />
                  <Label htmlFor="secure">Secure</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="httpOnly" 
                    checked={isHttpOnly}
                    onCheckedChange={(checked) => setIsHttpOnly(!!checked)}
                  />
                  <Label htmlFor="httpOnly">HttpOnly</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor="sameSite">SameSite:</Label>
                  <select
                    id="sameSite"
                    value={sameSite}
                    onChange={e => setSameSite(e.target.value as any)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="strict">Strict</option>
                    <option value="lax">Lax</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              
              <Button onClick={createTestCookie} className="w-full">
                Create Cookie
              </Button>
            </div>
          </div>
          
          {/* Manual token section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Manual Auth Token</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="manual-token">JWT Token</Label>
                <Input
                  id="manual-token"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="Paste a JWT token here"
                />
              </div>
              
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setManualToken(localStorage.getItem('auth_token') || '')}
                >
                  Load Current
                </Button>
                <Button 
                  variant="default" 
                  onClick={setManualAuthToken}
                >
                  Save Token
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}