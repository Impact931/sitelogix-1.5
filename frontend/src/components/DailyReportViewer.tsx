import React, { useEffect, useState } from 'react';

interface DailyReportViewerProps {
  reportUrl?: string;
  reportId?: string;
  projectId?: string;
  reportDate?: string;
}

/**
 * Daily Report Viewer Component
 *
 * Displays beautiful HTML construction reports in an iframe
 * Can fetch report URL from S3 based on reportId or use direct URL
 */
export const DailyReportViewer: React.FC<DailyReportViewerProps> = ({
  reportUrl,
  reportId,
  projectId,
  reportDate
}) => {
  const [htmlReportUrl, setHtmlReportUrl] = useState<string | null>(reportUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we have a direct URL, use it
    if (reportUrl) {
      setHtmlReportUrl(reportUrl);
      return;
    }

    // Otherwise, construct S3 URL from reportId
    if (reportId && projectId && reportDate) {
      const [year, month, day] = reportDate.split('-');
      const s3Key = `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/report.html`;
      const url = `https://sitelogix-prod.s3.amazonaws.com/${s3Key}`;
      setHtmlReportUrl(url);
    }
  }, [reportUrl, reportId, projectId, reportDate]);

  const handlePrint = () => {
    const iframe = document.getElementById('report-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleDownload = async () => {
    if (!htmlReportUrl) return;

    try {
      const response = await fetch(htmlReportUrl);
      const html = await response.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-report-${reportId || 'report'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report');
    }
  };

  const handleOpenInNewTab = () => {
    if (htmlReportUrl) {
      window.open(htmlReportUrl, '_blank');
    }
  };

  if (!htmlReportUrl) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No report available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border-b p-4 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900">Daily Construction Report</h2>
          {reportId && (
            <span className="text-sm text-gray-500">({reportId})</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download</span>
          </button>

          <button
            onClick={handleOpenInNewTab}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Open</span>
          </button>
        </div>
      </div>

      {/* Report iframe */}
      <div className="flex-1 bg-gray-100 rounded-b-lg overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <iframe
          id="report-iframe"
          src={htmlReportUrl}
          className="w-full h-full border-0"
          title="Daily Construction Report"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
};

export default DailyReportViewer;
