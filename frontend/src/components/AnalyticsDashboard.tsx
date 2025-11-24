import React, { useState, useEffect } from 'react';
import MetricTooltip from './MetricTooltip';

interface Manager {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface ConcernOrWin {
  text: string;
  project_id: string;
  project_name: string;
  report_id: string;
  report_date: string;
}

interface Insights {
  portfolio_health: {
    average_quality_score: number;
    average_schedule_score: number;
    total_active_projects: number;
    projects_at_risk: number;
    overtime_percentage: number;
    total_constraints: number;
  };
  financial_snapshot: {
    total_labor_cost_month: number;
    total_constraint_cost_month: number;
    chargeback_pipeline: number;
    cost_reduction_opportunities: number;
    portfolio_roi: number;
  };
  top_wins: Array<ConcernOrWin | string>; // Support both formats for backward compatibility
  top_concerns: Array<ConcernOrWin | string>;
  urgent_actions: Array<{
    title?: string;
    project?: string;
    savings?: number;
    timeline?: string;
  }>;
  high_priority_actions: Array<{
    title?: string;
    project?: string;
    savings?: number;
    timeline?: string;
  }>;
  projects: Array<{
    project_id: string;
    project_name: string;
    health_score: number;
    quality_score: number;
    schedule_score: number;
    labor_cost_mtd: number;
    constraint_cost_mtd: number;
  }>;
}

interface AnalyticsDashboardProps {
  manager: Manager;
  project: Project | null;
  onBack: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const BI_API = `${API_BASE_URL}/bi`;

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ manager, project, onBack }) => {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat'>('overview');
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [reportModal, setReportModal] = useState<{type: string, data: any} | null>(null);
  const [vendorDetailModal, setVendorDetailModal] = useState<any>(null);
  const [editingResolution, setEditingResolution] = useState<{[key: string]: string}>({});
  const [savingResolution, setSavingResolution] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching executive dashboard from:', `${BI_API}/executive`);

      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${BI_API}/executive`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`BI API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('BI API response:', data);

      if (data.success && data.dashboard) {
        setInsights(data.dashboard);
      } else {
        throw new Error(data.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuery = async (query: string) => {
    setChatQuery(query);
    setActiveTab('chat');
    await submitQuery(query);
  };

  const submitQuery = async (query: string) => {
    try {
      setChatLoading(true);
      setChatResponse('');

      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${BI_API}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      if (data.success && data.ai_response) {
        // Format the AI response
        const aiResp = data.ai_response;
        let responseText = `Query: ${aiResp.query}\n\n`;
        responseText += `Interpretation: ${aiResp.interpretation}\n\n`;
        if (aiResp.suggested_endpoints) {
          responseText += 'Suggested Endpoints:\n';
          aiResp.suggested_endpoints.forEach((endpoint: string) => {
            responseText += `- ${endpoint}\n`;
          });
        }
        setChatResponse(responseText);
      } else {
        setChatResponse(data.error || 'Unable to process query');
      }
    } catch (error) {
      console.error('Error querying analytics:', error);
      setChatResponse('Error: Unable to process query. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatQuery.trim()) {
      submitQuery(chatQuery);
    }
  };

  const openReport = async (reportType: string) => {
    try {
      console.log('Opening report:', reportType);
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${BI_API}/reports/${reportType}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('Report data received:', data);

      if (data.success && data.report) {
        setReportModal({ type: reportType, data: data.report });
        // Clear editing state when opening a new report
        setEditingResolution({});
      } else {
        console.error('Invalid report data:', data);
        setError(`Failed to load ${reportType} report`);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      setError('Failed to load report. Please try again.');
    }
  };

  const saveResolution = async (constraintId: string, resolution: string) => {
    try {
      setSavingResolution(constraintId);
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${BI_API}/constraints/${constraintId}/resolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          resolution,
          updatedBy: manager.name
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update the constraint in the modal data
        if (reportModal?.data?.constraints) {
          const updatedConstraints = reportModal.data.constraints.map((c: any) =>
            c.id === constraintId ? { ...c, resolution } : c
          );
          setReportModal({
            ...reportModal,
            data: { ...reportModal.data, constraints: updatedConstraints }
          });
        }
        // Clear editing state
        const newEditing = { ...editingResolution };
        delete newEditing[constraintId];
        setEditingResolution(newEditing);
      }
    } catch (error) {
      console.error('Error saving resolution:', error);
      alert('Failed to save resolution. Please try again.');
    } finally {
      setSavingResolution(null);
    }
  };

  const updateConstraintStatus = async (constraintId: string, newStatus: string) => {
    try {
      setUpdatingStatus(constraintId);
      const accessToken = localStorage.getItem('accessToken');
      const response = await fetch(`${BI_API}/constraints/${constraintId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          status: newStatus,
          updatedBy: manager.name
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update the constraint in the modal data
        if (reportModal?.data?.constraints) {
          const updatedConstraints = reportModal.data.constraints.map((c: any) =>
            c.id === constraintId ? { ...c, status: newStatus } : c
          );

          // Recalculate summary counts
          const open = updatedConstraints.filter((c: any) => c.status !== 'Resolved').length;
          const resolved = updatedConstraints.filter((c: any) => c.status === 'Resolved').length;

          setReportModal({
            ...reportModal,
            data: {
              ...reportModal.data,
              summary: {
                ...reportModal.data.summary,
                open,
                resolved
              },
              constraints: updatedConstraints
            }
          });
        }
        // Refresh insights to update dashboard
        fetchInsights();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const formatAnalysisResponse = (text: string) => {
    const lines = text.split('\n');
    const sections: any[] = [];
    let currentSection: any = null;
    let currentList: string[] = [];

    lines.forEach((line) => {
      // BLUF Section
      if (line.includes('**BLUF**') || line.includes('BLUF:')) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          type: 'bluf',
          content: line.replace(/\*\*/g, '').replace('BLUF:', '').trim()
        };
      }
      // Main headings (numbered sections)
      else if (/^\d+\.\s\*\*/.test(line)) {
        if (currentList.length > 0) {
          if (currentSection) currentSection.items = [...currentList];
          currentList = [];
        }
        if (currentSection) sections.push(currentSection);
        currentSection = {
          type: 'section',
          title: line.replace(/^\d+\.\s/, '').replace(/\*\*/g, '').replace(':**', '').trim(),
          items: []
        };
      }
      // Sub-headings
      else if (line.includes('**Observation**') || line.includes('**Recommendation**') || line.includes('**Urgent Issues**') || line.includes('**Opportunities**')) {
        if (currentList.length > 0 && currentSection) {
          currentSection.items.push({ type: 'list', items: [...currentList] });
          currentList = [];
        }
        const subheading = line.replace(/\s*-\s*/, '').replace(/\*\*/g, '').replace(':**', ':').trim();
        if (currentSection) {
          currentSection.items.push({ type: 'subheading', text: subheading });
        }
      }
      // List items
      else if (/^\s*[-•]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
        const item = line.replace(/^\s*[-•]\s/, '').replace(/^\s*\d+\.\s/, '').trim();
        currentList.push(item);
      }
      // Regular text
      else if (line.trim() && !line.includes('**')) {
        if (currentList.length > 0 && currentSection) {
          currentSection.items.push({ type: 'list', items: [...currentList] });
          currentList = [];
        }
        if (currentSection) {
          currentSection.items.push({ type: 'text', content: line.trim() });
        }
      }
    });

    if (currentList.length > 0 && currentSection) {
      currentSection.items.push({ type: 'list', items: [...currentList] });
    }
    if (currentSection) sections.push(currentSection);

    return sections;
  };

  const quickQueries = [
    { label: 'Delivery Performance', query: 'Analyze delivery performance and identify vendors with the most delays', reportType: 'deliveries' },
    { label: 'Overtime Trends', query: 'Show overtime patterns and recommend cost reduction strategies', reportType: 'overtime' },
    { label: 'Top Constraints', query: 'What are the top constraints impacting our projects and how do we resolve them?', reportType: 'constraints' },
    { label: 'Cost Savings', query: 'Identify the top 3 cost reduction opportunities based on current data', reportType: null },
  ];

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Analytics Dashboard</h1>
              <p className="text-gray-400 text-sm mt-1 font-medium">
                {manager.name} • {project?.name || 'All Projects'}
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex space-x-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-gold text-dark-bg'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'chat'
                  ? 'bg-gold text-dark-bg'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              💬 CFO Assistant
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-gold border-r-transparent mb-4"></div>
            <p className="text-gray-400">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="glass-gold rounded-2xl p-8 max-w-md mx-auto border border-red-500/30">
              <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-display font-bold text-white mb-2">Unable to Load Analytics</h3>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={fetchInsights}
                className="px-6 py-3 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && insights && (
              <div className="space-y-6">
                {/* Top Concerns */}
                {insights.top_concerns && insights.top_concerns.length > 0 && (
                  <div className="glass-gold rounded-2xl p-6 border border-red-500/30">
                    <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Top Concerns Requiring Attention
                    </h2>
                    <div className="space-y-3">
                      {insights.top_concerns.slice(0, 5).map((concern, index) => {
                        const isObject = typeof concern === 'object' && concern !== null;
                        const concernText = isObject ? (concern as ConcernOrWin).text : concern;
                        const concernData = isObject ? (concern as ConcernOrWin) : null;

                        return (
                          <div
                            key={index}
                            className="w-full bg-white/5 rounded-lg p-4 text-left hover:bg-white/10 transition group"
                          >
                            <div className="flex items-start space-x-3">
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400 flex-shrink-0">
                                CONCERN
                              </span>
                              <div className="flex-1">
                                <p className="text-gray-300 text-sm">{concernText}</p>
                                {concernData && concernData.report_id && (
                                  <button
                                    onClick={() => {
                                      const url = `${API_BASE_URL}/reports/${concernData.report_id}/html?projectId=${concernData.project_id}&reportDate=${concernData.report_date}`;
                                      window.open(url, '_blank');
                                    }}
                                    className="mt-2 flex items-center space-x-1 text-gold hover:text-gold-light transition text-xs"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="underline">View Source Report</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* KPI Cards - Executive Dashboard with Tooltips */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Labor Costs */}
                  <MetricTooltip
                    title="Labor Costs (Month-to-Date)"
                    explanation="Total cost of all labor hours worked across all projects this month, including regular time, overtime, and double-time."
                    calculation="Sum of (Hours × Hourly Rate) for all personnel across all projects"
                    source="Hours summaries from daily reports"
                  >
                    <div className="glass rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-semibold">Labor Costs (MTD)</p>
                        <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-white">${(insights.financial_snapshot.total_labor_cost_month / 1000).toFixed(0)}k</p>
                      <p className="text-xs text-gray-500 mt-2">{insights.portfolio_health.total_active_projects} active projects</p>
                    </div>
                  </MetricTooltip>

                  {/* Overtime Percentage */}
                  <MetricTooltip
                    title="Overtime Percentage"
                    explanation="Percentage of total hours worked that are overtime or double-time. High overtime indicates potential schedule pressure or understaffing."
                    calculation="(OT Hours + DT Hours) / Total Hours × 100"
                    goodRange="< 15% is healthy for construction projects"
                    source="Hours summaries from daily reports"
                  >
                    <div className="glass rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-semibold">Overtime %</p>
                        <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-white">{insights.portfolio_health.overtime_percentage}%</p>
                      <p className={`text-xs mt-2 ${insights.portfolio_health.overtime_percentage < 15 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {insights.portfolio_health.overtime_percentage < 15 ? 'Within healthy range' : 'Monitor closely'}
                      </p>
                    </div>
                  </MetricTooltip>

                  {/* Active Constraints */}
                  <MetricTooltip
                    title="Active Constraints"
                    explanation="Total number of active issues, delays, coordination problems, and technical constraints identified across all projects. Each constraint represents a potential risk to schedule or budget."
                    source="Constraints identified in daily reports"
                  >
                    <div className="glass rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-semibold">Active Constraints</p>
                        <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-white">{insights.portfolio_health.total_constraints}</p>
                      <p className="text-xs text-gray-500 mt-2">Issues requiring resolution</p>
                    </div>
                  </MetricTooltip>

                  {/* Constraint Costs */}
                  <MetricTooltip
                    title="Constraint Cost Impact"
                    explanation="Total estimated cost impact of all active constraints and issues across the portfolio. Includes delays, rework, coordination problems, and technical issues."
                    source="Cost impacts from constraint records"
                  >
                    <div className="glass rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-semibold">Constraint Costs</p>
                        <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-white">${(insights.financial_snapshot.total_constraint_cost_month / 1000).toFixed(0)}k</p>
                      <p className="text-xs text-red-400 mt-2">Month-to-date impact</p>
                    </div>
                  </MetricTooltip>
                </div>

                {/* Quick Queries */}
                <div className="glass rounded-xl p-6">
                  <h2 className="text-lg font-display font-bold text-white mb-4">Quick Insights</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quickQueries.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => item.reportType ? openReport(item.reportType) : handleQuickQuery(item.query)}
                        className="text-left p-4 bg-white/5 rounded-lg hover:bg-white/10 transition group"
                      >
                        <p className="text-white font-semibold text-sm group-hover:text-gold transition">{item.label}</p>
                        <p className="text-gray-500 text-xs mt-1">{item.reportType ? 'View detailed report' : 'AI analysis'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Health Summary */}
                <div className="glass rounded-xl p-6">
                  <h2 className="text-lg font-display font-bold text-white mb-4">Active Projects</h2>
                  {insights.projects && insights.projects.length > 0 ? (
                    <div className="space-y-3">
                      {insights.projects.slice(0, 5).map((project, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div className="flex-1">
                            <p className="text-white font-semibold text-sm">{project.project_name}</p>
                            <p className="text-gray-500 text-xs">Quality: {project.quality_score} | Schedule: {project.schedule_score}</p>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              project.health_score >= 80 ? 'text-green-400' :
                              project.health_score >= 70 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {project.health_score}
                            </div>
                            <p className="text-gray-500 text-xs">health</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-gray-400 text-sm">No project data available yet</p>
                      <p className="text-gray-500 text-xs mt-1">Create reports to see project health analytics</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CFO Chat Tab */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                {/* Chat Interface */}
                <div className="glass rounded-2xl p-6">
                  <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 text-gold mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    CFO Analytics Assistant
                  </h2>
                  <p className="text-gray-400 text-sm mb-6">Ask me anything about your construction data - delivery performance, costs, labor trends, vendor analysis, and more.</p>

                  <form onSubmit={handleChatSubmit} className="mb-6">
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        value={chatQuery}
                        onChange={(e) => setChatQuery(e.target.value)}
                        placeholder="e.g., 'Which vendors are underperforming?' or 'Show overtime cost trends'"
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold transition"
                        disabled={chatLoading}
                      />
                      <button
                        type="submit"
                        disabled={chatLoading || !chatQuery.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-gold-light to-gold-dark rounded-xl text-dark-bg font-semibold hover:opacity-90 transition disabled:opacity-50"
                      >
                        {chatLoading ? 'Analyzing...' : 'Ask'}
                      </button>
                    </div>
                  </form>

                  {/* Response */}
                  {chatLoading && (
                    <div className="bg-white/5 rounded-xl p-6">
                      <div className="flex items-center space-x-3">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-gold border-r-transparent"></div>
                        <p className="text-gray-400 text-sm">Analyzing data with GPT-4o...</p>
                      </div>
                    </div>
                  )}

                  {chatResponse && !chatLoading && (
                    <div className="glass rounded-xl overflow-hidden border border-gold/20">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-gold/20 to-gold/10 border-b border-gold/20 px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-gold-light to-gold-dark rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-dark-bg" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-gold font-display font-bold text-lg">CFO Analysis</p>
                            <p className="text-gray-400 text-xs">Powered by GPT-4o</p>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 space-y-6">
                        {formatAnalysisResponse(chatResponse).map((section, idx) => (
                          <div key={idx}>
                            {/* BLUF Section */}
                            {section.type === 'bluf' && (
                              <div className="bg-gradient-to-r from-gold/20 to-gold/10 rounded-xl p-6 border-l-4 border-gold">
                                <div className="flex items-start space-x-3">
                                  <svg className="w-6 h-6 text-gold flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                  <div>
                                    <p className="text-gold font-bold text-sm uppercase tracking-wide mb-2">Bottom Line Up Front</p>
                                    <p className="text-white text-base leading-relaxed">{section.content}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Main Section */}
                            {section.type === 'section' && (
                              <div className="bg-white/5 rounded-xl p-6 hover:bg-white/10 transition">
                                <h3 className="text-white font-display font-bold text-lg mb-4 flex items-center">
                                  <span className="w-8 h-8 bg-gold/20 rounded-lg flex items-center justify-center text-gold font-bold text-sm mr-3">
                                    {idx}
                                  </span>
                                  {section.title}
                                </h3>
                                <div className="ml-11 space-y-4">
                                  {section.items?.map((item: any, itemIdx: number) => (
                                    <div key={itemIdx}>
                                      {/* Subheading */}
                                      {item.type === 'subheading' && (
                                        <p className="text-gold font-semibold text-sm mb-2 flex items-center">
                                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                          </svg>
                                          {item.text}
                                        </p>
                                      )}

                                      {/* List */}
                                      {item.type === 'list' && (
                                        <ul className="space-y-2">
                                          {item.items.map((listItem: string, listIdx: number) => (
                                            <li key={listIdx} className="flex items-start text-gray-300 text-sm leading-relaxed">
                                              <span className="w-1.5 h-1.5 bg-gold rounded-full mr-3 mt-2 flex-shrink-0"></span>
                                              <span>{listItem}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}

                                      {/* Text */}
                                      {item.type === 'text' && (
                                        <p className="text-gray-300 text-sm leading-relaxed">{item.content}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setReportModal(null)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold text-white">
                {reportModal.type === 'constraints' && '🚧 Constraints Report'}
                {reportModal.type === 'deliveries' && '📦 Delivery Performance Report'}
                {reportModal.type === 'overtime' && '⏰ Overtime Analysis Report'}
                {reportModal.type === 'savings' && '💰 Cost Savings Analysis'}
              </h2>
              <button
                onClick={() => setReportModal(null)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Constraints Report */}
              {reportModal.type === 'constraints' && reportModal.data && (
                <div className="space-y-6">
                  {/* Explanation */}
                  {reportModal.data.summary?.explanation && (
                    <div className="glass rounded-xl p-4 bg-gold/10 border border-gold/30">
                      <p className="text-sm text-white">{reportModal.data.summary.explanation}</p>
                    </div>
                  )}

                  {/* Summary Cards */}
                  {reportModal.data.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="glass rounded-xl p-4">
                        <div className="text-2xl font-bold text-white">{reportModal.data.summary.total_constraints || 0}</div>
                        <div className="text-sm text-gray-400">Total Constraints</div>
                      </div>
                      <div className="glass rounded-xl p-4">
                        <div className="text-2xl font-bold text-yellow-400">{reportModal.data.summary.active || 0}</div>
                        <div className="text-sm text-gray-400">Active</div>
                      </div>
                      <div className="glass rounded-xl p-4">
                        <div className="text-2xl font-bold text-green-400">{reportModal.data.summary.resolved || 0}</div>
                        <div className="text-sm text-gray-400">Resolved</div>
                      </div>
                      <div className="glass rounded-xl p-4">
                        <div className="text-2xl font-bold text-red-400">${(reportModal.data.summary.total_cost_impact || 0).toLocaleString()}</div>
                        <div className="text-sm text-gray-400">Total Cost Impact</div>
                      </div>
                    </div>
                  )}

                  {/* Constraints by Project */}
                  {reportModal.data.by_project && reportModal.data.by_project.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">Constraints by Project</h3>
                      {reportModal.data.by_project.map((proj: any, projIdx: number) => (
                        <div key={projIdx} className="glass rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-white font-bold text-lg">{proj.project_name}</h4>
                            <div className="flex items-center space-x-4">
                              <span className="text-sm text-gray-400">{proj.total_constraints} constraints</span>
                              <span className="text-sm text-red-400 font-semibold">${(proj.total_cost_impact || 0).toLocaleString()} impact</span>
                            </div>
                          </div>

                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {proj.constraints && proj.constraints.map((constraint: any, i: number) => (
                              <div
                                key={i}
                                className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-start space-x-3 flex-1">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
                                      constraint.category === 'design' ? 'bg-purple-500/20 text-purple-400' :
                                      constraint.category === 'coordination' ? 'bg-blue-500/20 text-blue-400' :
                                      constraint.category === 'equipment' ? 'bg-orange-500/20 text-orange-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {constraint.category}
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-white text-sm">{constraint.description}</p>
                                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                        <span>{constraint.date}</span>
                                        {constraint.total_cost_impact > 0 && (
                                          <span className="text-red-400 font-semibold">${constraint.total_cost_impact.toLocaleString()} impact</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ml-3 ${
                                    constraint.resolution_status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {constraint.resolution_status}
                                  </span>
                                </div>

                                {constraint.report_id && (
                                  <button
                                    onClick={() => {
                                      const url = `${API_BASE_URL}/reports/${constraint.report_id}/html?projectId=${proj.project_id}&reportDate=${constraint.date}`;
                                      window.open(url, '_blank');
                                    }}
                                    className="mt-2 flex items-center space-x-1 text-gold hover:text-gold-light transition text-xs"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="underline">View Source Report</span>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Constraints by Type */}
                  {reportModal.data.byType && reportModal.data.byType.length > 0 && (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">By Type</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {reportModal.data.byType.map((type: any, i: number) => (
                          <div key={i} className="bg-white/5 rounded-lg p-3">
                            <div className="text-white font-semibold">{type.type || 'Unknown'}</div>
                            <div className="text-sm text-gray-400">{type.count || 0} total, {type.critical || 0} critical</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Constraints Table */}
                  {reportModal.data.constraints && reportModal.data.constraints.length > 0 ? (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">All Constraints - High Priority First</h3>
                      <div className="space-y-2">
                        {reportModal.data.constraints
                        .sort((a: any, b: any) => {
                          // Sort by severity: High > Medium > Low
                          const severityOrder: any = { 'high': 3, 'medium': 2, 'low': 1 };
                          const aSev = severityOrder[a.severity?.toLowerCase()] || 0;
                          const bSev = severityOrder[b.severity?.toLowerCase()] || 0;
                          return bSev - aSev;
                        })
                        .map((constraint: any, i: number) => {
                          const currentValue = editingResolution[constraint.id] !== undefined
                            ? editingResolution[constraint.id]
                            : (constraint.resolution || '');
                          const hasChanges = editingResolution[constraint.id] !== undefined
                            && editingResolution[constraint.id] !== (constraint.resolution || '');

                          return (
                        <div
                          key={constraint.id || i}
                          className={`glass rounded-lg p-4 hover:bg-white/10 transition ${
                            constraint.severity?.toLowerCase() === 'high' ? 'border-l-4 border-red-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start space-x-3 flex-1">
                              <span className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
                                constraint.severity?.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-400' :
                                constraint.severity?.toLowerCase() === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {constraint.severity || 'N/A'}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-white font-semibold text-sm">{constraint.type || 'General'}</span>
                                  <span className="text-gray-500 text-xs">•</span>
                                  <span className="text-gray-400 text-xs">{constraint.date}</span>
                                </div>
                                <p className="text-white text-sm">{constraint.description}</p>
                              </div>
                            </div>
                            <select
                              value={constraint.status}
                              onChange={(e) => updateConstraintStatus(constraint.id, e.target.value)}
                              disabled={updatingStatus === constraint.id}
                              className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ml-3 border-0 cursor-pointer transition ${
                                constraint.status === 'Resolved' ? 'bg-green-500/20 text-green-400' :
                                constraint.status === 'Active' ? 'bg-yellow-500/20 text-yellow-400' :
                                constraint.status === 'Under Repair' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}
                            >
                              <option value="Active" className="bg-dark-bg text-white">Active</option>
                              <option value="Ongoing" className="bg-dark-bg text-white">Ongoing</option>
                              <option value="Under Repair" className="bg-dark-bg text-white">Under Repair</option>
                              <option value="Resolved" className="bg-dark-bg text-white">Resolved</option>
                            </select>
                          </div>

                          {/* Additional Details */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center space-x-4 text-xs">
                              {constraint.supervisor && (
                                <div className="flex items-center space-x-1">
                                  <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-gray-400">Supervisor:</span>
                                  <span className="text-white font-semibold">{constraint.supervisor.name}</span>
                                </div>
                              )}
                              {constraint.reportId && constraint.projectId && constraint.reportDate && (
                                <a
                                  href="#"
                                  className="flex items-center space-x-1 text-gold hover:text-gold-light transition"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const url = `${API_BASE_URL}/reports/${constraint.reportId}/html?projectId=${constraint.projectId}&reportDate=${constraint.reportDate}`;
                                    window.open(url, '_blank');
                                  }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="underline">View Source Report</span>
                                </a>
                              )}
                            </div>
                            {constraint.reportedBy && (
                              <span className="text-gray-500 text-xs">Reported by: {constraint.reportedBy}</span>
                            )}
                          </div>

                          {/* Resolution Section */}
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-semibold text-gold flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Resolution / Action Taken
                              </label>
                            </div>
                            <textarea
                              value={currentValue}
                              onChange={(e) => setEditingResolution({
                                ...editingResolution,
                                [constraint.id]: e.target.value
                              })}
                              placeholder="Enter resolution notes or steps taken to address this issue..."
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 min-h-[80px]"
                              disabled={savingResolution === constraint.id}
                            />
                            {hasChanges && (
                              <div className="flex items-center space-x-2 mt-2">
                                <button
                                  onClick={() => saveResolution(constraint.id, editingResolution[constraint.id])}
                                  disabled={savingResolution === constraint.id}
                                  className="px-4 py-2 bg-gold hover:bg-gold-light text-dark-bg font-semibold rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingResolution === constraint.id ? 'Saving...' : 'Save Resolution'}
                                </button>
                                <button
                                  onClick={() => {
                                    const newEditing = { ...editingResolution };
                                    delete newEditing[constraint.id];
                                    setEditingResolution(newEditing);
                                  }}
                                  disabled={savingResolution === constraint.id}
                                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                          );
                        })}
                    </div>
                  </div>
                  ) : (
                    <div className="glass rounded-xl p-12 text-center">
                      <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-white mb-2">No Constraints Found</h3>
                      <p className="text-gray-400">There are no constraints recorded in your reports yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Deliveries Report */}
              {reportModal.type === 'deliveries' && reportModal.data && (
                <div className="space-y-6">
                  {/* Check if no data available */}
                  {reportModal.data.status === 'no_data' ? (
                    <div className="glass rounded-xl p-12 text-center">
                      <svg className="w-20 h-20 text-gray-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <h3 className="text-2xl font-semibold text-white mb-3">{reportModal.data.message}</h3>
                      <p className="text-gray-400 mb-6 max-w-2xl mx-auto">{reportModal.data.explanation}</p>

                      {reportModal.data.placeholder_data?.planned_metrics && (
                        <div className="bg-white/5 rounded-xl p-6 max-w-xl mx-auto">
                          <h4 className="text-white font-semibold mb-4">Planned Metrics (Future):</h4>
                          <ul className="space-y-2 text-left">
                            {reportModal.data.placeholder_data.planned_metrics.map((metric: string, i: number) => (
                              <li key={i} className="flex items-start space-x-2 text-sm text-gray-300">
                                <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>{metric}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Summary Cards - Only show if data exists */}
                      {reportModal.data.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div className="glass rounded-xl p-4">
                            <div className="text-2xl font-bold text-white">{reportModal.data.summary.total}</div>
                            <div className="text-sm text-gray-400">Total Deliveries</div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <div className="text-2xl font-bold text-green-400">{reportModal.data.summary.onTime}</div>
                            <div className="text-sm text-gray-400">On Time</div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <div className="text-2xl font-bold text-red-400">{reportModal.data.summary.late}</div>
                            <div className="text-sm text-gray-400">Late</div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <div className="text-2xl font-bold text-blue-400">{reportModal.data.summary.early}</div>
                            <div className="text-sm text-gray-400">Early</div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <div className="text-2xl font-bold text-orange-400">{reportModal.data.summary.missing || 0}</div>
                            <div className="text-sm text-gray-400">Missing/Incomplete</div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <div className="text-2xl font-bold text-gold">{reportModal.data.summary.onTimeRate}%</div>
                            <div className="text-sm text-gray-400">On-Time Rate</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Overtime Report */}
              {reportModal.type === 'overtime' && reportModal.data && (
                <div className="space-y-6">
                  {/* Explanation */}
                  {reportModal.data.summary?.explanation && (
                    <div className="glass rounded-xl p-4 bg-gold/10 border border-gold/30">
                      <p className="text-sm text-white">{reportModal.data.summary.explanation}</p>
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-white">{reportModal.data.summary?.total_hours?.toFixed(1) || 0}</div>
                      <div className="text-sm text-gray-400">Total Hours</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-blue-400">{reportModal.data.summary?.regular_hours?.toFixed(1) || 0}</div>
                      <div className="text-sm text-gray-400">Regular Hours</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-yellow-400">{reportModal.data.summary?.overtime_hours?.toFixed(1) || 0}</div>
                      <div className="text-sm text-gray-400">Overtime Hours</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-gold">{reportModal.data.summary?.overtime_percentage || 0}%</div>
                      <div className="text-sm text-gray-400">OT Rate</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-red-400">${(reportModal.data.summary?.overtime_cost_impact || 0).toLocaleString()}</div>
                      <div className="text-sm text-gray-400">OT Cost Impact</div>
                    </div>
                  </div>

                  {/* By Project */}
                  {reportModal.data.by_project && reportModal.data.by_project.length > 0 && (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Overtime by Project</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left text-sm font-semibold text-gray-400 pb-3">Project</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">Status</th>
                              <th className="text-left text-sm font-semibold text-gray-400 pb-3">Location</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">Type</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">Regular Hrs</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">OT Hrs</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">Total Hrs</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">OT %</th>
                              <th className="text-center text-sm font-semibold text-gray-400 pb-3">Cost Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportModal.data.by_project.map((proj: any, i: number) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 text-sm font-semibold text-white">{proj.project_name}</td>
                                <td className="py-3 text-sm text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    proj.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                    proj.status === 'completed' ? 'bg-gray-500/20 text-gray-400' :
                                    proj.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
                                    proj.status === 'planning' ? 'bg-blue-500/20 text-blue-400' :
                                    proj.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                                    proj.status === 'Complete' ? 'bg-gray-500/20 text-gray-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {proj.status === 'active' ? 'Active' :
                                     proj.status === 'completed' ? 'Complete' :
                                     proj.status === 'on_hold' ? 'On-Hold' :
                                     proj.status === 'planning' ? 'Planning' :
                                     proj.status || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-3 text-sm text-gray-300">{proj.location || 'N/A'}</td>
                                <td className="py-3 text-sm text-gray-400 text-center">{proj.project_type || 'N/A'}</td>
                                <td className="py-3 text-sm text-blue-400 text-center">{proj.regular_hours?.toFixed(1)}</td>
                                <td className="py-3 text-sm text-yellow-400 text-center">{proj.overtime_hours?.toFixed(1)}</td>
                                <td className="py-3 text-sm text-white text-center">{proj.total_hours?.toFixed(1)}</td>
                                <td className="py-3 text-sm text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    parseFloat(proj.overtime_percentage) < 10 ? 'bg-green-500/20 text-green-400' :
                                    parseFloat(proj.overtime_percentage) < 15 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                  }`}>
                                    {proj.overtime_percentage}%
                                  </span>
                                </td>
                                <td className="py-3 text-sm text-red-400 text-center">${(proj.overtime_cost_impact || 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {reportModal.data.recommendations && reportModal.data.recommendations.length > 0 && (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Recommendations</h3>
                      <ul className="space-y-2">
                        {reportModal.data.recommendations.map((rec: string, i: number) => (
                          <li key={i} className="flex items-start space-x-2 text-sm text-gray-300">
                            <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Cost Savings Report */}
              {reportModal.type === 'savings' && reportModal.data && (
                <div className="space-y-6">
                  {/* Explanation */}
                  {reportModal.data.summary?.explanation && (
                    <div className="glass rounded-xl p-4 bg-gold/10 border border-gold/30">
                      <p className="text-sm text-white">{reportModal.data.summary.explanation}</p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-green-400">${(reportModal.data.summary?.total_identified_savings || 0).toLocaleString()}</div>
                      <div className="text-sm text-gray-400">Identified Savings</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-red-400">${(reportModal.data.summary?.total_constraint_costs || 0).toLocaleString()}</div>
                      <div className="text-sm text-gray-400">Constraint Costs</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-blue-400">${(reportModal.data.summary?.total_labor_cost_mtd || 0).toLocaleString()}</div>
                      <div className="text-sm text-gray-400">Labor Costs (MTD)</div>
                    </div>
                  </div>

                  {/* High Cost Areas */}
                  {reportModal.data.high_cost_areas && reportModal.data.high_cost_areas.length > 0 && (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">High Cost Projects</h3>
                      <div className="space-y-2">
                        {reportModal.data.high_cost_areas.map((area: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <span className="text-white font-semibold text-sm">{area.project_name}</span>
                            <span className="text-lg font-bold text-red-400">${(area.total_cost || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cost Breakdown */}
                  {reportModal.data.cost_breakdown && (
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Cost Breakdown</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <span className="text-gray-300 text-sm">Labor Costs</span>
                          <span className="text-white font-bold">${(reportModal.data.cost_breakdown.labor_costs || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <span className="text-gray-300 text-sm">Constraint/Issue Costs</span>
                          <span className="text-red-400 font-bold">${(reportModal.data.cost_breakdown.constraint_costs || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <span className="text-gray-300 text-sm">Potential Savings</span>
                          <span className="text-green-400 font-bold">${(reportModal.data.cost_breakdown.potential_savings || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end">
              <button
                onClick={() => setReportModal(null)}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Detail Modal */}
      {vendorDetailModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4 backdrop-blur-sm" onClick={() => setVendorDetailModal(null)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-display font-bold text-white">{vendorDetailModal.name}</h2>
                <p className="text-gray-400 text-sm mt-1">Delivery History & Performance</p>
              </div>
              <button
                onClick={() => setVendorDetailModal(null)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div className="glass rounded-lg p-3">
                  <div className="text-lg font-bold text-white">{vendorDetailModal.total}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-lg font-bold text-green-400">{vendorDetailModal.onTime}</div>
                  <div className="text-xs text-gray-400">On Time</div>
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-lg font-bold text-red-400">{vendorDetailModal.late}</div>
                  <div className="text-xs text-gray-400">Late</div>
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-400">{vendorDetailModal.early}</div>
                  <div className="text-xs text-gray-400">Early</div>
                </div>
                <div className="glass rounded-lg p-3">
                  <div className="text-lg font-bold text-orange-400">{vendorDetailModal.missing || 0}</div>
                  <div className="text-xs text-gray-400">Missing</div>
                </div>
              </div>

              {/* Deliveries List */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold mb-3">All Deliveries</h3>
                {vendorDetailModal.deliveries?.map((delivery: any, i: number) => (
                  <div key={i} className="glass rounded-lg p-4 hover:bg-white/10 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-semibold text-sm">{delivery.materials}</div>
                        <div className="text-gray-400 text-xs mt-1">
                          {delivery.date} {delivery.time && `• ${delivery.time}`}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
                        delivery.status === 'On-Time' ? 'bg-green-500/20 text-green-400' :
                        delivery.status?.toLowerCase().includes('late') ? 'bg-red-500/20 text-red-400' :
                        delivery.status?.toLowerCase().includes('early') ? 'bg-blue-500/20 text-blue-400' :
                        delivery.status?.toLowerCase().includes('missing') ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {delivery.status}
                      </span>
                    </div>
                    {delivery.notes && (
                      <div className="text-gray-400 text-xs bg-white/5 rounded p-2 mt-2">
                        <span className="font-semibold">Notes:</span> {delivery.notes}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>Project: {delivery.project}</span>
                      {delivery.receivedBy && <span>Received by: {delivery.receivedBy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end">
              <button
                onClick={() => setVendorDetailModal(null)}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
