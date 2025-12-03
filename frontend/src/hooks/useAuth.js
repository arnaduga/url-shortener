import { useState, useEffect, useCallback } from 'react';
import { GOOGLE_CLIENT_ID, INACTIVITY_TIMEOUT_MINUTES, API_ENDPOINT } from '../config';

/**
 * Google Identity Services Authentication Hook
 *
 * Modern approach (2024+) using Google's new Identity Services SDK
 * - No redirects, no code exchange, no PKCE complexity
 * - Google handles everything in a popup/One Tap
 * - Directly receives ID token in callback
 * - Much simpler and better UX
 */
export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  /**
   * Decode JWT token to extract user info
   */
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  };

  /**
   * Verify user is authorized by making a test API call
   */
  const verifyAuthorization = async (token, userInfo) => {
    try {
      // Make a lightweight API call to verify authorization
      // We'll try to get stats for a non-existent short_id
      // The authorizer will check if user is in the auth table
      const response = await fetch(`${API_ENDPOINT}/stats/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 401/403 means user is not authorized
      if (response.status === 401 || response.status === 403) {
        throw new Error('UNAUTHORIZED');
      }

      // 404 is expected (test short_id doesn't exist), but it means authorizer passed
      // Any other error is also fine - we just want to know if the authorizer allows this user
      return true;
    } catch (error) {
      if (error.message === 'UNAUTHORIZED') {
        throw error;
      }
      // Network errors or other issues - assume authorized for now
      console.warn('Authorization check failed with unexpected error:', error);
      return true;
    }
  };

  /**
   * Handle successful Google sign-in
   */
  const handleCredentialResponse = useCallback(async (response) => {
    let userInfo = null;

    try {
      // Set loading state immediately
      setIsLoading(true);
      setAuthError(null);

      const googleIdToken = response.credential;

      // Decode token to get user info
      userInfo = decodeJWT(googleIdToken);
      if (!userInfo) {
        throw new Error('Failed to decode ID token');
      }

      console.log('Google sign-in successful:', userInfo.email);
      console.log('Verifying authorization...');

      // Verify user is authorized before setting state
      await verifyAuthorization(googleIdToken, userInfo);

      console.log('Authorization verified successfully');

      // Store token in localStorage
      localStorage.setItem('google_id_token', googleIdToken);
      setIdToken(googleIdToken);

      // Set user info
      setCurrentUser({
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      });
      setAuthError(null);
      setIsLoading(false);
    } catch (error) {
      console.error('Authentication error:', error);

      // Handle authorization errors differently
      if (error.message === 'UNAUTHORIZED') {
        console.log('User not authorized:', userInfo?.email);
        setAuthError({
          message: 'You are not authorized to access this application.',
          email: userInfo?.email,
          name: userInfo?.name,
        });
      } else {
        setAuthError({ message: error.message });
      }

      setCurrentUser(null);
      setIdToken(null);
      localStorage.removeItem('google_id_token');
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize Google Identity Services
   */
  useEffect(() => {
    const initGoogle = () => {
      if (!window.google || !window.google.accounts) {
        // Google SDK not loaded yet, retry
        setTimeout(initGoogle, 100);
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        setIsGoogleReady(true);
        console.log('Google Identity Services initialized');
      } catch (error) {
        console.error('Failed to initialize Google Identity Services:', error);
      }
    };

    initGoogle();
  }, [handleCredentialResponse]);

  /**
   * Check for existing token on page load
   */
  const checkExistingSession = useCallback(() => {
    try {
      const storedToken = localStorage.getItem('google_id_token');
      if (!storedToken) {
        setIsLoading(false);
        return false;
      }

      // Decode and check if token is expired
      const userInfo = decodeJWT(storedToken);
      if (!userInfo) {
        localStorage.removeItem('google_id_token');
        setIsLoading(false);
        return false;
      }

      // Check token expiration (exp is in seconds)
      const now = Math.floor(Date.now() / 1000);
      if (userInfo.exp && userInfo.exp < now) {
        console.log('Token expired');
        localStorage.removeItem('google_id_token');
        setIsLoading(false);
        return false;
      }

      // Token is valid
      setIdToken(storedToken);
      setCurrentUser({
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      });
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Session check error:', error);
      localStorage.removeItem('google_id_token');
      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Initiate sign in (not needed - button handles it)
   * Kept for compatibility with App.jsx
   */
  const signIn = useCallback(() => {
    // The Google button handles sign-in automatically
    // This function is kept for backwards compatibility
    console.log('Sign in initiated via Google button');
  }, []);

  /**
   * Sign out (clear local storage)
   * Note: We don't call google.accounts.id.revoke() because it fails with 403
   * due to origin restrictions. The local logout is sufficient for security.
   */
  const signOut = useCallback(() => {
    // Clear local state
    localStorage.removeItem('google_id_token');
    setCurrentUser(null);
    setAuthError(null);
    setIdToken(null);

    console.log('Signed out successfully');
  }, []);

  /**
   * Inactivity timeout
   */
  useEffect(() => {
    if (!currentUser) return;

    let inactivityTimer;

    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }

      inactivityTimer = setTimeout(() => {
        alert("You've been signed out due to inactivity.");
        signOut();
      }, INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    };

    resetInactivityTimer();

    const events = ['mousemove', 'keypress', 'click', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [currentUser, signOut]);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  return {
    currentUser,
    isLoading,
    authError,
    signIn,
    signOut,
    idToken, // Export token for API calls
  };
};
