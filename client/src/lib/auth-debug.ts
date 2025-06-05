// Helper utilities for debugging authentication issues

/**
 * Detect if third-party cookies are blocked in the browser
 * Returns true if they appear to be blocked
 */
export async function detectThirdPartyCookieBlocking(): Promise<boolean> {
  try {
    // Try to set a cookie directly
    const testValue = "test-" + Date.now();
    document.cookie = `direct_test=${testValue};path=/;max-age=60`;
    
    // Check if the cookie was set
    const directCookieWorks = document.cookie.includes("direct_test");
    console.log("Direct cookie setting works:", directCookieWorks);
    
    if (!directCookieWorks) {
      console.log("Warning: Unable to set cookies directly. Browser may be blocking all cookies.");
      return true; // All cookies are blocked
    }
    
    // Test third-party cookie blocking
    try {
      // Create an iframe to test third-party cookies
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      // Try to access cookies from iframe
      try {
        iframe.contentWindow?.document.cookie;
        document.body.removeChild(iframe);
        return false; // Third-party cookies allowed
      } catch (e) {
        console.log("Third-party cookies appear to be blocked:", e);
        document.body.removeChild(iframe);
        return true; // Third-party cookies blocked
      }
    } catch (e) {
      console.error("Error testing third-party cookies:", e);
      return false; // Unable to determine, assume they're allowed
    }
  } catch (e) {
    console.error("Error in cookie blocking detection:", e);
    return false; // Unable to determine, assume they're allowed
  }
}

/**
 * Get browser details for debugging
 */
export function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    language: navigator.language,
    vendor: navigator.vendor,
    host: window.location.host,
    protocol: window.location.protocol,
    hasServiceWorker: 'serviceWorker' in navigator
  };
}

/**
 * Check and log the current authentication status
 * Useful for debugging authentication issues
 */
export async function checkAuthStatus() {
  console.log("Checking authentication status...");
  
  // Get browser info
  const browserInfo = getBrowserInfo();
  console.log("Browser info:", browserInfo);
  
  // Check for third-party cookie blocking
  const thirdPartyCookiesBlocked = await detectThirdPartyCookieBlocking();
  console.log("Third-party cookies blocked:", thirdPartyCookiesBlocked);
  
  // Check cookies first
  const cookies = document.cookie;
  console.log("Current cookies:", cookies);
  const hasAuthCookie = cookies.includes("auth_token");
  console.log("Has auth_token cookie:", hasAuthCookie);
  
  // Now check the /api/user endpoint
  try {
    console.log("Making API request to /api/user to check authentication...");
    const res = await fetch("/api/user", {
      credentials: "include", // Important for sending cookies
      cache: "no-cache" // Prevent caching issues
    });
    
    console.log("Auth status response:", res.status, res.statusText);
    
    // Get response headers for debugging
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log("Response headers:", headers);
    
    if (res.status === 401) {
      console.log("User is not authenticated according to the server");
      let responseText = "";
      try {
        responseText = await res.text();
        console.log("Response text:", responseText);
      } catch (e) {
        console.error("Error reading response text:", e);
      }
      
      return { 
        authenticated: false, 
        status: res.status, 
        cookies: { raw: cookies, hasAuthCookie },
        browserInfo,
        thirdPartyCookiesBlocked,
        responseText
      };
    }
    
    if (!res.ok) {
      console.log("Error checking auth status:", res.status, res.statusText);
      return { 
        authenticated: false, 
        status: res.status, 
        error: res.statusText, 
        cookies: { raw: cookies, hasAuthCookie },
        browserInfo,
        thirdPartyCookiesBlocked
      };
    }
    
    const userData = await res.json();
    console.log("User is authenticated:", userData);
    return { 
      authenticated: true, 
      user: userData,
      cookies: { raw: cookies, hasAuthCookie },
      browserInfo,
      thirdPartyCookiesBlocked
    };
  } catch (error) {
    console.error("Error checking authentication status:", error);
    return { 
      authenticated: false, 
      error: error instanceof Error ? error.message : String(error),
      cookies: { raw: cookies, hasAuthCookie },
      browserInfo,
      thirdPartyCookiesBlocked
    };
  }
}

/**
 * Attempt a manual login using the API
 * Bypasses React Query to test the raw API
 */
export async function testManualLogin(username: string, password: string) {
  console.log("Testing manual login for:", username);
  
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password }),
      credentials: "include" // Important for receiving cookies
    });
    
    console.log("Login response:", res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Login failed:", errorText);
      return { success: false, status: res.status, error: errorText };
    }
    
    const userData = await res.json();
    console.log("Login successful:", userData);
    
    // Check cookies after login
    console.log("Cookies after login:", document.cookie);
    
    return { success: true, user: userData };
  } catch (error) {
    console.error("Error during manual login:", error);
    return { success: false, error };
  }
}

/**
 * Creates a test user with the provided credentials
 */
export async function createTestUser(credentials: {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
}) {
  console.log("Creating test user:", credentials.username);
  
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(credentials),
      credentials: "include" // Important for receiving cookies
    });
    
    console.log("Registration response:", res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Registration failed:", errorText);
      return { success: false, status: res.status, error: errorText };
    }
    
    const userData = await res.json();
    console.log("Registration successful:", userData);
    
    // Check cookies after registration
    console.log("Cookies after registration:", document.cookie);
    
    return { success: true, user: userData };
  } catch (error) {
    console.error("Error during registration:", error);
    return { success: false, error };
  }
}