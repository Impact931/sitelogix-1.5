import React from 'react';

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

interface User {
  userId: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface HomePageProps {
  manager: Manager;
  project: Project | null;
  user?: User;
  onNavigateToRoxy: () => void;
  onNavigateToReports: () => void;
  onNavigateToAnalytics: () => void;
  onNavigateToTeamManagement?: () => void;
  onNavigateToPayroll?: () => void;
  onLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  manager,
  project,
  user,
  onNavigateToRoxy,
  onNavigateToReports,
  onNavigateToAnalytics,
  onNavigateToTeamManagement,
  onNavigateToPayroll,
  onLogout,
}) => {
  // Determine user role and permissions
  const userRole = user?.role || 'employee';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isForeman = userRole === 'foreman';
  const isEmployee = userRole === 'employee';

  // Foremen and employees only see Roxy and Reports
  const hasLimitedAccess = isForeman || isEmployee;

  // Build navigation cards based on user role
  const navigationCards = [];

  // Roxy - available to everyone
  navigationCards.push({
    id: 'roxy',
    title: 'Roxy',
    subtitle: 'Voice Reporting',
    description: 'Create daily construction reports using voice',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    onClick: onNavigateToRoxy,
    available: true,
    gradient: 'from-gold-light to-gold-dark',
  });

  // Reports - available to everyone
  navigationCards.push({
    id: 'reports',
    title: 'Reports',
    subtitle: 'View & Manage',
    description: 'Access all daily construction reports',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    onClick: onNavigateToReports,
    available: true,
    gradient: 'from-blue-400 to-blue-600',
  });

  // Analytics - only for managers and admins
  if (!hasLimitedAccess) {
    navigationCards.push({
      id: 'analytics',
      title: 'Analytics',
      subtitle: 'Insights & Data',
      description: 'View project analytics and insights',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      onClick: onNavigateToAnalytics,
      available: true,
      gradient: 'from-green-400 to-green-600',
    });
  }

  // Future modules - only show to managers and admins
  if (!hasLimitedAccess) {
    navigationCards.push({
      id: 'reba',
      title: 'Reba',
      subtitle: 'Resource Allocation',
      description: 'Manage equipment and materials',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      onClick: () => {},
      available: false,
      gradient: 'from-purple-400 to-purple-600',
    });

    navigationCards.push({
      id: 'ranger',
      title: 'Ranger',
      subtitle: 'Safety & Compliance',
      description: 'Track safety incidents and compliance',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.40A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      onClick: () => {},
      available: false,
      gradient: 'from-red-400 to-red-600',
    });
  }

  // Add admin-only tiles if handlers are provided (only for admins)
  if (onNavigateToTeamManagement && isAdmin) {
    navigationCards.push({
      id: 'team-management',
      title: 'Team Management',
      subtitle: 'Personnel & Access',
      description: 'Manage team members and user access',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      onClick: onNavigateToTeamManagement,
      available: true,
      gradient: 'from-indigo-400 to-indigo-600',
    });
  }

  if (onNavigateToPayroll && isAdmin) {
    navigationCards.push({
      id: 'payroll',
      title: 'Payroll',
      subtitle: 'Hours & Wages',
      description: 'Manage payroll and employee hours',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: onNavigateToPayroll,
      available: true,
      gradient: 'from-emerald-400 to-emerald-600',
    });
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-gold-light to-gold-dark w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-gold/20">
                <svg className="w-7 h-7 text-dark-bg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white">SiteLogix</h1>
                <p className="text-xs text-gray-400">Construction Management Suite</p>
              </div>
            </div>

            {/* User Info & Actions */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{manager.goByName || manager.name}</p>
                <p className="text-xs text-gray-400">{project?.name || 'No project selected'}</p>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-display font-bold text-white mb-2">
            Welcome back, {manager.goByName || manager.name}
          </h2>
          <p className="text-gray-400">
            Select a module to get started with your construction management tasks
          </p>
        </div>

        {/* Navigation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {navigationCards.map((card) => (
            <button
              key={card.id}
              onClick={card.onClick}
              disabled={!card.available}
              className={`
                glass rounded-2xl p-8 text-left transition-all duration-200
                ${card.available
                  ? 'hover:scale-[1.02] hover:shadow-2xl cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
                }
                border border-white/10
              `}
            >
              {/* Icon */}
              <div className={`
                bg-gradient-to-br ${card.gradient}
                w-20 h-20 rounded-2xl flex items-center justify-center mb-6
                shadow-lg
                ${card.available ? 'text-white' : 'text-white/50'}
              `}>
                {card.icon}
              </div>

              {/* Content */}
              <div className="mb-2">
                <h3 className="text-2xl font-display font-bold text-white mb-1">
                  {card.title}
                </h3>
                <p className="text-sm font-semibold text-gray-400 mb-3">
                  {card.subtitle}
                </p>
              </div>

              <p className="text-sm text-gray-500">
                {card.description}
              </p>

              {!card.available && (
                <div className="mt-4 inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-xs font-medium text-gray-400">Coming Soon</span>
                </div>
              )}

              {card.available && (
                <div className="mt-4 flex items-center text-gold text-sm font-semibold">
                  <span>Open</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Quick Stats Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Current Project</p>
                {project ? (
                  <>
                    <p className="text-lg font-bold text-white">{project.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{project.location}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">Select a project to get started</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Your Role</p>
                <p className="text-lg font-bold text-white">{manager.position || 'Site Manager'}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">System Status</p>
                <p className="text-lg font-bold text-green-400">All Systems Online</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-600">
          Version 1.5 | © 2025 Impact Consulting
        </div>
      </main>
    </div>
  );
};

export default HomePage;
