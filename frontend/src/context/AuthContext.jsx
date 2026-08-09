import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const API_AUTH_URL = `${API_BASE_URL}/auth`;
const API_PREFERENCES_URL = `${API_BASE_URL}/preferences`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // Default true until checked
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // 1. Silent Refresh Access Token from HttpOnly cookie
  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await fetch(`${API_AUTH_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Refresh token invalid or expired');
      }

      const data = await response.json();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch (err) {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // 2. Check Onboarding Preferences Status
  const checkOnboardingStatus = useCallback(async (token) => {
    try {
      const response = await fetch(API_PREFERENCES_URL, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHasCompletedOnboarding(!!data.hasCompletedOnboarding);
      }
    } catch (err) {
      console.error('[Onboarding Check Error]', err);
    }
  }, []);

  // 3. Restore User Profile using Access Token
  const fetchUserProfile = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_AUTH_URL}/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        await checkOnboardingStatus(token);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[Auth Restore Error]', err);
      setUser(null);
    }
  }, [checkOnboardingStatus]);

  // 4. Initial Session Restoration on App Mount
  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      try {
        const token = await refreshAccessToken();
        if (token && isMounted) {
          await fetchUserProfile(token);
        }
      } catch (err) {
        console.warn('[Auth Initialization] No active session found.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    initAuth();
    return () => { isMounted = false; };
  }, [refreshAccessToken, fetchUserProfile]);

  // 5. Login Function
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const response = await fetch(`${API_AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.message || 'Login failed.');
        return false;
      }

      setAccessToken(data.accessToken);
      setUser(data.user);
      await checkOnboardingStatus(data.accessToken);
      return true;
    } catch (err) {
      setAuthError('Network or server error. Please try again.');
      return false;
    }
  };

  // 6. Signup Function
  const signup = async (username, email, password) => {
    setAuthError(null);
    try {
      const response = await fetch(`${API_AUTH_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.message || 'Signup failed.');
        return false;
      }

      setAccessToken(data.accessToken);
      setUser(data.user);
      setHasCompletedOnboarding(false); // Newly signed up user needs onboarding
      return true;
    } catch (err) {
      setAuthError('Network or server error. Please try again.');
      return false;
    }
  };

  // 7. Logout Function
  const logout = async () => {
    try {
      await fetch(`${API_AUTH_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (err) {
      console.error('[Logout Error]', err);
    } finally {
      setAccessToken(null);
      setUser(null);
      setAuthError(null);
      setHasCompletedOnboarding(true);
    }
  };

  // 8. Authenticated Request Helper
  const fetchWithAuth = async (url, options = {}) => {
    let currentToken = accessToken;
    if (!currentToken) {
      currentToken = await refreshAccessToken();
    }

    if (!currentToken) {
      throw new Error('Authentication required. Please log in.');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${currentToken}`
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !options._isRetry) {
      console.log('[Auth Helper] Token expired (401). Retrying silent refresh...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders = { ...options.headers, 'Authorization': `Bearer ${newToken}` };
        response = await fetch(url, { ...options, headers: retryHeaders, _isRetry: true });
      } else {
        setUser(null);
        setAccessToken(null);
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  };

  const value = {
    user,
    accessToken,
    loading,
    authError,
    setAuthError,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    checkOnboardingStatus,
    login,
    signup,
    logout,
    refreshAccessToken,
    fetchWithAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
