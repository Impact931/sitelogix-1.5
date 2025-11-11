import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface PayrollEntry {
  entry_id: string;
  report_id: string;
  employee_id: string;
  employee_number: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  report_date: string;
  regular_hours: number;
  overtime_hours: number;
  double_time_hours: number;
  total_hours: number;
  total_cost: number;
  hourly_rate: number;
  overtime_rate: number;
  double_time_rate: number;
  arrival_time?: string;
  departure_time?: string;
  activities?: string;
  employee_specific_issues?: string;
  needs_review?: boolean;
  created_at: string;
}

interface DailyReport {
  date: string;
  totalEmployees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalDoubleTimeHours: number;
  totalHours: number;
  totalCost: number;
  entries: PayrollEntry[];
}

interface PayrollDashboardProps {
  onClose: () => void;
}

const PayrollDashboard: React.FC<PayrollDashboardProps> = ({ onClose }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'review'>('daily');
  const [entriesNeedingReview, setEntriesNeedingReview] = useState<PayrollEntry[]>([]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyReport();
    } else {
      fetchEntriesNeedingReview();
    }
  }, [selectedDate, activeTab]);

  const fetchDailyReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/payroll/report/daily/${selectedDate}`);

      if (!response.ok) {
        // Network or HTTP error
        setError('Failed to fetch payroll data');
        setDailyReport(null);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setDailyReport(data.data);
      } else {
        // API returned error - treat as empty data rather than error
        setDailyReport(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch daily report');
      setDailyReport(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntriesNeedingReview = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/payroll/review`);
      const data = await response.json();

      if (data.success) {
        setEntriesNeedingReview(data.data.entries || []);
      } else {
        setError(data.error || 'Failed to fetch entries needing review');
        setEntriesNeedingReview([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch entries needing review');
      setEntriesNeedingReview([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/payroll/export/daily/${selectedDate}`);

      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }

      const csvText = await response.text();

      // Create download link
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-${selectedDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error exporting CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleMarkAsReviewed = async (entryId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/payroll/${entryId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true })
      });

      const data = await response.json();

      if (data.success) {
        fetchEntriesNeedingReview();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to mark as reviewed'}`);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Payroll Dashboard</h1>
              <p className="text-gray-400 text-sm mt-1">View and export daily payroll reports</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="glass rounded-xl p-2 mb-6 flex space-x-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${
              activeTab === 'daily'
                ? 'bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg'
                : 'text-white hover:bg-white/5'
            }`}
          >
            Daily Report
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-4 py-2 rounded-lg transition font-medium relative ${
              activeTab === 'review'
                ? 'bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg'
                : 'text-white hover:bg-white/5'
            }`}
          >
            Needs Review
            {entriesNeedingReview.length > 0 && (
              <span className="absolute -top-1 -right-1 px-2 py-1 bg-red-500 rounded-full text-xs">
                {entriesNeedingReview.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 glass rounded-xl p-4 border border-red-500/30">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Daily Report Tab */}
        {activeTab === 'daily' && (
          <>
            {/* Controls */}
            <div className="glass rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-400">Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <button
                  onClick={handleExportCSV}
                  disabled={!dailyReport || dailyReport.entries.length === 0}
                  className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="glass rounded-xl p-12 text-center">
                <p className="text-gray-400">Loading payroll data...</p>
              </div>
            ) : dailyReport ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="glass rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">Employees</p>
                    <p className="text-2xl font-bold text-white">{dailyReport.totalEmployees}</p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">Regular Hrs</p>
                    <p className="text-2xl font-bold text-white">{dailyReport.totalRegularHours.toFixed(1)}</p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">OT Hrs</p>
                    <p className="text-2xl font-bold text-white">{dailyReport.totalOvertimeHours.toFixed(1)}</p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">DT Hrs</p>
                    <p className="text-2xl font-bold text-white">{dailyReport.totalDoubleTimeHours.toFixed(1)}</p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-gray-400 text-sm mb-1">Total Cost</p>
                    <p className="text-2xl font-bold text-green-400">${dailyReport.totalCost.toFixed(2)}</p>
                  </div>
                </div>

                {/* Payroll Entries */}
                <div className="glass rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Employee</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Emp #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Project</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Regular</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">OT</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">DT</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Total Hrs</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Issues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {dailyReport.entries.map((entry) => (
                          <tr key={entry.entry_id} className="hover:bg-white/5 transition">
                            <td className="px-4 py-3 text-sm text-white font-medium">{entry.employee_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{entry.employee_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{entry.project_name}</td>
                            <td className="px-4 py-3 text-sm text-white text-right">{entry.regular_hours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-white text-right">{entry.overtime_hours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-white text-right">{entry.double_time_hours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-white text-right font-medium">{entry.total_hours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-green-400 text-right font-medium">${entry.total_cost.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                              {entry.employee_specific_issues || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {dailyReport.entries.length === 0 && (
                    <div className="p-12 text-center">
                      <p className="text-gray-400">No payroll entries for this date</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="glass rounded-xl p-12 text-center">
                <p className="text-gray-400">No payroll data available for selected date</p>
              </div>
            )}
          </>
        )}

        {/* Needs Review Tab */}
        {activeTab === 'review' && (
          <>
            {loading ? (
              <div className="glass rounded-xl p-12 text-center">
                <p className="text-gray-400">Loading entries...</p>
              </div>
            ) : entriesNeedingReview.length > 0 ? (
              <div className="space-y-4">
                {entriesNeedingReview.map((entry) => (
                  <div key={entry.entry_id} className="glass rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-4">
                          <h3 className="text-lg font-semibold text-white">{entry.employee_name}</h3>
                          <span className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400 font-medium">
                            Needs Review
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-gray-500 mb-1">Date</p>
                            <p className="text-white font-medium">{entry.report_date}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Project</p>
                            <p className="text-white font-medium">{entry.project_name}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Total Hours</p>
                            <p className="text-white font-medium">{entry.total_hours.toFixed(1)} hrs</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Total Cost</p>
                            <p className="text-green-400 font-medium">${entry.total_cost.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-gray-500 mb-1">Regular Hours</p>
                            <p className="text-white">{entry.regular_hours.toFixed(1)} @ ${entry.hourly_rate.toFixed(2)}/hr</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Overtime Hours</p>
                            <p className="text-white">{entry.overtime_hours.toFixed(1)} @ ${entry.overtime_rate.toFixed(2)}/hr</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Double Time Hours</p>
                            <p className="text-white">{entry.double_time_hours.toFixed(1)} @ ${entry.double_time_rate.toFixed(2)}/hr</p>
                          </div>
                        </div>

                        {entry.activities && (
                          <div className="mb-4">
                            <p className="text-gray-500 text-sm mb-1">Activities</p>
                            <p className="text-white text-sm">{entry.activities}</p>
                          </div>
                        )}

                        {entry.employee_specific_issues && (
                          <div className="mb-4">
                            <p className="text-gray-500 text-sm mb-1">Issues</p>
                            <p className="text-yellow-400 text-sm">{entry.employee_specific_issues}</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleMarkAsReviewed(entry.entry_id)}
                        className="ml-4 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition text-sm font-medium"
                      >
                        Mark as Reviewed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-xl p-12 text-center">
                <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-gray-400 text-lg">All entries have been reviewed</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PayrollDashboard;
