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

interface ExtractedData {
  work_completed?: string[];
  work_in_progress?: string[];
  issues?: string[];
  vendors?: any[];
  additional_personnel?: any[];
  ambiguities?: string[];
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
  extracted_data?: string | ExtractedData; // Can be JSON string or parsed object
  reporter_name?: string;
  extraction_confidence?: number;
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
  const [filter, setFilter] = useState<'all' | 'project' | 'myreports'>('myreports');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc'>('date-desc');

  // Helper to parse extracted_data if it's a JSON string
  const getExtractedData = (report: Report): ExtractedData | null => {
    if (!report.extracted_data) return null;

    try {
      if (typeof report.extracted_data === 'string') {
        return JSON.parse(report.extracted_data);
      }
      return report.extracted_data;
    } catch (err) {
      console.error('Failed to parse extracted_data:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter, selectedProject, sortBy]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `${API_BASE_URL}/reports`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        let filteredReports = data.reports;

        // Filter by ownership (My Reports vs All)
        if (filter === 'myreports') {
          filteredReports = filteredReports.filter((r: Report) =>
            r.reporter_name === manager.name || r.manager_name === manager.name
          );
        } else if (filter === 'project') {
          filteredReports = filteredReports.filter((r: Report) =>
            r.project_id === project.id
          );
        }

        // Filter by selected project (if not 'all')
        if (selectedProject !== 'all') {
          filteredReports = filteredReports.filter((r: Report) =>
            r.project_id === selectedProject
          );
        }

        // Sort by date
        const sortedReports = filteredReports.sort((a: Report, b: Report) => {
          const dateA = new Date(a.report_date).getTime();
          const dateB = new Date(b.report_date).getTime();
          return sortBy === 'date-desc' ? dateB - dateA : dateA - dateB;
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

  // Get unique projects from reports for filter dropdown
  const uniqueProjects = Array.from(new Set(reports.map(r => r.project_id)));

  const handleViewTranscript = (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${API_BASE_URL}/reports/${report.report_id}/transcript`;
    window.open(url, '_blank');
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
        <div className="mb-6 glass rounded-xl p-6">
          {/* Main Filter Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-semibold text-gray-400">View:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilter('myreports')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === 'myreports'
                      ? 'bg-gold text-dark-bg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  My Reports
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
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === 'all'
                      ? 'bg-gold text-dark-bg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  All Reports
                </button>
              </div>
            </div>
            <span className="text-sm text-gray-500">{reports.length} reports</span>
          </div>

          {/* Secondary Filters */}
          <div className="flex items-center space-x-4 pt-4 border-t border-white/10">
            {/* Project Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-400">Project:</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-gold focus:border-gold/50 outline-none"
              >
                <option value="all" className="bg-dark-surface">All Projects</option>
                {uniqueProjects.map(projectId => (
                  <option key={projectId} value={projectId} className="bg-dark-surface">
                    {reports.find(r => r.project_id === projectId)?.project_name || projectId}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Sort */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-400">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date-desc' | 'date-asc')}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-gold focus:border-gold/50 outline-none"
              >
                <option value="date-desc" className="bg-dark-surface">Newest First</option>
                <option value="date-asc" className="bg-dark-surface">Oldest First</option>
              </select>
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
              {filter === 'myreports' && 'You haven\'t created any reports yet.'}
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
                  {monthReports.map((report) => {
                    const extracted = getExtractedData(report);

                    return (
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
                          report.status === 'processed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {report.status}
                        </div>
                      </div>

                      {/* Reporter & Project */}
                      <div className="text-xs text-gray-400 space-y-1 mb-3">
                        <p className="flex items-center">
                          <span className="mr-1">👤</span>
                          <span className="text-white font-semibold">{report.reporter_name || report.manager_name || 'Unknown'}</span>
                        </p>
                        <p className="flex items-center">
                          <span className="mr-1">📍</span>
                          {report.project_name || report.project_id}
                        </p>
                      </div>

                      {/* Extracted Data Highlights */}
                      {extracted && (
                        <div className="space-y-2 mb-3">
                          {/* Work Completed */}
                          {extracted.work_completed && extracted.work_completed.length > 0 && (
                            <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                              <div className="flex items-center space-x-1 mb-1">
                                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-green-400 font-semibold text-xs">
                                  {extracted.work_completed.length} tasks completed
                                </span>
                              </div>
                              <p className="text-gray-300 text-xs line-clamp-2">
                                {extracted.work_completed[0]}
                              </p>
                            </div>
                          )}

                          {/* Issues */}
                          {extracted.issues && extracted.issues.length > 0 && (
                            <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                              <div className="flex items-center space-x-1 mb-1">
                                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-red-400 font-semibold text-xs">
                                  {extracted.issues.length} issue{extracted.issues.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <p className="text-gray-300 text-xs line-clamp-2">
                                {extracted.issues[0]}
                              </p>
                            </div>
                          )}

                          {/* Quick Stats */}
                          <div className="grid grid-cols-3 gap-1">
                            {extracted.work_in_progress && extracted.work_in_progress.length > 0 && (
                              <div className="bg-blue-500/10 rounded px-2 py-1 border border-blue-500/20">
                                <p className="text-blue-400 text-xs font-semibold">{extracted.work_in_progress.length}</p>
                                <p className="text-gray-400 text-[10px]">in progress</p>
                              </div>
                            )}
                            {extracted.vendors && extracted.vendors.length > 0 && (
                              <div className="bg-purple-500/10 rounded px-2 py-1 border border-purple-500/20">
                                <p className="text-purple-400 text-xs font-semibold">{extracted.vendors.length}</p>
                                <p className="text-gray-400 text-[10px]">vendors</p>
                              </div>
                            )}
                            {extracted.additional_personnel && extracted.additional_personnel.length > 0 && (
                              <div className="bg-gold/10 rounded px-2 py-1 border border-gold/20">
                                <p className="text-gold text-xs font-semibold">{extracted.additional_personnel.length}</p>
                                <p className="text-gray-400 text-[10px]">personnel</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Confidence Badge */}
                      {report.extraction_confidence && (
                        <div className="mb-3">
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-xs text-gray-500">
                              AI Confidence: {(report.extraction_confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <div className="flex items-center space-x-2">
                          {/* View Transcript Button */}
                          <button
                            onClick={(e) => handleViewTranscript(report, e)}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white hover:border-gold/30 transition flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Transcript</span>
                          </button>

                          {/* View Report Button */}
                          <div className="flex items-center text-gold text-sm font-semibold group-hover:translate-x-1 transition">
                            View Report
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
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
