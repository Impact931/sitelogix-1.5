import React, { useState, useEffect } from 'react';

interface Manager {
  id: string;
  name: string;
  goByName?: string;
  position?: string;
  phone?: string;
  email?: string;
  currentProject?: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
  managerId?: string;
}

interface AdminLoginProps {
  onLogin: (manager: Manager, project: Project) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Fallback data when API is unavailable
const FALLBACK_MANAGERS: Manager[] = [
  { id: 'MGR001', name: 'John Smith', goByName: 'John', position: 'Project Manager', phone: '555-0101', email: 'john@example.com' },
  { id: 'MGR002', name: 'Sarah Johnson', goByName: 'Sarah', position: 'Site Manager', phone: '555-0102', email: 'sarah@example.com' },
  { id: 'MGR003', name: 'Michael Brown', goByName: 'Mike', position: 'Foreman', phone: '555-0103', email: 'mike@example.com' },
];

const FALLBACK_PROJECTS: Project[] = [
  { id: 'PRJ001', name: 'Parkway Plaza Development', location: 'Downtown District' },
  { id: 'PRJ002', name: 'Sunset Ridge Construction', location: 'West Side' },
  { id: 'PRJ003', name: 'Harbor View Complex', location: 'Waterfront' },
];

// Hardcoded Super Admin Developer Account
const SUPER_ADMIN = {
  username: 'Jayson Rivas',
  email: 'jayson@impactconsulting931.com',
  password: 'Rivas123$',
  role: 'SuperAdminDev'
};

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [loginMode, setLoginMode] = useState<'dropdown' | 'password'>('dropdown');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [managers, setManagers] = useState<Manager[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch managers and projects on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        try {
          // Fetch master data (personnel and projects from entity normalization)
          const masterDataResponse = await fetch(`${API_BASE_URL}/extract/master-data`, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          const masterData = await masterDataResponse.json();

          if (masterData.success && masterData.personnel) {
            // Map master personnel to manager format
            const mappedManagers = Object.entries(masterData.personnel).map(([id, person]: [string, any]) => ({
              id,
              name: person.canonical_name,
              position: person.role || 'Foreman',
              phone: '',
              email: ''
            }));
            setManagers(mappedManagers);
          } else {
            throw new Error('Failed to load personnel from API');
          }

          // Use projects from same master data response
          if (masterData.success && masterData.projects) {
            // Map master projects to project format
            const mappedProjects = Object.entries(masterData.projects).map(([id, proj]: [string, any]) => ({
              id,
              name: proj.canonical_name,
              location: proj.location || 'TBD',
              managerId: proj.primary_manager
            }));
            setProjects(mappedProjects);
          } else {
            throw new Error('Failed to load projects from API');
          }

          console.log('✅ Successfully loaded data from API');
        } catch (apiError) {
          // Use fallback data if API is unavailable
          console.warn('⚠️ API unavailable, using fallback data:', apiError);
          setManagers(FALLBACK_MANAGERS);
          setProjects(FALLBACK_PROJECTS);
          setError(''); // Clear error since we have fallback data
        }
      } catch (err) {
        console.error('Error loading data:', err);
        // Final fallback - use hardcoded data
        setManagers(FALLBACK_MANAGERS);
        setProjects(FALLBACK_PROJECTS);
        setError(''); // Clear error since we have fallback data
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Password login mode (for Super Admin)
    if (loginMode === 'password') {
      if (!username || !password) {
        setError('Please enter both username and password');
        return;
      }

      // Check for Super Admin credentials
      if (username === SUPER_ADMIN.username && password === SUPER_ADMIN.password) {
        const superAdminManager: Manager = {
          id: 'SUPER_ADMIN_DEV',
          name: SUPER_ADMIN.username,
          position: 'Super Admin Developer',
          email: SUPER_ADMIN.email
        };

        const allProjectsProject: Project = {
          id: 'ALL_PROJECTS',
          name: 'All Projects',
          location: 'System-Wide Access'
        };

        // Save to localStorage
        localStorage.setItem('sitelogix_manager', JSON.stringify(superAdminManager));
        localStorage.setItem('sitelogix_project', JSON.stringify(allProjectsProject));
        localStorage.setItem('sitelogix_role', SUPER_ADMIN.role);

        onLogin(superAdminManager, allProjectsProject);
        return;
      } else {
        setError('Invalid username or password');
        return;
      }
    }

    // Dropdown selection mode (for regular users)
    if (!selectedManagerId || !selectedProjectId) {
      setError('Please select both a manager and a project');
      return;
    }

    const manager = managers.find(m => m.id === selectedManagerId);
    const project = projects.find(p => p.id === selectedProjectId);

    if (manager && project) {
      // Save to localStorage for session persistence
      localStorage.setItem('sitelogix_manager', JSON.stringify(manager));
      localStorage.setItem('sitelogix_project', JSON.stringify(project));

      onLogin(manager, project);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="glass rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-gold-light to-gold-dark w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold/20">
            <svg className="w-12 h-12 text-dark-bg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">SiteLogix</h1>
          <p className="text-gray-400 text-sm font-medium">Daily Construction Reporting</p>
        </div>

        {/* Login Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-xl glass p-1">
            <button
              type="button"
              onClick={() => setLoginMode('dropdown')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                loginMode === 'dropdown'
                  ? 'bg-gold text-dark-bg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Site Manager
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('password')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                loginMode === 'password'
                  ? 'bg-gold text-dark-bg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Admin Login
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {loginMode === 'password' ? (
            <>
              {/* Admin Password Login */}
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-white mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-gold focus:border-gold/50 outline-none transition placeholder-gray-500"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-gold focus:border-gold/50 outline-none transition placeholder-gray-500"
                  placeholder="Enter password"
                  required
                />
              </div>
            </>
          ) : (
            <>
              {/* Loading State */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold border-r-transparent"></div>
                  <p className="text-gray-400 mt-4">Loading data...</p>
                </div>
              ) : (
                <>
                  {/* Manager Selection */}
                  <div>
                    <label htmlFor="manager" className="block text-sm font-semibold text-white mb-2">
                      Site Manager
                    </label>
                    <select
                      id="manager"
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-gold focus:border-gold/50 outline-none transition"
                      required
                      disabled={loading}
                    >
                      <option value="" className="bg-dark-surface text-gray-400">Select your name...</option>
                      {managers.map(manager => (
                        <option key={manager.id} value={manager.id} className="bg-dark-surface text-white">
                          {manager.name} {manager.position ? `(${manager.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project Selection */}
                  <div>
                    <label htmlFor="project" className="block text-sm font-semibold text-white mb-2">
                      Project Location
                    </label>
                    <select
                      id="project"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-gold focus:border-gold/50 outline-none transition"
                      required
                      disabled={loading}
                    >
                      <option value="" className="bg-dark-surface text-gray-400">Select project...</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id} className="bg-dark-surface text-white">
                          {project.name} {project.location !== 'TBD' ? `- ${project.location}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading && loginMode === 'dropdown'}
            className="w-full bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg py-4 px-6 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-gold/20 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-dark-bg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loginMode === 'password' ? 'Login as Admin' : 'Start Daily Report'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a href="#" className="text-sm text-gray-400 hover:text-gold transition font-medium">
            View Previous Reports
          </a>
        </div>

        {/* Version Info */}
        <div className="mt-4 text-center text-xs text-gray-600">
          Version 1.5 | © 2025 Impact Consulting
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
