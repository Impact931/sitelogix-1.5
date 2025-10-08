import React, { useState, useEffect } from 'react';

interface Manager {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  location: string;
}

interface Report {
  report_id: string;
  project_id: string;
  manager_id: string;
  manager_name?: string;
  project_name?: string;
  report_date: string;
  total_personnel: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  report_html_url: string;
  status: string;
  created_at: string;
}

interface ReportsListProps {
  manager: Manager;
  project: Project;
  onBack: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const ReportsList: React.FC<ReportsListProps> = ({ manager, project, onBack }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'project' | 'manager'>('all');

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `${API_BASE_URL}/reports`;
      if (filter === 'project') {
        url += `?projectId=${project.id}`;
      } else if (filter === 'manager') {
        url += `?managerId=${manager.id}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        // Sort by date (newest first)
        const sortedReports = data.reports.sort((a: Report, b: Report) => {
          return new Date(b.report_date).getTime() - new Date(a.report_date).getTime();
        });
        setReports(sortedReports);
      } else {
        setError(data.error || 'Failed to load reports');
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to connect to server. Please ensure the API server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (report: Report) => {
    try {
      // Always use API endpoint - it will proxy from S3 if needed
      const url = `${API_BASE_URL}/reports/${report.report_id}/html?projectId=${report.project_id}&reportDate=${report.report_date}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error opening report:', err);
      setError('Failed to open report');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const groupReportsByMonth = (reports: Report[]) => {
    const grouped: { [key: string]: Report[] } = {};

    reports.forEach(report => {
      const date = new Date(report.report_date);
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(report);
    });

    return grouped;
  };

  const groupedReports = groupReportsByMonth(reports);

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Daily Reports</h1>
              <p className="text-gray-400 text-sm mt-1 font-medium">
                {manager.name} • {project.name}
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Recording</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 glass rounded-xl p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-semibold text-gray-400">Filter:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'all'
                    ? 'bg-gold text-dark-bg'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                All Reports
              </button>
              <button
                onClick={() => setFilter('project')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'project'
                    ? 'bg-gold text-dark-bg'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                This Project
              </button>
              <button
                onClick={() => setFilter('manager')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'manager'
                    ? 'bg-gold text-dark-bg'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                My Reports
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 glass-gold rounded-2xl p-4 border border-red-500/30">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-gold border-r-transparent mb-4"></div>
            <p className="text-gray-400">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">No Reports Found</h3>
            <p className="text-gray-400">
              {filter === 'all' && 'No daily reports have been created yet.'}
              {filter === 'project' && `No reports found for ${project.name}.`}
              {filter === 'manager' && 'You haven\'t created any reports yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedReports).map(([monthKey, monthReports]) => (
              <div key={monthKey}>
                <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 text-gold mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  {monthKey}
                </h2>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {monthReports.map((report) => (
                    <div
                      key={report.report_id}
                      className="glass rounded-xl p-5 hover:bg-white/10 transition cursor-pointer group"
                      onClick={() => handleViewReport(report)}
                    >
                      {/* Date Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-gold-light to-gold-dark rounded-lg flex items-center justify-center text-dark-bg font-bold text-sm">
                            {new Date(report.report_date).getDate()}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">
                              {formatDate(report.report_date)}
                            </p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-semibold ${
                          report.status === 'Generated'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {report.status}
                        </div>
                      </div>

                      {/* Report Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Personnel</p>
                          <p className="text-white font-bold">{report.total_personnel || 0}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Reg Hrs</p>
                          <p className="text-white font-bold">{report.total_regular_hours || 0}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">OT Hrs</p>
                          <p className="text-white font-bold">{report.total_overtime_hours || 0}</p>
                        </div>
                      </div>

                      {/* Project Info */}
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>📍 {report.project_name || report.project_id}</p>
                        <p>👤 {report.manager_name || report.manager_id}</p>
                      </div>

                      {/* View Button */}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <div className="flex items-center text-gold text-sm font-semibold group-hover:translate-x-1 transition">
                          View Report
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {reports.length > 0 && (
          <div className="mt-8 glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Summary Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Reports</p>
                <p className="text-white text-2xl font-bold">{reports.length}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Personnel</p>
                <p className="text-white text-2xl font-bold">
                  {reports.reduce((sum, r) => sum + (r.total_personnel || 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Regular Hours</p>
                <p className="text-white text-2xl font-bold">
                  {reports.reduce((sum, r) => sum + (r.total_regular_hours || 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Total OT Hours</p>
                <p className="text-white text-2xl font-bold">
                  {reports.reduce((sum, r) => sum + (r.total_overtime_hours || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReportsList;
