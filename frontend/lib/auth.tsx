'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, artistApi, Artist, User } from './api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  artist: Artist | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshArtist: () => Promise<void>;
  createArtistProfile: (stageName: string, bio?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);

  // Check for existing session on mount using HttpOnly cookie
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to get current user - will fail if no valid cookie
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);
        
        // Try to fetch artist profile
        try {
          const artistProfile = await artistApi.getMyProfile();
          setArtist(artistProfile);
        } catch {
          // Artist profile might not exist yet
        }
      } catch {
        // No valid session
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    await authApi.login(email, password, rememberMe);
    // Cookie is now set by the backend
    
    // Fetch user info
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
    setIsAuthenticated(true);
    
    // Try to fetch artist profile
    try {
      const artistProfile = await artistApi.getMyProfile();
      setArtist(artistProfile);
    } catch {
      // Artist profile doesn't exist yet
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const newUser = await authApi.signup(email, password);
    setUser(newUser);
    // Auto-login after signup
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setIsAuthenticated(false);
    setUser(null);
    setArtist(null);
  }, []);

  const refreshArtist = useCallback(async () => {
    try {
      const artistProfile = await artistApi.getMyProfile();
      setArtist(artistProfile);
    } catch {
      setArtist(null);
    }
  }, []);

  const createArtistProfile = useCallback(async (stageName: string, bio?: string) => {
    const newArtist = await artistApi.createProfile({ stage_name: stageName, bio });
    setArtist(newArtist);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        artist,
        login,
        signup,
        logout,
        refreshArtist,
        createArtistProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for requiring authentication
export function useRequireAuth() {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      window.location.href = '/login';
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}

// Hook for requiring admin role
export function useRequireAdmin() {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isAuthenticated) {
        window.location.href = '/login';
      } else if (auth.user?.role !== 'admin') {
        // Redirect non-admins to dashboard
        window.location.href = '/';
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user?.role]);

  return {
    ...auth,
    isAdmin: auth.user?.role === 'admin',
  };
}
