import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLogin from './components/AdminLogin';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ProjectSetup from './components/ProjectSetup';
import ProjectProfile from './components/ProjectProfile';
import HomePage from './components/HomePage';
import VoiceReportingScreen from './components/VoiceReportingScreen';
import ReportsList from './components/ReportsList';
import AnalyticsDashboard from './components/AnalyticsDashboard';

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

type Screen = 'auth-login' | 'admin' | 'project-setup' | 'project-profile' | 'login' | 'home' | 'recording' | 'reports' | 'analytics';

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
      setManager(JSON.parse(savedManager));
      setProject(JSON.parse(savedProject));
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
      />
    );
  }

  // Show project profile management
  if (currentScreen === 'project-profile') {
    return <ProjectProfile onBack={handleBackToAdmin} />;
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

  return (
    <VoiceReportingScreen
      manager={manager!}
      project={project!}
      onChangeProject={handleLogout}
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
