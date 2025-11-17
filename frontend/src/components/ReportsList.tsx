import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  // New format from Claude 4.5 Sonnet extraction
  personnel?: Array<{
    fullName: string;
    goByName?: string;
    position?: string;
    hoursWorked?: number;
    overtimeHours?: number;
  }>;
  workLogs?: Array<{
    teamId: string;
    taskDescription: string;
    personnelCount?: number;
  }>;
  constraints?: Array<{
    category: string;
    severity: string;
    title: string;
    description: string;
    status: string;
  }>;
  vendors?: Array<{
    companyName: string;
    materialsDelivered?: string;
    deliveryTime?: string;
  }>;
  timeSummary?: {
    totalPersonnelCount?: number;
    totalRegularHours?: number;
    totalOvertimeHours?: number;
  };
  // Legacy format (fallback)
  work_completed?: string[];
  work_in_progress?: string[];
  issues?: string[];
  additional_personnel?: any[];
}

interface Report {
  report_id: string;
  project_id: string;
  manager_id: string;
  manager_name?: string;
  project_name?: string;
  report_date: string;
  submission_timestamp?: string;
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
  onNavigateToAnalytics?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const ReportsList: React.FC<ReportsListProps> = ({ manager, project, onBack, onNavigateToAnalytics }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'project' | 'myreports'>('myreports');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc'>('date-desc');
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState(false);

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

    // Auto-refresh after 3 seconds to catch reports that are still being processed
    const refreshTimeout = setTimeout(() => {
      console.log('Auto-refreshing reports to catch late-arriving data...');
      fetchReports();
    }, 3000);

    return () => clearTimeout(refreshTimeout);
  }, [filter, selectedProject, sortBy, project.id]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      // Pass projectId to optimize backend query (uses Query instead of Scan)
      const queryParams = new URLSearchParams();
      if (filter === 'project' || selectedProject !== 'all') {
        queryParams.append('projectId', selectedProject !== 'all' ? selectedProject : project.id);
      }

      console.log('🔍 ReportsList - Fetching reports with:', {
        filter,
        selectedProject,
        projectId: selectedProject !== 'all' ? selectedProject : project.id,
        projectObject: project
      });

      const url = `${API_BASE_URL}/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit', // Don't send credentials to avoid CORS preflight
        cache: 'no-store' // Prevent caching issues
      });
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

        // Sort by date and time (use submission_timestamp for accurate ordering)
        const sortedReports = filteredReports.sort((a: Report, b: Report) => {
          // Use submission_timestamp if available, otherwise fall back to created_at or report_date
          const timeA = new Date(a.submission_timestamp || a.created_at || a.report_date).getTime();
          const timeB = new Date(b.submission_timestamp || b.created_at || b.report_date).getTime();
          return sortBy === 'date-desc' ? timeB - timeA : timeA - timeB;
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

  const handleViewTranscript = async (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      console.log('🔍 Opening transcript with details:', {
        report_id: report.report_id,
        project_id: report.project_id,
        report_date: report.report_date
      });
      setLoadingReport(true);
      setViewingReport(report);
      setReportHtml(''); // Clear previous HTML
      setError(null); // Clear previous errors

      // Add cache-busting timestamp
      const cacheBuster = `_cb=${Date.now()}`;
      const url = `${API_BASE_URL}/reports/${report.report_id}/transcript?projectId=${report.project_id}&reportDate=${report.report_date}&${cacheBuster}`;
      console.log('📡 Fetching transcript from URL:', url);

      // SIMPLE FETCH - no CORS options
      const response = await fetch(url);

      console.log('📥 Transcript response:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Transcript response not OK:', response.status, errorText);
        throw new Error(`Failed to fetch transcript: ${response.status} - ${errorText}`);
      }

      const html = await response.text();
      console.log('✅ Transcript loaded, length:', html.length);
      setReportHtml(html);
      console.log('✅ Transcript loaded successfully');
    } catch (err) {
      console.error('❌ Error loading transcript:', err);
      setError(`Failed to load transcript. Error: ${err instanceof Error ? err.message : String(err)}`);
      setViewingReport(null);
      setReportHtml('');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleViewReport = async (report: Report) => {
    try {
      console.log('🔍 Opening report with details:', {
        report_id: report.report_id,
        project_id: report.project_id,
        report_date: report.report_date,
        full_report_object: report
      });
      setLoadingReport(true);
      setViewingReport(report);
      setReportHtml(''); // Clear previous HTML
      setError(null); // Clear previous errors

      // Add cache-busting timestamp to force fresh fetch
      const cacheBuster = `_cb=${Date.now()}`;
      // CRITICAL: URL-encode report_id to handle special characters like # in IDs
      const encodedReportId = encodeURIComponent(report.report_id);
      const url = `${API_BASE_URL}/reports/${encodedReportId}/html?projectId=${report.project_id}&reportDate=${report.report_date}&${cacheBuster}`;
      console.log('📡 Fetching from URL:', url);
      console.log('🔑 Report ID (raw):', report.report_id);
      console.log('🔑 Report ID (encoded):', encodedReportId);

      // SIMPLE FETCH - no CORS options to avoid preflight/credentials mismatch
      const response = await fetch(url);

      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not OK. Status:', response.status, 'Body:', errorText);
        throw new Error(`Failed to fetch report: ${response.status} - ${errorText}`);
      }

      const html = await response.text();
      console.log('✅ HTML received, length:', html.length);
      setReportHtml(html);
      console.log('✅ Report loaded successfully');
    } catch (err) {
      console.error('❌ Error opening report:', err);
      console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError(`Failed to open report. Please try again. Error: ${err instanceof Error ? err.message : String(err)}`);
      setViewingReport(null);
      setReportHtml('');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCloseReport = () => {
    try {
      console.log('Closing report modal...');
      setViewingReport(null);
      setReportHtml('');
      setLoadingReport(false);
      console.log('Report modal closed successfully');
    } catch (error) {
      console.error('Error closing report:', error);
      // Force cleanup even if there's an error
      setViewingReport(null);
      setReportHtml('');
      setLoadingReport(false);
    }
  };

  const handleDeleteReport = async (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();

    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete this report?\n\nProject: ${report.project_name}\nDate: ${formatDate(report.report_date)}\n\nThis action cannot be undone.`)) {
      return;
    }

    console.log('🗑️ Deleting report:', {
      reportId: report.report_id,
      projectId: report.project_id,
      reportDate: report.report_date,
      projectName: report.project_name
    });

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        console.error('❌ Delete failed: No access token found');
        setError('Not authenticated');
        return;
      }

      // Validate required fields
      if (!report.project_id) {
        console.error('❌ Delete failed: Missing project_id');
        setError('Cannot delete report: Missing project ID');
        return;
      }
      if (!report.report_date) {
        console.error('❌ Delete failed: Missing report_date');
        setError('Cannot delete report: Missing report date');
        return;
      }

      // URL encode query parameters to handle special characters
      const encodedProjectId = encodeURIComponent(report.project_id);
      const encodedReportDate = encodeURIComponent(report.report_date);
      const url = `${API_BASE_URL}/reports/${report.report_id}?projectId=${encodedProjectId}&reportDate=${encodedReportDate}`;

      console.log('🗑️ DELETE request URL:', url);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'omit',
        cache: 'no-store'
      });

      console.log('🗑️ DELETE response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to delete report (HTTP ${response.status})`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('❌ Delete failed with error:', errorData);
        } catch (parseError) {
          console.error('❌ Delete failed and response was not JSON:', parseError);
          // If response body is not JSON, use status-based error
          if (response.status === 403) {
            errorMessage = 'Permission denied: Admin access required';
          } else if (response.status === 404) {
            errorMessage = 'Report not found';
          } else if (response.status === 401) {
            errorMessage = 'Authentication failed: Please log in again';
          }
        }

        throw new Error(errorMessage);
      }

      // Parse success response
      const result = await response.json();
      console.log('✅ Delete successful:', result);

      // Remove report from local state only after successful deletion
      setReports(prevReports => prevReports.filter(r => r.report_id !== report.report_id));
      console.log('✅ Report removed from UI');
    } catch (err) {
      console.error('❌ Error deleting report:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete report');
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
            <div className="flex items-center space-x-3">
              {onNavigateToAnalytics && (
                <button
                  onClick={onNavigateToAnalytics}
                  className="px-4 py-2 bg-gradient-to-r from-gold to-gold/80 rounded-xl text-dark-bg hover:from-gold/90 hover:to-gold/70 transition text-sm font-bold flex items-center space-x-2 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Analytics</span>
                </button>
              )}
              <button
                onClick={onBack}
                className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Home</span>
              </button>
            </div>
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
                          {/* Work Completed - use workLogs from new format or work_completed from old */}
                          {((extracted.workLogs && extracted.workLogs.length > 0) || (extracted.work_completed && extracted.work_completed.length > 0)) && (
                            <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                              <div className="flex items-center space-x-1 mb-1">
                                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-green-400 font-semibold text-xs">
                                  {extracted.workLogs ? `${extracted.workLogs.length} tasks completed` : `${extracted.work_completed?.length || 0} tasks completed`}
                                </span>
                              </div>
                              <p className="text-gray-300 text-xs line-clamp-2">
                                {extracted.workLogs ? extracted.workLogs[0]?.taskDescription : extracted.work_completed?.[0]}
                              </p>
                            </div>
                          )}

                          {/* Issues - use constraints from new format or issues from old */}
                          {((extracted.constraints && extracted.constraints.length > 0) || (extracted.issues && extracted.issues.length > 0)) && (
                            <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                              <div className="flex items-center space-x-1 mb-1">
                                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-red-400 font-semibold text-xs">
                                  {extracted.constraints ? `${extracted.constraints.length} constraint${extracted.constraints.length !== 1 ? 's' : ''}` : `${extracted.issues?.length || 0} issue${extracted.issues?.length !== 1 ? 's' : ''}`}
                                </span>
                              </div>
                              <p className="text-gray-300 text-xs line-clamp-2">
                                {extracted.constraints ? extracted.constraints[0]?.description : extracted.issues?.[0]}
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
                                <p className="text-gray-400 text-[10px]">vendor{extracted.vendors.length !== 1 ? 's' : ''}</p>
                              </div>
                            )}
                            {((extracted.personnel && extracted.personnel.length > 0) || (extracted.additional_personnel && extracted.additional_personnel.length > 0)) && (
                              <div className="bg-gold/10 rounded px-2 py-1 border border-gold/20">
                                <p className="text-gold text-xs font-semibold">{extracted.personnel?.length || extracted.additional_personnel?.length || 0}</p>
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
                        <div className="text-xs text-gray-500">
                          <div>📅 {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div>🕐 {new Date(report.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</div>
                        </div>
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

                          {/* Delete Button - Admin Only */}
                          {user?.role === 'admin' && (
                            <button
                              onClick={(e) => handleDeleteReport(report, e)}
                              className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 transition flex items-center space-x-1"
                              title="Delete Report (Admin Only)"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          )}

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

      {/* Report/Transcript Modal Overlay */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8">
          <div className="relative w-full max-w-5xl mx-4">
            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCloseReport();
              }}
              className="fixed top-4 right-4 z-60 p-3 bg-dark-surface/90 hover:bg-dark-surface border border-white/20 rounded-xl text-white hover:text-gold transition shadow-xl group"
              title="Close Report (Back to Reports List)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="absolute top-full right-0 mt-2 px-3 py-1 bg-dark-surface border border-white/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Back to Reports List
              </span>
            </button>

            {/* Loading State */}
            {loadingReport && (
              <div className="glass rounded-2xl p-12 text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-gold border-r-transparent mb-4"></div>
                <p className="text-gray-400">Loading...</p>
              </div>
            )}

            {/* Report Content */}
            {!loadingReport && reportHtml && (
              <div
                className="glass rounded-2xl overflow-hidden shadow-2xl"
                dangerouslySetInnerHTML={{ __html: reportHtml }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsList;
