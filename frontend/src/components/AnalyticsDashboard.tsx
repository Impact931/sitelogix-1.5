import React, { useState, useEffect } from 'react';

interface Manager {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Insights {
  summary: {
    totalDeliveries: number;
    lateDeliveries: number;
    onTimeDeliveryRate: number;
    totalLaborHours: number;
    overtimeHours: number;
    overtimeRate: number;
    openConstraints: number;
    criticalConstraints: number;
    totalReports: number;
  };
  vendors: Array<{
    name: string;
    deliveries: number;
    lateDeliveries: number;
    onTimeRate: string;
  }>;
  alerts: Array<{
    type: string;
    category: string;
    message: string;
    impact: string;
  }>;
}

interface AnalyticsDashboardProps {
  manager: Manager;
  project: Project;
  onBack: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ANALYTICS_API = `${API_BASE_URL}/analytics`;

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
      const response = await fetch(`${ANALYTICS_API}/insights`);

      if (!response.ok) {
        throw new Error(`Analytics API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setInsights(data.insights);
      } else {
        throw new Error(data.error || 'Failed to fetch insights');
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

      const response = await fetch(`${ANALYTICS_API}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      if (data.success) {
        setChatResponse(data.analysis);
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
      const response = await fetch(`${ANALYTICS_API}/reports/${reportType}`);
      const data = await response.json();

      if (data.success) {
        setReportModal({ type: reportType, data: data.report });
        // Clear editing state when opening a new report
        setEditingResolution({});
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
  };

  const saveResolution = async (constraintId: string, resolution: string) => {
    try {
      setSavingResolution(constraintId);
      const response = await fetch(`${ANALYTICS_API}/constraints/${constraintId}/resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${ANALYTICS_API}/constraints/${constraintId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
                {/* Alerts */}
                {insights.alerts.length > 0 && (
                  <div className="glass-gold rounded-2xl p-6 border border-red-500/30">
                    <h2 className="text-lg font-display font-bold text-white mb-4 flex items-center">
                      <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Alerts Requiring Attention
                    </h2>
                    <div className="space-y-3">
                      {insights.alerts.map((alert, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (alert.category === 'Project Risk') {
                              openReport('constraints');
                            } else if (alert.category === 'Vendor Performance') {
                              openReport('deliveries');
                            } else if (alert.category === 'Labor Costs') {
                              openReport('overtime');
                            }
                          }}
                          className="w-full bg-white/5 rounded-lg p-4 hover:bg-white/10 cursor-pointer transition text-left group"
                        >
                          <div className="flex items-start space-x-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              alert.type === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {alert.type.toUpperCase()}
                            </span>
                            <div className="flex-1">
                              <p className="text-white font-semibold text-sm flex items-center">
                                {alert.category}
                                <svg className="w-4 h-4 ml-2 text-gray-500 group-hover:text-gold transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </p>
                              <p className="text-gray-300 text-sm mt-1">{alert.message}</p>
                              <p className="text-gray-500 text-xs mt-1">Impact: {alert.impact}</p>
                              <p className="text-gold text-xs mt-2 group-hover:underline">Click to view detailed report →</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm font-semibold">On-Time Delivery Rate</p>
                      <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                      </svg>
                    </div>
                    <p className="text-3xl font-bold text-white">{insights.summary.onTimeDeliveryRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-2">{insights.summary.totalDeliveries} total deliveries</p>
                  </div>

                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm font-semibold">Overtime Rate</p>
                      <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-3xl font-bold text-white">{insights.summary.overtimeRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-2">{insights.summary.overtimeHours} OT hrs / {insights.summary.totalLaborHours} total</p>
                  </div>

                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm font-semibold">Open Constraints</p>
                      <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-3xl font-bold text-white">{insights.summary.openConstraints}</p>
                    <p className="text-xs text-red-400 mt-2">{insights.summary.criticalConstraints} critical priority</p>
                  </div>

                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm font-semibold">Total Reports</p>
                      <svg className="w-8 h-8 text-gold" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                        <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                    </div>
                    <p className="text-3xl font-bold text-white">{insights.summary.totalReports}</p>
                    <p className="text-xs text-gray-500 mt-2">Generated reports</p>
                  </div>
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

                {/* Vendor Performance */}
                <div className="glass rounded-xl p-6">
                  <h2 className="text-lg font-display font-bold text-white mb-4">Top Vendors by Volume</h2>
                  <div className="space-y-3">
                    {insights.vendors.slice(0, 5).map((vendor, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm">{vendor.name}</p>
                          <p className="text-gray-500 text-xs">{vendor.deliveries} deliveries</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gold font-bold">{vendor.onTimeRate}%</p>
                          <p className="text-gray-500 text-xs">on-time</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setReportModal(null)}>
          <div className="bg-dark-bg rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden glass-gold border border-gold/30" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold text-white">
                {reportModal.type === 'constraints' && '🚧 Constraints Report'}
                {reportModal.type === 'deliveries' && '📦 Delivery Performance Report'}
                {reportModal.type === 'overtime' && '⏰ Overtime Analysis Report'}
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
              {reportModal.type === 'constraints' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-white">{reportModal.data.summary.total}</div>
                      <div className="text-sm text-gray-400">Total Constraints</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-yellow-400">{reportModal.data.summary.open}</div>
                      <div className="text-sm text-gray-400">Open</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-red-400">{reportModal.data.summary.critical}</div>
                      <div className="text-sm text-gray-400">Critical</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-green-400">{reportModal.data.summary.resolved}</div>
                      <div className="text-sm text-gray-400">Resolved</div>
                    </div>
                  </div>

                  {/* Constraints by Type */}
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">By Type</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {reportModal.data.byType.map((type: any, i: number) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3">
                          <div className="text-white font-semibold">{type.type}</div>
                          <div className="text-sm text-gray-400">{type.count} total, {type.critical} critical</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Constraints Table */}
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
                </div>
              )}

              {/* Deliveries Report */}
              {reportModal.type === 'deliveries' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
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

                  {/* Vendor Performance */}
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                      Vendor Performance
                      <span className="ml-3 text-xs text-gray-500 font-normal">Click vendor to view details</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-sm font-semibold text-gray-400 pb-3">Vendor</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">Total</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">On Time</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">Late</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">Early</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">Missing</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">On-Time %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportModal.data.vendors.map((vendor: any, i: number) => (
                            <tr
                              key={i}
                              className="border-b border-white/5 hover:bg-gold/10 cursor-pointer transition"
                              onClick={() => setVendorDetailModal(vendor)}
                            >
                              <td className="py-3 text-sm font-semibold text-white flex items-center">
                                {vendor.name}
                                <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </td>
                              <td className="py-3 text-sm text-gray-300 text-center">{vendor.total}</td>
                              <td className="py-3 text-sm text-green-400 text-center">{vendor.onTime}</td>
                              <td className="py-3 text-sm text-red-400 text-center">{vendor.late}</td>
                              <td className="py-3 text-sm text-blue-400 text-center">{vendor.early}</td>
                              <td className="py-3 text-sm text-orange-400 text-center">{vendor.missing || 0}</td>
                              <td className="py-3 text-sm text-center">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  parseFloat(vendor.onTimeRate) >= 90 ? 'bg-green-500/20 text-green-400' :
                                  parseFloat(vendor.onTimeRate) >= 75 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {vendor.onTimeRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Deliveries */}
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Recent Deliveries</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {reportModal.data.deliveries.slice(0, 20).map((delivery: any, i: number) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition">
                          <div className="flex justify-between items-start mb-1">
                            <div className="text-white font-semibold text-sm">{delivery.vendor}</div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              delivery.status === 'On-Time' ? 'bg-green-500/20 text-green-400' :
                              delivery.status.includes('Late') ? 'bg-red-500/20 text-red-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {delivery.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">{delivery.materials}</div>
                          <div className="text-xs text-gray-500 mt-1">{delivery.date} • {delivery.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Overtime Report */}
              {reportModal.type === 'overtime' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-white">{reportModal.data.summary.totalHours.toFixed(1)}</div>
                      <div className="text-sm text-gray-400">Total Hours</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-blue-400">{reportModal.data.summary.regularHours.toFixed(1)}</div>
                      <div className="text-sm text-gray-400">Regular Hours</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-yellow-400">{reportModal.data.summary.overtimeHours.toFixed(1)}</div>
                      <div className="text-sm text-gray-400">Overtime Hours</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-gold">{reportModal.data.summary.overtimeRate}%</div>
                      <div className="text-sm text-gray-400">OT Rate</div>
                    </div>
                  </div>

                  {/* By Project */}
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Overtime by Project</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-sm font-semibold text-gray-400 pb-3">Project</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">Regular Hrs</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">OT Hrs</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">Total Hrs</th>
                            <th className="text-center text-sm font-semibold text-gray-400 pb-3">OT %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportModal.data.byProject.map((proj: any, i: number) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 text-sm font-semibold text-white">{proj.project}</td>
                              <td className="py-3 text-sm text-blue-400 text-center">{proj.regularHours.toFixed(1)}</td>
                              <td className="py-3 text-sm text-yellow-400 text-center">{proj.overtimeHours.toFixed(1)}</td>
                              <td className="py-3 text-sm text-white text-center">{proj.totalHours.toFixed(1)}</td>
                              <td className="py-3 text-sm text-center">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  parseFloat(proj.overtimeRate) < 10 ? 'bg-green-500/20 text-green-400' :
                                  parseFloat(proj.overtimeRate) < 20 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {proj.overtimeRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setVendorDetailModal(null)}>
          <div className="bg-dark-bg rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden glass-gold border border-gold/30" onClick={(e) => e.stopPropagation()}>
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
