import { useState, useEffect } from 'react';
import { fetchProjects, type Project } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

interface ProjectSelectorProps {
  onProjectSelect: (project: any, manager: any) => void;
  onBack: () => void;
}

export default function ProjectSelector({ onProjectSelect, onBack }: ProjectSelectorProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const fetchedProjects = await fetchProjects();
        
        // Map API projects to component format
        const mappedProjects = fetchedProjects.map(p => ({
          ...p,
          id: p.projectId || p.id
        })) as Project[];
        
        setProjects(mappedProjects);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleSelectProject = (project: Project) => {
    // Map the authenticated user to a manager object for Roxy
    const manager = {
      id: user?.userId || 'admin-user',
      name: `${user?.firstName} ${user?.lastName}` || 'Admin User',
      goByName: user?.firstName || 'Admin'
    };

    // Map the project to the format expected by VoiceReportingScreen
    const mappedProject = {
      id: project.id || project.projectId || '',
      name: project.projectName,
      location: typeof project.location === 'string' 
        ? project.location 
        : `${project.location?.city || ''}, ${project.location?.state || ''}`.trim()
    };

    onProjectSelect(mappedProject, manager);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg flex items-center justify-center">
        <div className="text-white text-xl">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">Access Roxy</h1>
              <p className="text-white/80">Select a project to submit a daily report</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="max-w-4xl mx-auto">
        {projects.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <svg className="w-16 h-16 text-white/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-white/60 text-lg">No projects available</p>
            <p className="text-white/40 text-sm mt-2">Create a project first to submit reports</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => (
              <button
                key={project.id || project.projectId}
                onClick={() => handleSelectProject(project)}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 hover:border-purple-500/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-purple-400 transition">
                      {project.projectName}
                    </h3>
                    <p className="text-sm text-white/60 mb-1">{project.projectCode || 'No code'}</p>
                    {typeof project.location === 'object' && project.location && (
                      <p className="text-sm text-white/40">
                        {project.location.city}{project.location.city && project.location.state ? ', ' : ''}{project.location.state}
                      </p>
                    )}
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase ${
                    project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    project.status === 'planning' ? 'bg-blue-500/20 text-blue-400' :
                    project.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
                    project.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {project.status}
                  </div>
                </div>

                {project.description && (
                  <p className="text-white/60 text-sm line-clamp-2 mb-4">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center space-x-4 text-xs text-white/40">
                    {project.assignedManagers && project.assignedManagers.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{project.assignedManagers.length} personnel</span>
                      </div>
                    )}
                  </div>
                  <div className="text-purple-400 font-semibold text-sm flex items-center space-x-2">
                    <span>Submit Report</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
