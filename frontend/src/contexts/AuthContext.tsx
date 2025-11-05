import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface User {
  userId: string;
  username: string;
  email: string;
  role: 'user' | 'manager' | 'admin' | 'superadmin';
  firstName: string;
  lastName: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, passcode: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  // Refresh authentication state
  const refreshAuth = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!accessToken && !refreshToken) {
        setIsLoading(false);
        return;
      }

      // Try to get current user with access token
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsLoading(false);
        return;
      }

      // If access token expired, try to refresh
      if (response.status === 401 && refreshToken) {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          localStorage.setItem('accessToken', refreshData.accessToken);

          // Try again with new token
          const retryResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${refreshData.accessToken}`,
            },
          });

          if (retryResponse.ok) {
            const userData = await retryResponse.json();
            setUser(userData.user);
            setIsLoading(false);
            return;
          }
        }
      }

      // If all fails, clear tokens and set loading to false
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsLoading(false);
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setUser(null);
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (username: string, passcode: string, rememberMe = false) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, passcode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();

      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      if (rememberMe) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      // Set user
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');

      if (accessToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens and user regardless of API call success
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
