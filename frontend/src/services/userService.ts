// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface User {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'superadmin' | 'admin' | 'manager' | 'employee';
  status: 'active' | 'inactive' | 'suspended';
  phone?: string;
  permissions: string[];
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'superadmin' | 'admin' | 'manager' | 'employee';
  phone?: string;
  permissions?: string[];
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'superadmin' | 'admin' | 'manager' | 'employee';
  status?: 'active' | 'inactive' | 'suspended';
  phone?: string;
  permissions?: string[];
}

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Fetch all users (admin/superadmin only)
 */
export const fetchUsers = async (): Promise<User[]> => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/employees`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    return data.employees || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Create a new user (admin/superadmin only)
 */
export const createUser = async (userData: CreateUserData): Promise<User> => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to create user: ${response.status}`);
    }

    const data = await response.json();
    return data.employee;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update an existing user (admin/superadmin only)
 */
export const updateUser = async (userId: string, userData: UpdateUserData): Promise<User> => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/employees/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to update user: ${response.status}`);
    }

    const data = await response.json();
    return data.employee;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Delete a user (admin/superadmin only)
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/employees/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to delete user: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Change own password
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

/**
 * Reset user password (admin/superadmin only)
 */
export const resetPassword = async (userId: string, newPassword: string): Promise<void> => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
};
