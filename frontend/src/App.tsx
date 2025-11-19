import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLogin from './components/AdminLogin';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ProjectSetup from './components/ProjectSetup';
import ProjectProfile from './components/ProjectProfile';
import ProjectSelector from './components/ProjectSelector';
import UserManagement from './components/UserManagement';
import ChangePassword from './components/ChangePassword';
import HomePage from './components/HomePage';
import VoiceReportingScreen from './components/VoiceReportingScreen';
import ReportsList from './components/ReportsList';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import PayrollDashboard from './components/PayrollDashboard';
import EmployeeManagement from './components/EmployeeManagement';
import TeamManagement from './components/TeamManagement';

interface Manager {
  id: string;
  name: string;
  goByName?: string;
  position?: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
}

type Screen = 'auth-login' | 'admin' | 'project-setup' | 'project-profile' | 'project-selector' | 'user-management' | 'change-password' | 'login' | 'home' | 'recording' | 'reports' | 'analytics' | 'payroll' | 'employee-management' | 'team-management';

function AppContent() {
  const { isAuthenticated, user, isLoading, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth-login');
  const [manager, setManager] = useState<Manager | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  // VERSION IDENTIFIER - helps diagnose browser cache issues
  useEffect(() => {
    console.log('🚀 SiteLogix Frontend Version: BUILD-161-ROLE-PERMISSIONS');
    console.log('📅 Build Date: 2025-11-19 12:10 CST');
    console.log('🔧 Fixes: Employee number updates + Role-based permissions UI');
  }, []);

  // Check for existing session
  useEffect(() => {
    // Wait for auth to finish loading before making decisions
    if (isLoading) {
      return;
    }

    // If user is authenticated via new auth system, show appropriate screen
    if (isAuthenticated && user) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        // Show home dashboard with module tiles for admins
        setCurrentScreen('home');
        // Set dummy project/manager for admin home view
        if (!manager && !project) {
          setManager({ id: user.userId, name: `${user.firstName} ${user.lastName}`, goByName: user.firstName });
          setProject({ id: 'admin', name: 'Admin Dashboard', location: 'System' });
        }
      } else if (user.role === 'manager') {
        setCurrentScreen('project-setup');
      } else if (user.role === 'foreman' || user.role === 'employee') {
        // Foremen and employees go directly to Roxy (limited access)
        setCurrentScreen('home');
        if (!manager && !project) {
          setManager({ id: user.userId, name: `${user.firstName} ${user.lastName}`, goByName: user.firstName });
          setProject({ id: 'foreman', name: 'Daily Reports', location: 'Field' });
        }
      }
      return;
    }

    // Fall back to old session system
    const savedManager = localStorage.getItem('sitelogix_manager');
    const savedProject = localStorage.getItem('sitelogix_project');

    if (savedManager && savedProject) {
      const parsedManager = JSON.parse(savedManager);
      const parsedProject = JSON.parse(savedProject);

      console.log('🔍 App.tsx - Loading from localStorage:', {
        parsedManager,
        parsedProject
      });

      setManager(parsedManager);
      setProject(parsedProject);
      setCurrentScreen('home');
    }
  }, [isAuthenticated, user, isLoading]);

  const handleLogin = (selectedManager: Manager, selectedProject: Project) => {
    setManager(selectedManager);
    setProject(selectedProject);
    setCurrentScreen('home');
  };

  const handleLogout = async () => {
    // Clear legacy localStorage items
    localStorage.removeItem('sitelogix_manager');
    localStorage.removeItem('sitelogix_project');

    // Clear authentication tokens via AuthContext
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }

    // Clear local state
    setManager(null);
    setProject(null);
    setCurrentScreen('auth-login');
  };

  const handleChangeProject = () => {
    // Don't clear session - just navigate back to home
    setCurrentScreen('home');
  };

  const handleNavigateToRoxy = () => {
    setCurrentScreen('recording');
  };

  const handleViewReports = () => {
    setCurrentScreen('reports');
  };

  const handleViewAnalytics = () => {
    setCurrentScreen('analytics');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
  };

  const handleNavigateToProjectProfile = () => {
    setCurrentScreen('project-profile');
  };

  const handleBackToAdmin = () => {
    setCurrentScreen('admin');
  };

  const handleNavigateToRoxyFromAdmin = () => {
    // Navigate to project selector so admin can choose which project to report on
    setCurrentScreen('project-selector');
  };

  const handleProjectSelect = (selectedProject: Project, selectedManager: Manager) => {
    console.log('🔍 App.tsx - handleProjectSelect:', {
      selectedProject,
      selectedManager
    });

    // Set the manager and project for the admin user
    setProject(selectedProject);
    setManager(selectedManager);
    setCurrentScreen('recording');
  };

  const handleNavigateToUserManagement = () => {
    setCurrentScreen('user-management');
  };

  const handleNavigateToChangePassword = () => {
    setCurrentScreen('change-password');
  };

  const handleNavigateToPayroll = () => {
    setCurrentScreen('payroll');
  };

  const handleNavigateToEmployeeManagement = () => {
    setCurrentScreen('employee-management');
  };

  const handleNavigateToTeamManagement = () => {
    setCurrentScreen('team-management');
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <svg className="animate-spin h-12 w-12 text-gold mx-auto" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-2">SiteLogix</h2>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth login for authenticated system
  if (currentScreen === 'auth-login') {
    return <Login onSwitchToLegacy={() => setCurrentScreen('login')} />;
  }

  // Show admin dashboard for admin/superadmin users
  if (currentScreen === 'admin') {
    return (
      <AdminDashboard
        onNavigateToProjectSetup={() => setCurrentScreen('project-setup')}
        onNavigateToProjectProfile={handleNavigateToProjectProfile}
        onNavigateToRoxy={handleNavigateToRoxyFromAdmin}
        onNavigateToUserManagement={handleNavigateToUserManagement}
        onNavigateToChangePassword={handleNavigateToChangePassword}
        onNavigateToPayroll={handleNavigateToPayroll}
        onNavigateToEmployeeManagement={handleNavigateToEmployeeManagement}
        onNavigateToTeamManagement={handleNavigateToTeamManagement}
      />
    );
  }

  // Show project profile management
  if (currentScreen === 'project-profile') {
    return <ProjectProfile onBack={handleBackToAdmin} />;
  }

  // Show project selector for admin Roxy access
  if (currentScreen === 'project-selector') {
    return <ProjectSelector onProjectSelect={handleProjectSelect} onBack={handleBackToAdmin} />;
  }

  // Show user management for super admin
  if (currentScreen === 'user-management') {
    return <UserManagement onBack={handleBackToAdmin} />;
  }

  // Show change password for users
  if (currentScreen === 'change-password') {
    return <ChangePassword onBack={handleBackToAdmin} />;
  }

  // Show project setup for managers
  if (currentScreen === 'project-setup') {
    return <ProjectSetup onProjectCreated={() => setCurrentScreen('home')} onBack={() => setCurrentScreen('admin')} />;
  }

  // Legacy login screen
  if (currentScreen === 'login') {
    return <AdminLogin onLogin={handleLogin} onSwitchToAuth={() => setCurrentScreen('auth-login')} />;
  }

  if (currentScreen === 'home') {
    return (
      <HomePage
        manager={manager!}
        project={project!}
        user={user || undefined}
        onNavigateToRoxy={handleNavigateToRoxy}
        onNavigateToReports={handleViewReports}
        onNavigateToAnalytics={handleViewAnalytics}
        onNavigateToTeamManagement={handleNavigateToTeamManagement}
        onNavigateToPayroll={handleNavigateToPayroll}
        onLogout={handleLogout}
      />
    );
  }

  if (currentScreen === 'reports') {
    return (
      <ReportsList
        manager={manager!}
        project={project!}
        onBack={handleBackToHome}
        onNavigateToAnalytics={handleViewAnalytics}
      />
    );
  }

  if (currentScreen === 'analytics') {
    return (
      <AnalyticsDashboard
        manager={manager!}
        project={project!}
        onBack={handleBackToHome}
      />
    );
  }

  if (currentScreen === 'payroll') {
    return <PayrollDashboard onClose={handleBackToAdmin} />;
  }

  if (currentScreen === 'employee-management') {
    return <EmployeeManagement onClose={handleBackToAdmin} />;
  }

  if (currentScreen === 'team-management') {
    return <TeamManagement onClose={handleBackToAdmin} />;
  }

  return (
    <VoiceReportingScreen
      manager={manager!}
      project={project!}
      onChangeProject={handleChangeProject}
      onViewReports={handleViewReports}
      onViewAnalytics={handleViewAnalytics}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
