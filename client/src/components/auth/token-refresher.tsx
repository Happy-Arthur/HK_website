import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/queryClient';

/**
 * TokenRefresher Component
 * 
 * This component is responsible for:
 * 1. Authenticating with the stored token from localStorage if cookies are not working correctly
 * 2. Handling refresh tokens for admin status changes
 * 
 * Add this component to your app layout to ensure authentication works
 * even if cookie-based auth fails.
 */
export function TokenRefresher() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Check if we have an admin refresh token - this takes precedence
    const adminRefreshToken = localStorage.getItem('admin_refresh_token');
    
    if (adminRefreshToken) {
      console.log('TokenRefresher: Found admin refresh token - updating auth state');
      
      // Replace the main auth token with the refresh token
      localStorage.setItem('auth_token', adminRefreshToken);
      
      // Clear the admin refresh token since we've used it
      localStorage.removeItem('admin_refresh_token');
      
      // Force a reload to update auth state with the new token
      window.location.reload();
      return;
    }
    
    // Regular token handling
    const token = localStorage.getItem('auth_token');
    
    if (!isLoading && !user && token) {
      console.log('TokenRefresher: Found token in localStorage but no authenticated user');
      
      // Make a manual request to /api/auth-status to check if token is valid
      const checkAuth = async () => {
        try {
          const res = await fetch('/api/auth-status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log('TokenRefresher: Auth status check result:', data.authenticated);
            
            if (!data.authenticated) {
              console.log('TokenRefresher: Token is invalid, removing from localStorage');
              localStorage.removeItem('auth_token');
            } else {
              console.log('TokenRefresher: Token is valid, authentication should work with future requests');
              
              // If the user data is available, update the query cache
              if (data.user) {
                queryClient.setQueryData(['/api/user'], data.user);
                console.log('TokenRefresher: Updated user data in query cache');
              }
            }
          }
        } catch (error) {
          console.error('TokenRefresher: Error checking auth status:', error);
        }
      };
      
      checkAuth();
    }
  }, [user, isLoading]);

  // This is a utility component, it doesn't render anything
  return null;
}

export default TokenRefresher;