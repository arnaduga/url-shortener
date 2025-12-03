import { useState, useEffect, useCallback } from 'react';
import { GOOGLE_CLIENT_ID, TOKEN_EXPIRY_HOURS, INACTIVITY_TIMEOUT_MINUTES, API_ENDPOINT } from '../config';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Verify user authorization with backend
  const verifyAuthorization = useCallback(async (token, user) => {
    try {
      // Make a test POST call with invalid data to verify authorization
      // The backend will check auth before validating the body
      const response = await fetch(`${API_ENDPOINT}/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          long_url: 'https://example.com',
          human_readable: false,
          ttl: 1
        }),
      });

      // If user is not authorized, backend will return 401/403
      // If authorized, it will return 200 (success) or 400 (validation error)
      // Both mean the user IS authorized to make requests
      if (response.status === 401 || response.status === 403) {
        throw new Error('NOT_AUTHORIZED');
      }

      return true;
    } catch (error) {
      if (error.message === 'NOT_AUTHORIZED') {
        throw error;
      }
      // Network errors should not block authorization
      // If we can't reach the server, assume authorized (session will fail on real request)
      return true;
    }
  }, []);

  // Handle Google callback
  const handleGoogleCallback = useCallback(async (response) => {
    const token = response.credential;

    // Decode JWT to get user info
    const payload = JSON.parse(atob(token.split('.')[1]));
    const user = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture
    };

    try {
      // Verify user is authorized
      await verifyAuthorization(token, user);

      // Store session
      const sessionData = {
        token: token,
        user: user,
        expiresAt: Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
      };
      sessionStorage.setItem('adminSession', JSON.stringify(sessionData));

      setAuthToken(token);
      setCurrentUser(user);
      setAuthError(null);
    } catch (error) {
      // User is not authorized
      setAuthError({
        email: user.email,
        name: user.name,
      });
      sessionStorage.removeItem('adminSession');
      setAuthToken(null);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [verifyAuthorization]);

  // Trigger Google Sign-In
  const signIn = useCallback(() => {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: window.location.origin + '/',
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: Math.random().toString(36).substring(2),
      prompt: 'select_account'
    });

    window.location.href = authUrl;
  }, []);

  // Check existing session
  const checkExistingSession = useCallback(async () => {
    const sessionData = sessionStorage.getItem('adminSession');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (session.expiresAt > Date.now()) {
        try {
          // Re-verify authorization on page load
          await verifyAuthorization(session.token, session.user);
          setAuthToken(session.token);
          setCurrentUser(session.user);
          setAuthError(null);
        } catch (error) {
          // Session exists but user is no longer authorized
          sessionStorage.removeItem('adminSession');
          setAuthError({
            email: session.user.email,
            name: session.user.name,
          });
        } finally {
          setIsLoading(false);
          return true;
        }
      }
    }

    // Check URL for token from OAuth redirect
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const idToken = urlParams.get('id_token');
    if (idToken) {
      await handleGoogleCallback({ credential: idToken });
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    setIsLoading(false);
    return false;
  }, [verifyAuthorization, handleGoogleCallback]);

  // Sign out
  const signOut = useCallback(() => {
    sessionStorage.removeItem('adminSession');
    setAuthToken(null);
    setCurrentUser(null);
    setAuthError(null);
  }, []);

  // Session management
  useEffect(() => {
    if (!currentUser) return;

    let sessionExpiryTimer = setTimeout(() => {
      alert("Your session has expired. Please sign in again.");
      signOut();
    }, TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

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
      clearTimeout(sessionExpiryTimer);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [currentUser, signOut]);

  // Check session on mount
  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  return {
    currentUser,
    authToken,
    isLoading,
    authError,
    signIn,
    signOut,
  };
};
