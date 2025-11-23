import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { signIn, signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import '../amplify-config';

interface User {
  userId: string;
  username: string;
  email: string;
  role: 'employee' | 'foreman' | 'manager' | 'admin' | 'superadmin';
  firstName: string;
  lastName: string;
  permissions: string[];
  personId?: string; // Link to personnel data
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, passcode: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  requirePasswordChange?: boolean;
  tempUsername?: string;
  tempPassword?: string;
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

// Helper function to map Cognito groups to roles
function mapCognitoGroupToRole(groups?: string[]): 'employee' | 'foreman' | 'manager' | 'admin' | 'superadmin' {
  if (!groups || groups.length === 0) {
    return 'employee'; // Default role
  }

  // Convert groups to lowercase for case-insensitive matching
  const lowerGroups = groups.map(g => g.toLowerCase());

  // Priority order: superadmin > admin > manager > foreman > employee
  if (lowerGroups.includes('superadmin')) return 'superadmin';
  if (lowerGroups.includes('admin')) return 'admin';
  if (lowerGroups.includes('manager')) return 'manager';
  if (lowerGroups.includes('foreman')) return 'foreman';
  return 'employee';
}

// Helper function to extract permissions from Cognito groups
function extractPermissions(groups?: string[]): string[] {
  if (!groups || groups.length === 0) {
    return [];
  }

  // Define permissions based on groups
  const permissionMap: Record<string, string[]> = {
    superadmin: ['all'],
    admin: ['manage_users', 'manage_projects', 'view_reports', 'edit_reports', 'manage_payroll', 'manage_team'],
    manager: ['manage_projects', 'view_reports', 'edit_reports', 'manage_team'],
    foreman: ['create_reports', 'view_reports', 'manage_team'],
    employee: ['create_reports', 'view_reports'],
  };

  const role = mapCognitoGroupToRole(groups);
  return permissionMap[role] || [];
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [tempUsername, setTempUsername] = useState<string>();
  const [tempPassword, setTempPassword] = useState<string>();

  // Check if user is authenticated on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  // Refresh authentication state
  const refreshAuth = async () => {
    try {
      setIsLoading(true);

      // Check if user is authenticated
      const currentUser = await getCurrentUser();

      if (!currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Get user attributes and session
      const [attributes, session] = await Promise.all([
        fetchUserAttributes(),
        fetchAuthSession(),
      ]);

      // Store tokens in localStorage for API calls
      if (session.tokens?.accessToken && session.tokens?.idToken) {
        localStorage.setItem('accessToken', session.tokens.accessToken.toString());
        localStorage.setItem('idToken', session.tokens.idToken.toString());
        console.log('✅ Stored tokens in localStorage');
      }

      // Extract groups from ID token
      const idToken = session.tokens?.idToken;
      const groups = idToken?.payload['cognito:groups'] as string[] | undefined;

      // Map Cognito user to our User interface
      const userData: User = {
        userId: currentUser.userId,
        username: currentUser.username,
        email: attributes.email || '',
        firstName: attributes.given_name || attributes.name?.split(' ')[0] || '',
        lastName: attributes.family_name || attributes.name?.split(' ')[1] || '',
        role: mapCognitoGroupToRole(groups),
        permissions: extractPermissions(groups),
        personId: attributes['custom:personId'], // Extract custom attribute
      };

      setUser(userData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error refreshing auth:', error);
      setUser(null);
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (username: string, passcode: string) => {
    try {
      setIsLoading(true);

      const signInResult = await signIn({
        username,
        password: passcode,
      });

      console.log('Sign in result:', signInResult);

      // Check if user needs to change password (first login)
      if (signInResult.isSignedIn === false && signInResult.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setRequirePasswordChange(true);
        setTempUsername(username);
        setTempPassword(passcode);
        setIsLoading(false);
        throw new Error('NEW_PASSWORD_REQUIRED');
      }

      // If sign in successful, get user data
      if (signInResult.isSignedIn) {
        await refreshAuth();
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoading(false);

      // Map Cognito errors to user-friendly messages
      if (error.message === 'NEW_PASSWORD_REQUIRED') {
        throw error;
      }

      if (error.name === 'NotAuthorizedException') {
        throw new Error('Incorrect username or password');
      }

      if (error.name === 'UserNotFoundException') {
        throw new Error('User not found');
      }

      if (error.name === 'UserNotConfirmedException') {
        throw new Error('User account not confirmed');
      }

      if (error.name === 'PasswordResetRequiredException') {
        throw new Error('Password reset required. Please contact your administrator.');
      }

      if (error.name === 'TooManyRequestsException') {
        throw new Error('Too many login attempts. Please try again later.');
      }

      throw new Error(error.message || 'Login failed');
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear user state regardless of API call success
      setUser(null);
      setRequirePasswordChange(false);
      setTempUsername(undefined);
      setTempPassword(undefined);

      // Clear tokens from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      console.log('🔓 Cleared tokens from localStorage');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshAuth,
    requirePasswordChange,
    tempUsername,
    tempPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
