import { useState, useEffect } from 'react';
import AdminLogin from './components/AdminLogin';
import VoiceReportingScreen from './components/VoiceReportingScreen';
import ReportsList from './components/ReportsList';
import AnalyticsDashboard from './components/AnalyticsDashboard';

interface Manager {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
}

type Screen = 'login' | 'recording' | 'reports' | 'analytics';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [manager, setManager] = useState<Manager | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  // Check for existing session
  useEffect(() => {
    const savedManager = localStorage.getItem('sitelogix_manager');
    const savedProject = localStorage.getItem('sitelogix_project');

    if (savedManager && savedProject) {
      setManager(JSON.parse(savedManager));
      setProject(JSON.parse(savedProject));
      setCurrentScreen('recording');
    }
  }, []);

  const handleLogin = (selectedManager: Manager, selectedProject: Project) => {
    setManager(selectedManager);
    setProject(selectedProject);
    setCurrentScreen('recording');
  };

  const handleLogout = () => {
    localStorage.removeItem('sitelogix_manager');
    localStorage.removeItem('sitelogix_project');
    setManager(null);
    setProject(null);
    setCurrentScreen('login');
  };

  const handleViewReports = () => {
    setCurrentScreen('reports');
  };

  const handleViewAnalytics = () => {
    setCurrentScreen('analytics');
  };

  const handleBackToRecording = () => {
    setCurrentScreen('recording');
  };

  if (currentScreen === 'login') {
    return <AdminLogin onLogin={handleLogin} />;
  }

  if (currentScreen === 'reports') {
    return (
      <ReportsList
        manager={manager!}
        project={project!}
        onBack={handleBackToRecording}
      />
    );
  }

  if (currentScreen === 'analytics') {
    return (
      <AnalyticsDashboard
        manager={manager!}
        project={project!}
        onBack={handleBackToRecording}
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

export default App;
