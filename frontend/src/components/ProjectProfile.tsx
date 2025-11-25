import { useState, useEffect } from 'react';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject as deleteProjectAPI,
  fetchPersonnel,
  type Personnel
} from '../services/projectService';

interface Project {
  id: string;
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
  assignedManagers: {
    managerId: string;
    name: string;
    role: string;
  }[];
  milestones: {
    id: string;
    name: string;
    targetDate: string;
    deliverables: string;
    status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  }[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectProfileProps {
  onBack?: () => void;
}

export default function ProjectProfile({ onBack }: ProjectProfileProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  const [newProject, setNewProject] = useState<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>({
    projectName: '',
    projectCode: '',
    description: '',
    location: {
      address: '',
      city: '',
      state: '',
      zip: ''
    },
    projectType: 'commercial',
    status: 'planning',
    startDate: '',
    estimatedEndDate: '',
    targetCompletionPercentage: 100,
    budget: {
      total: 0,
      labor: 0,
      materials: 0,
      equipment: 0
    },
    kpiTargets: {
      healthScore: 85,
      qualityScore: 90,
      scheduleScore: 85,
      maxOvertimePercent: 15,
      vendorOnTimeRate: 90
    },
    assignedManagers: [],
    milestones: []
  });

  // Fetch projects and personnel on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedProjects, fetchedPersonnel] = await Promise.all([
          fetchProjects(),
          fetchPersonnel()
        ]);

        // Map API projects to component format (projectId -> id)
        const mappedProjects = fetchedProjects.map(p => ({
          ...p,
          id: p.projectId || p.id
        })) as Project[];

        setProjects(mappedProjects);
        setPersonnel(fetchedPersonnel);

        if (mappedProjects.length > 0) {
          setSelectedProject(mappedProjects[0]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  const handleAddProject = async () => {
    try {
      // Call backend API to create project
      const createdProject = await createProject(newProject);

      // Map to component format
      const projectToAdd = {
        ...createdProject,
        id: createdProject.projectId || createdProject.id
      } as Project;

      setProjects([...projects, projectToAdd]);
      setSelectedProject(projectToAdd);
      setShowAddProjectModal(false);

      // Reset form
      setNewProject({
        projectName: '',
        projectCode: '',
        description: '',
        location: { address: '', city: '', state: '', zip: '' },
        projectType: 'commercial',
        status: 'planning',
        startDate: '',
        estimatedEndDate: '',
        targetCompletionPercentage: 100,
        budget: { total: 0, labor: 0, materials: 0, equipment: 0 },
        kpiTargets: {
          healthScore: 85,
          qualityScore: 90,
          scheduleScore: 85,
          maxOvertimePercent: 15,
          vendorOnTimeRate: 90
        },
        assignedManagers: [],
        milestones: []
      });
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        // Call backend API to delete project
        await deleteProjectAPI(projectId);

        // Update local state
        const remainingProjects = projects.filter(p => p.id !== projectId);
        setProjects(remainingProjects);

        if (selectedProject?.id === projectId) {
          setSelectedProject(remainingProjects[0] || null);
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  const handleEditProject = () => {
    if (selectedProject) {
      setEditingProject({ ...selectedProject });
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = async () => {
    if (editingProject) {
      try {
        // Call backend API to update project
        const updatedProject = await updateProject(editingProject.id, editingProject);

        // Map to component format
        const mappedProject = {
          ...updatedProject,
          id: updatedProject.projectId || updatedProject.id
        } as Project;

        setProjects(projects.map(p => p.id === editingProject.id ? mappedProject : p));
        setSelectedProject(mappedProject);
        setShowEditModal(false);
        setEditingProject(null);
      } catch (error) {
        console.error('Error updating project:', error);
        alert('Failed to update project. Please try again.');
      }
    }
  };

  const handleAddPersonnel = async (personnelId: string, name: string, role: string) => {
    if (selectedProject) {
      try {
        const updatedProject = {
          ...selectedProject,
          assignedManagers: [
            ...selectedProject.assignedManagers,
            { managerId: personnelId, name, role }
          ]
        };

        // Call backend API to update project with new personnel
        const savedProject = await updateProject(selectedProject.id, updatedProject);

        // Map to component format
        const mappedProject = {
          ...savedProject,
          id: savedProject.projectId || savedProject.id
        } as Project;

        setProjects(projects.map(p => p.id === selectedProject.id ? mappedProject : p));
        setSelectedProject(mappedProject);
      } catch (error) {
        console.error('Error adding personnel:', error);
        alert('Failed to add personnel. Please try again.');
      }
    }
  };

  const handleRemovePersonnel = async (managerId: string) => {
    if (selectedProject) {
      try {
        const updatedProject = {
          ...selectedProject,
          assignedManagers: selectedProject.assignedManagers.filter(m => m.managerId !== managerId)
        };

        // Call backend API to update project with personnel removed
        const savedProject = await updateProject(selectedProject.id, updatedProject);

        // Map to component format
        const mappedProject = {
          ...savedProject,
          id: savedProject.projectId || savedProject.id
        } as Project;

        setProjects(projects.map(p => p.id === selectedProject.id ? mappedProject : p));
        setSelectedProject(mappedProject);
      } catch (error) {
        console.error('Error removing personnel:', error);
        alert('Failed to remove personnel. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-gold-light/10 to-gold-dark/10 border-b border-gold/20 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-3xl font-display font-bold text-white mb-2">Project Admin</h1>
              <p className="text-sm text-white/60">Manage project details and KPI targets for analytics tracking</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddProjectModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition text-sm font-semibold flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Project</span>
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-160px)]">
        {/* Project List Sidebar */}
        <div className="w-80 border-r border-white/10 bg-dark-card/30 overflow-y-auto">
          <div className="p-4 space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className={`p-4 rounded-xl cursor-pointer transition ${
                  selectedProject?.id === project.id
                    ? 'bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border border-gold/30'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{project.projectName}</h3>
                    <p className="text-xs text-white/60 mt-1">{project.projectCode}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        project.status === 'planning' ? 'bg-blue-500/20 text-blue-400' :
                        project.status === 'completed' ? 'bg-purple-500/20 text-purple-400' :
                        project.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project Details Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedProject ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Quick Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleEditProject}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit Project</span>
                </button>
                <button
                  onClick={() => handleDeleteProject(selectedProject.id)}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>

              {/* Basic Information */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Basic Information</span>
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-white/60">Project Name</label>
                    <p className="text-white font-semibold">{selectedProject.projectName}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Project Code</label>
                    <p className="text-white font-semibold">{selectedProject.projectCode}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/60">Description</label>
                    <p className="text-white">{selectedProject.description}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/60">Location</label>
                    <p className="text-white">
                      {selectedProject.location?.address || 'N/A'}, {selectedProject.location?.city || 'N/A'}, {selectedProject.location?.state || 'N/A'} {selectedProject.location?.zip || ''}
                    </p>
                  </div>
                  <div>
                    <label className="text-white/60">Project Type</label>
                    <p className="text-white capitalize">{selectedProject.projectType}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Status</label>
                    <p className="text-white capitalize">{selectedProject.status.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Timeline</span>
                </h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="text-white/60">Start Date</label>
                    <p className="text-white font-semibold">{selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Estimated End Date</label>
                    <p className="text-white font-semibold">{selectedProject.estimatedEndDate ? new Date(selectedProject.estimatedEndDate).toLocaleDateString() : 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Target Completion %</label>
                    <p className="text-white font-semibold">{selectedProject.targetCompletionPercentage || 0}%</p>
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Budget Allocation</span>
                </h2>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="text-white/60">Total Budget</label>
                    <p className="text-white font-bold text-lg">${(selectedProject.budget?.total || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Labor</label>
                    <p className="text-white font-semibold">${(selectedProject.budget?.labor || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Materials</label>
                    <p className="text-white font-semibold">${(selectedProject.budget?.materials || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Equipment</label>
                    <p className="text-white font-semibold">${(selectedProject.budget?.equipment || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* KPI Targets */}
              <div className="bg-gradient-to-r from-gold-light/10 to-gold-dark/10 rounded-2xl p-6 border border-gold/30">
                <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>KPI Targets (for Analytics Tracking)</span>
                </h2>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <label className="text-white/60">Health Score Target</label>
                    <p className="text-gold font-bold text-xl">{selectedProject.kpiTargets?.healthScore || 85}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Quality Score Target</label>
                    <p className="text-gold font-bold text-xl">{selectedProject.kpiTargets?.qualityScore || 90}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Schedule Score Target</label>
                    <p className="text-gold font-bold text-xl">{selectedProject.kpiTargets?.scheduleScore || 85}</p>
                  </div>
                  <div>
                    <label className="text-white/60">Max Overtime %</label>
                    <p className="text-gold font-bold text-xl">{selectedProject.kpiTargets?.maxOvertimePercent || 15}%</p>
                  </div>
                  <div>
                    <label className="text-white/60">Vendor On-Time Rate</label>
                    <p className="text-gold font-bold text-xl">{selectedProject.kpiTargets?.vendorOnTimeRate || 90}%</p>
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-4">
                  These targets are used by Roxy's analytics to measure project performance and identify areas requiring attention.
                </p>
              </div>

              {/* Assigned Personnel */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-display font-bold text-white flex items-center space-x-2">
                    <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Assigned Personnel</span>
                  </h2>
                  <button
                    onClick={() => setShowPersonnelModal(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition text-xs font-semibold flex items-center space-x-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Personnel</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {selectedProject.assignedManagers.length > 0 ? (
                    selectedProject.assignedManagers.map((manager) => (
                      <div key={manager.managerId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="text-white font-semibold">{manager.name}</p>
                          <p className="text-xs text-white/60">{manager.role}</p>
                        </div>
                        <button
                          onClick={() => handleRemovePersonnel(manager.managerId)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-white/40 text-sm text-center py-4">No personnel assigned yet</p>
                  )}
                </div>
              </div>

              {/* Milestones */}
              <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Milestones</span>
                </h2>
                <div className="space-y-3">
                  {selectedProject.milestones.map((milestone) => (
                    <div key={milestone.id} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white font-semibold">{milestone.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          milestone.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          milestone.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          milestone.status === 'delayed' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {milestone.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-white/60 mb-2">Target: {milestone.targetDate ? new Date(milestone.targetDate).toLocaleDateString() : 'Not set'}</p>
                      <p className="text-xs text-white/50">{milestone.deliverables}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/60">Select a project to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto" onClick={() => setShowAddProjectModal(false)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-2xl font-display font-bold text-white">Add New Project</h2>
              <button onClick={() => setShowAddProjectModal(false)} className="text-white/60 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Project Name *</label>
                    <input
                      type="text"
                      value={newProject.projectName}
                      onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      placeholder="Enter project name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Project Code *</label>
                    <input
                      type="text"
                      value={newProject.projectCode}
                      onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      placeholder="PRJ-001"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-white/80 mb-1">Description</label>
                    <textarea
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      rows={3}
                      placeholder="Project description"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm text-white/80 mb-1">Address</label>
                    <input
                      type="text"
                      value={newProject.location.address}
                      onChange={(e) => setNewProject({ ...newProject, location: { ...newProject.location, address: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">City</label>
                    <input
                      type="text"
                      value={newProject.location.city}
                      onChange={(e) => setNewProject({ ...newProject, location: { ...newProject.location, city: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">State</label>
                    <input
                      type="text"
                      value={newProject.location.state}
                      onChange={(e) => setNewProject({ ...newProject, location: { ...newProject.location, state: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Timeline & Budget */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Timeline</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Start Date *</label>
                      <input
                        type="date"
                        value={newProject.startDate}
                        onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Estimated End Date *</label>
                      <input
                        type="date"
                        value={newProject.estimatedEndDate}
                        onChange={(e) => setNewProject({ ...newProject, estimatedEndDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Budget ($)</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Total Budget</label>
                      <input
                        type="number"
                        value={newProject.budget.total}
                        onChange={(e) => setNewProject({ ...newProject, budget: { ...newProject.budget, total: Number(e.target.value) } })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Labor</label>
                        <input
                          type="number"
                          value={newProject.budget.labor}
                          onChange={(e) => setNewProject({ ...newProject, budget: { ...newProject.budget, labor: Number(e.target.value) } })}
                          className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Materials</label>
                        <input
                          type="number"
                          value={newProject.budget.materials}
                          onChange={(e) => setNewProject({ ...newProject, budget: { ...newProject.budget, materials: Number(e.target.value) } })}
                          className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Equipment</label>
                        <input
                          type="number"
                          value={newProject.budget.equipment}
                          onChange={(e) => setNewProject({ ...newProject, budget: { ...newProject.budget, equipment: Number(e.target.value) } })}
                          className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Targets */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">KPI Targets</h3>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Health Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newProject.kpiTargets.healthScore}
                      onChange={(e) => setNewProject({ ...newProject, kpiTargets: { ...newProject.kpiTargets, healthScore: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Quality Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newProject.kpiTargets.qualityScore}
                      onChange={(e) => setNewProject({ ...newProject, kpiTargets: { ...newProject.kpiTargets, qualityScore: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Schedule Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newProject.kpiTargets.scheduleScore}
                      onChange={(e) => setNewProject({ ...newProject, kpiTargets: { ...newProject.kpiTargets, scheduleScore: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Max OT %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newProject.kpiTargets.maxOvertimePercent}
                      onChange={(e) => setNewProject({ ...newProject, kpiTargets: { ...newProject.kpiTargets, maxOvertimePercent: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Vendor On-Time %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newProject.kpiTargets.vendorOnTimeRate}
                      onChange={(e) => setNewProject({ ...newProject, kpiTargets: { ...newProject.kpiTargets, vendorOnTimeRate: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-2">These targets will be used by analytics to track project performance</p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end space-x-3 sticky bottom-0">
              <button
                onClick={() => setShowAddProjectModal(false)}
                className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                disabled={!newProject.projectName || !newProject.projectCode || !newProject.startDate || !newProject.estimatedEndDate}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto" onClick={() => setShowEditModal(false)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-2xl font-display font-bold text-white">Edit Project</h2>
              <button onClick={() => setShowEditModal(false)} className="text-white/60 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Project Name *</label>
                    <input
                      type="text"
                      value={editingProject.projectName}
                      onChange={(e) => setEditingProject({ ...editingProject, projectName: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">Status</label>
                    <select
                      value={editingProject.status}
                      onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    >
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-white/80 mb-1">Description</label>
                    <textarea
                      value={editingProject.description}
                      onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm text-white/80 mb-1">Address</label>
                    <input
                      type="text"
                      value={editingProject.location?.address || ''}
                      onChange={(e) => setEditingProject({ ...editingProject, location: { ...editingProject.location, address: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">City</label>
                    <input
                      type="text"
                      value={editingProject.location?.city || ''}
                      onChange={(e) => setEditingProject({ ...editingProject, location: { ...editingProject.location, city: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">State</label>
                    <input
                      type="text"
                      value={editingProject.location?.state || ''}
                      onChange={(e) => setEditingProject({ ...editingProject, location: { ...editingProject.location, state: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/80 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={editingProject.location?.zip || ''}
                      onChange={(e) => setEditingProject({ ...editingProject, location: { ...editingProject.location, zip: e.target.value } })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Timeline & Budget */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Timeline</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={editingProject.startDate}
                        onChange={(e) => setEditingProject({ ...editingProject, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Estimated End Date</label>
                      <input
                        type="date"
                        value={editingProject.estimatedEndDate}
                        onChange={(e) => setEditingProject({ ...editingProject, estimatedEndDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Budget ($)</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/80 mb-1">Total Budget</label>
                      <input
                        type="number"
                        value={editingProject.budget?.total || 0}
                        onChange={(e) => setEditingProject({ ...editingProject, budget: { ...editingProject.budget, total: Number(e.target.value) } })}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Labor</label>
                        <input
                          type="number"
                          value={editingProject.budget?.labor || 0}
                          onChange={(e) => setEditingProject({ ...editingProject, budget: { ...editingProject.budget, labor: Number(e.target.value) } })}
                          className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Materials</label>
                        <input
                          type="number"
                          value={editingProject.budget?.materials || 0}
                          onChange={(e) => setEditingProject({ ...editingProject, budget: { ...editingProject.budget, materials: Number(e.target.value) } })}
                          className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Equipment</label>
                        <input
                          type="number"
                          value={editingProject.budget?.equipment || 0}
                          onChange={(e) => setEditingProject({ ...editingProject, budget: { ...editingProject.budget, equipment: Number(e.target.value) } })}
                          className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Targets */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">KPI Targets</h3>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Health Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingProject.kpiTargets?.healthScore || 85}
                      onChange={(e) => setEditingProject({ ...editingProject, kpiTargets: { ...editingProject.kpiTargets, healthScore: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Quality Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingProject.kpiTargets?.qualityScore || 90}
                      onChange={(e) => setEditingProject({ ...editingProject, kpiTargets: { ...editingProject.kpiTargets, qualityScore: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Schedule Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingProject.kpiTargets?.scheduleScore || 85}
                      onChange={(e) => setEditingProject({ ...editingProject, kpiTargets: { ...editingProject.kpiTargets, scheduleScore: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Max OT %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingProject.kpiTargets?.maxOvertimePercent || 15}
                      onChange={(e) => setEditingProject({ ...editingProject, kpiTargets: { ...editingProject.kpiTargets, maxOvertimePercent: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Vendor On-Time %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingProject.kpiTargets?.vendorOnTimeRate || 90}
                      onChange={(e) => setEditingProject({ ...editingProject, kpiTargets: { ...editingProject.kpiTargets, vendorOnTimeRate: Number(e.target.value) } })}
                      className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end space-x-3 sticky bottom-0">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition text-sm font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      {showPersonnelModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowPersonnelModal(false)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-md w-full border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold text-white">Add Personnel</h2>
              <button onClick={() => setShowPersonnelModal(false)} className="text-white/60 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/80 mb-2">Select Personnel</label>
                  <select
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    id="personnel-select"
                  >
                    <option value="">-- Select Employee --</option>
                    {personnel.map(person => (
                      <option key={person.id} value={`${person.id}|${person.name}`}>
                        {person.name} - {person.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white/80 mb-2">Project Role</label>
                  <select
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold"
                    id="role-select"
                  >
                    <option value="">-- Select Role --</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Site Supervisor">Site Supervisor</option>
                    <option value="Foreman">Foreman</option>
                    <option value="Safety Officer">Safety Officer</option>
                    <option value="Quality Control">Quality Control</option>
                    <option value="Equipment Manager">Equipment Manager</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowPersonnelModal(false)}
                className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const personnelSelect = document.getElementById('personnel-select') as HTMLSelectElement;
                  const roleSelect = document.getElementById('role-select') as HTMLSelectElement;
                  if (personnelSelect.value && roleSelect.value) {
                    const [id, name] = personnelSelect.value.split('|');
                    handleAddPersonnel(id, name, roleSelect.value);
                    setShowPersonnelModal(false);
                  }
                }}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition text-sm font-semibold"
              >
                Add to Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
