# Frontend Authentication & Route Protection

## Overview
This document provides implementation details for authentication and authorization in the React TypeScript frontend.

---

## Architecture

```
User Login
    ↓
Auth Context (Global State)
    ↓
Protected Routes (Route Guards)
    ↓
API Client (Token Management)
    ↓
UI Components (Permission Gates)
```

---

## Auth Context

### Purpose
Centralized authentication state management using React Context.

### Implementation

```typescript
// frontend/src/contexts/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Permission } from '../types/permissions';

interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'USER';
  name: string;
  permissions: Permission[];
  assignedProjects: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (role: string) => boolean;
  canAccessProject: (projectId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const authData = localStorage.getItem('sitelogix_auth');

        if (authData) {
          const { user, expiresAt } = JSON.parse(authData);

          // Check if token is expired
          if (Date.now() < expiresAt) {
            setUser(user);
          } else {
            // Try to refresh token
            await refreshAuth();
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        localStorage.removeItem('sitelogix_auth');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const { user, expiresAt } = await response.json();

      // Store user info (tokens are in httpOnly cookies)
      localStorage.setItem('sitelogix_auth', JSON.stringify({
        user,
        expiresAt,
      }));

      setUser(user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local state regardless of API call success
      localStorage.removeItem('sitelogix_auth');
      setUser(null);
    }
  };

  const refreshAuth = async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { user, expiresAt } = await response.json();

      localStorage.setItem('sitelogix_auth', JSON.stringify({
        user,
        expiresAt,
      }));

      setUser(user);
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('sitelogix_auth');
      setUser(null);
      throw error;
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(perm => hasPermission(perm));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(perm => hasPermission(perm));
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const canAccessProject = (projectId: string): boolean => {
    // Super admins can access all projects
    if (user?.role === 'SUPER_ADMIN') return true;

    // Check if project is in assigned projects
    return user?.assignedProjects?.includes(projectId) || false;
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAuth,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccessProject,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
```

---

## Protected Routes

### Purpose
Prevent unauthorized access to routes based on authentication and permissions.

### Implementation

```typescript
// frontend/src/components/ProtectedRoute.tsx

import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Permission } from '../types/permissions';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: Permission[];
  requiredRole?: string;
  requireAll?: boolean; // true = all permissions, false = any permission
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  requiredRole,
  requireAll = true,
  redirectTo = '/login',
}) => {
  const {
    isAuthenticated,
    isLoading,
    hasAllPermissions,
    hasAnyPermission,
    hasRole,
  } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role if required
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check permissions if required
  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
```

### Usage in Routes

```typescript
// frontend/src/App.tsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Permission } from './types/permissions';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VoiceReporting from './pages/VoiceReporting';
import ReportsList from './pages/ReportsList';
import Analytics from './pages/Analytics';
import AdminPanel from './pages/AdminPanel';
import UserManagement from './pages/UserManagement';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected routes - authenticated users */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/voice-reporting"
            element={
              <ProtectedRoute
                requiredPermissions={[Permission.REPORT_CREATE]}
              >
                <VoiceReporting />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute
                requiredPermissions={[Permission.REPORT_READ_ASSIGNED]}
              >
                <ReportsList />
              </ProtectedRoute>
            }
          />

          {/* Manager and Admin only */}
          <Route
            path="/analytics"
            element={
              <ProtectedRoute
                requiredPermissions={[
                  Permission.ANALYTICS_VIEW_SYSTEM,
                  Permission.ANALYTICS_VIEW_PROJECT,
                ]}
                requireAll={false} // Has either permission
              >
                <Analytics />
              </ProtectedRoute>
            }
          />

          {/* Admin only */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute
                requiredPermissions={[Permission.USER_CREATE, Permission.USER_UPDATE]}
              >
                <UserManagement />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

---

## API Client with Auto-Refresh

### Purpose
Centralized API client that handles token refresh automatically.

### Implementation

```typescript
// frontend/src/services/apiClient.ts

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make authenticated API request
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...options,
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    let response = await fetch(url, config);

    // If 401, try to refresh token and retry
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      await this.handleTokenRefresh();

      // Retry original request
      response = await fetch(url, config);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));

      throw new ApiError(response.status, error.message || 'Request failed');
    }

    // Handle no-content responses
    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';

    return this.request<T>(`${endpoint}${queryString}`, {
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Upload file
   */
  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const url = `${this.baseUrl}${endpoint}`;

    let response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    // Handle token refresh if needed
    if (response.status === 401) {
      await this.handleTokenRefresh();
      response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
    }

    if (!response.ok) {
      throw new ApiError(response.status, 'Upload failed');
    }

    return response.json();
  }

  /**
   * Handle token refresh with deduplication
   */
  private async handleTokenRefresh(): Promise<void> {
    // Prevent multiple simultaneous refresh requests
    if (this.isRefreshing) {
      return this.refreshPromise!;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          // Refresh failed - redirect to login
          localStorage.removeItem('sitelogix_auth');
          window.location.href = '/login';
          throw new Error('Token refresh failed');
        }

        const { user, expiresAt } = await response.json();

        // Update localStorage
        localStorage.setItem('sitelogix_auth', JSON.stringify({
          user,
          expiresAt,
        }));
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

/**
 * Custom API Error
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

---

## Permission Gates

### Purpose
Conditionally render UI components based on permissions.

### Implementation

```typescript
// frontend/src/components/PermissionGate.tsx

import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Permission } from '../types/permissions';

interface PermissionGateProps {
  children: ReactNode;
  requiredPermissions: Permission[];
  requireAll?: boolean; // true = all, false = any
  fallback?: ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  requiredPermissions,
  requireAll = true,
  fallback = null,
}) => {
  const { hasAllPermissions, hasAnyPermission } = useAuth();

  const hasAccess = requireAll
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

/**
 * Role-based gate
 */
interface RoleGateProps {
  children: ReactNode;
  allowedRoles: string[];
  fallback?: ReactNode;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  allowedRoles,
  fallback = null,
}) => {
  const { user } = useAuth();

  const hasAccess = user && allowedRoles.includes(user.role);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

/**
 * Project access gate
 */
interface ProjectGateProps {
  children: ReactNode;
  projectId: string;
  fallback?: ReactNode;
}

export const ProjectGate: React.FC<ProjectGateProps> = ({
  children,
  projectId,
  fallback = null,
}) => {
  const { canAccessProject } = useAuth();

  const hasAccess = canAccessProject(projectId);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};
```

### Usage Examples

```typescript
// Example 1: Hide button for users without permission
<PermissionGate requiredPermissions={[Permission.USER_CREATE]}>
  <button onClick={handleCreateUser}>Create User</button>
</PermissionGate>

// Example 2: Show alternative content
<PermissionGate
  requiredPermissions={[Permission.ANALYTICS_VIEW_SYSTEM]}
  fallback={<p>You don't have access to analytics</p>}
>
  <AnalyticsChart />
</PermissionGate>

// Example 3: Role-based rendering
<RoleGate allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
  <AdminTools />
</RoleGate>

// Example 4: Project-specific content
<ProjectGate projectId={project.id}>
  <ProjectDetails project={project} />
</ProjectGate>

// Example 5: Multiple permissions (any)
<PermissionGate
  requiredPermissions={[
    Permission.REPORT_UPDATE_OWN,
    Permission.REPORT_DELETE_OWN
  ]}
  requireAll={false}
>
  <ReportActions />
</PermissionGate>
```

---

## Login Component

### Implementation

```typescript
// frontend/src/pages/Login.tsx

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page user was trying to access
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);

      // Redirect to original destination or dashboard
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>SiteLogix</h1>
        <h2>Sign In</h2>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="login-button"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <a href="/forgot-password">Forgot password?</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
```

---

## Unauthorized Page

```typescript
// frontend/src/pages/Unauthorized.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <h1>403</h1>
        <h2>Access Denied</h2>
        <p>
          You don't have permission to access this page.
        </p>

        {user && (
          <div className="user-info">
            <p>Signed in as: <strong>{user.name}</strong></p>
            <p>Role: <strong>{user.role}</strong></p>
          </div>
        )}

        <div className="action-buttons">
          <button onClick={handleGoBack} className="btn-secondary">
            Go Back
          </button>
          <button onClick={handleGoHome} className="btn-primary">
            Go to Dashboard
          </button>
          <button onClick={handleLogout} className="btn-danger">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
```

---

## Session Management

### Auto-Refresh Token

```typescript
// frontend/src/hooks/useTokenRefresh.ts

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Automatically refresh token before expiration
 */
export const useTokenRefresh = () => {
  const { isAuthenticated, refreshAuth } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isAuthenticated) return;

    const scheduleRefresh = () => {
      const authData = localStorage.getItem('sitelogix_auth');

      if (!authData) return;

      const { expiresAt } = JSON.parse(authData);
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh 2 minutes before expiry
      const refreshTime = Math.max(0, timeUntilExpiry - 2 * 60 * 1000);

      timeoutRef.current = setTimeout(async () => {
        try {
          await refreshAuth();
          scheduleRefresh(); // Schedule next refresh
        } catch (error) {
          console.error('Auto-refresh failed:', error);
        }
      }, refreshTime);
    };

    scheduleRefresh();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated, refreshAuth]);
};

// Usage in App.tsx
function App() {
  useTokenRefresh();

  return (
    <BrowserRouter>
      {/* ... routes */}
    </BrowserRouter>
  );
}
```

### Activity Tracking

```typescript
// frontend/src/hooks/useActivityTracking.ts

import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Track user activity and auto-logout on inactivity
 */
export const useActivityTracking = () => {
  const { logout, isAuthenticated } = useAuth();
  let inactivityTimer: NodeJS.Timeout;

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;

    clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(() => {
      console.log('User inactive for 30 minutes, logging out');
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated, logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    resetTimer(); // Start timer

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      clearTimeout(inactivityTimer);
    };
  }, [isAuthenticated, resetTimer]);
};
```

---

## Permission Types

```typescript
// frontend/src/types/permissions.ts

export enum Permission {
  // User permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_ASSIGN_ROLE = 'user:assign_role',

  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ_ALL = 'project:read:all',
  PROJECT_READ_ASSIGNED = 'project:read:assigned',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',

  // Report permissions
  REPORT_CREATE = 'report:create',
  REPORT_READ_ALL = 'report:read:all',
  REPORT_READ_ASSIGNED = 'report:read:assigned',
  REPORT_UPDATE_OWN = 'report:update:own',
  REPORT_DELETE_OWN = 'report:delete:own',

  // Analytics permissions
  ANALYTICS_VIEW_SYSTEM = 'analytics:view:system',
  ANALYTICS_VIEW_PROJECT = 'analytics:view:project',
  ANALYTICS_EXPORT = 'analytics:export',

  // System permissions
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_LOGS = 'system:logs',
}
```

---

## Testing

### Unit Tests

```typescript
// __tests__/contexts/AuthContext.test.tsx

import { renderHook, act } from '@testing-library/react-hooks';
import { AuthProvider, useAuth } from '../AuthContext';

describe('AuthContext', () => {
  it('should initialize as unauthenticated', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeTruthy();
  });

  it('should check permissions correctly', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Mock user with permissions
    act(() => {
      result.current.user = {
        permissions: [Permission.REPORT_CREATE],
      };
    });

    expect(result.current.hasPermission(Permission.REPORT_CREATE)).toBe(true);
    expect(result.current.hasPermission(Permission.USER_DELETE)).toBe(false);
  });
});
```

---

## Security Best Practices

1. **Never store tokens in localStorage** - Use httpOnly cookies
2. **Validate on backend** - Frontend checks are for UX only
3. **Auto-refresh tokens** - Seamless user experience
4. **Track inactivity** - Auto-logout after timeout
5. **Clear sensitive data on logout** - Remove all auth state
6. **Handle errors gracefully** - Show user-friendly messages
7. **Use HTTPS only** - Secure cookie transmission

---

## Common Issues & Solutions

### Issue: Token not sent with requests
**Solution:** Ensure `credentials: 'include'` in fetch options

### Issue: Infinite refresh loops
**Solution:** Don't refresh on auth endpoints, check for existing refresh

### Issue: User logged out unexpectedly
**Solution:** Check token expiry, implement auto-refresh

### Issue: Permission check fails after refresh
**Solution:** Ensure user data updated in localStorage after refresh
