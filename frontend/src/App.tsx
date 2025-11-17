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
  const { isAuthenticated, user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth-login');
  const [manager, setManager] = useState<Manager | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  // Check for existing session
  useEffect(() => {
    // If user is authenticated via new auth system, show appropriate screen
    if (isAuthenticated && user) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        setCurrentScreen('admin');
      } else if (user.role === 'manager') {
        setCurrentScreen('project-setup');
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
  }, [isAuthenticated, user]);

  const handleLogin = (selectedManager: Manager, selectedProject: Project) => {
    setManager(selectedManager);
    setProject(selectedProject);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('sitelogix_manager');
    localStorage.removeItem('sitelogix_project');
    setManager(null);
    setProject(null);
    setCurrentScreen('login');
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
        onNavigateToRoxy={handleNavigateToRoxy}
        onNavigateToReports={handleViewReports}
        onNavigateToAnalytics={handleViewAnalytics}
        onNavigateToAdmin={() => setCurrentScreen('admin')}
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
