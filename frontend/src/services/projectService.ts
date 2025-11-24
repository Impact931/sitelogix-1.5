// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface Project {
  id?: string;  // For component compatibility
  projectId?: string;
  projectName: string;
  projectCode: string;
  description: string;
  location: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  projectType: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
  startDate: string;
  estimatedEndDate: string;
  targetCompletionPercentage: number;
  budget: {
    total: number;
    labor: number;
    materials: number;
    equipment: number;
  };
  kpiTargets: {
    healthScore: number;
    qualityScore: number;
    scheduleScore: number;
    maxOvertimePercent: number;
    vendorOnTimeRate: number;
  };
  assignedManagers: { managerId: string; name: string; role: string; }[];
  milestones: { id: string; name: string; targetDate: string; deliverables: string; status: string; }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Personnel {
  id: string;
  name: string;
  role: string;
  status: string;
}

/**
 * Fetch all projects
 */
export const fetchProjects = async (): Promise<Project[]> => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/projects/admin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const data = await response.json();
    return data.projects || [];
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

/**
 * Create a new project
 */
export const createProject = async (project: Project): Promise<Project> => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/projects/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(project),
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.status}`);
    }

    const data = await response.json();
    return data.project;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

/**
 * Update an existing project
 */
export const updateProject = async (projectId: string, project: Project): Promise<Project> => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/projects/admin/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(project),
    });

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.status}`);
    }

    const data = await response.json();
    return data.project;
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/projects/admin/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
};

/**
 * Fetch all personnel (users) for assignment to projects
 */
export const fetchPersonnel = async (): Promise<Personnel[]> => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/employees`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch personnel: ${response.status}`);
    }

    const data = await response.json();
    // Map employee data to personnel format
    const employees = data.employees || [];
    return employees.map((emp: any) => ({
      id: emp.userId,
      name: `${emp.firstName} ${emp.lastName}`,
      role: emp.role,
      status: emp.status
    }));
  } catch (error) {
    console.error('Error fetching personnel:', error);
    throw error;
  }
};
