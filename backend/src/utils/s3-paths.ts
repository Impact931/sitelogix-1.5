/**
 * S3 Path Utilities for SiteLogix
 *
 * All paths use the SiteLogix root folder structure:
 * SiteLogix/projects/{projectId}/...
 */

interface DateComponents {
  year: string;
  month: string;
  day: string;
}

/**
 * Parse a date string into year/month/day components
 */
export const parseDateComponents = (dateString: string): DateComponents => {
  const date = new Date(dateString);
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0')
  };
};

/**
 * Build S3 path for audio file
 * Format: SITELOGIX/projects/{projectId}/reports/{YYYY}/{MM}/{DD}/{reportId}/audio.webm
 */
export const buildAudioPath = (
  projectId: string,
  reportDate: string,
  reportId: string,
  format: string = 'webm'
): string => {
  const { year, month, day } = parseDateComponents(reportDate);
  return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/audio.${format}`;
};

/**
 * Build S3 path for transcript file (JSON)
 * Format: SITELOGIX/projects/{projectId}/reports/{YYYY}/{MM}/{DD}/{reportId}/transcript.json
 */
export const buildTranscriptPath = (
  projectId: string,
  reportDate: string,
  reportId: string
): string => {
  const { year, month, day } = parseDateComponents(reportDate);
  return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/transcript.json`;
};

/**
 * Build S3 path for parsed data (JSON)
 * Format: SITELOGIX/projects/{projectId}/reports/{YYYY}/{MM}/{DD}/{reportId}/parsed-data.json
 */
export const buildParsedDataPath = (
  projectId: string,
  reportDate: string,
  reportId: string
): string => {
  const { year, month, day } = parseDateComponents(reportDate);
  return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/parsed-data.json`;
};

/**
 * Build S3 path for AI analysis results
 * Format: SITELOGIX/projects/{projectId}/reports/{YYYY}/{MM}/{DD}/{reportId}/analysis-{type}.json
 */
export const buildAnalysisPath = (
  projectId: string,
  reportDate: string,
  reportId: string,
  analysisType: 'personnel-matches' | 'vendor-matches' | 'constraint-analysis'
): string => {
  const { year, month, day } = parseDateComponents(reportDate);
  return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/analysis-${analysisType}.json`;
};

/**
 * Build S3 path for project metadata
 * Format: SITELOGIX/projects/{projectId}/metadata/{filename}
 */
export const buildProjectMetadataPath = (
  projectId: string,
  filename: string
): string => {
  return `SITELOGIX/projects/${projectId}/metadata/${filename}`;
};

/**
 * Build S3 path for manager-specific data
 * Format: SITELOGIX/managers/{managerId}/{type}/{filename}
 */
export const buildManagerDataPath = (
  managerId: string,
  type: 'reports' | 'profile',
  filename: string
): string => {
  return `SITELOGIX/managers/${managerId}/${type}/${filename}`;
};

/**
 * Build S3 path for archive
 * Format: SITELOGIX/projects/{projectId}/archive/{YYYY}/{reportId}.{format}
 */
export const buildArchivePath = (
  projectId: string,
  reportDate: string,
  reportId: string,
  format: string = 'webm'
): string => {
  const { year } = parseDateComponents(reportDate);
  return `SITELOGIX/projects/${projectId}/archive/${year}/${reportId}.${format}`;
};

/**
 * Build S3 path for system config files
 * Format: SITELOGIX/system/{type}/{filename}
 */
export const buildSystemPath = (
  type: 'config' | 'logs',
  filename: string
): string => {
  return `SITELOGIX/system/${type}/${filename}`;
};

/**
 * Extract components from an existing S3 path
 */
export const parseS3Path = (s3Path: string): {
  projectId?: string;
  managerId?: string;
  reportId?: string;
  year?: string;
  month?: string;
  day?: string;
  type?: string;
} => {
  const parts = s3Path.split('/');
  const result: any = {};

  // Check if it's a project path
  const projectIndex = parts.indexOf('projects');
  if (projectIndex !== -1 && parts[projectIndex + 1]) {
    result.projectId = parts[projectIndex + 1];
  }

  // Check if it's a manager path
  const managerIndex = parts.indexOf('managers');
  if (managerIndex !== -1 && parts[managerIndex + 1]) {
    result.managerId = parts[managerIndex + 1];
  }

  // Extract date components if present
  const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
  const dateMatch = s3Path.match(datePattern);
  if (dateMatch) {
    result.year = dateMatch[1];
    result.month = dateMatch[2];
    result.day = dateMatch[3];
  }

  // Extract report ID from filename
  const reportIdPattern = /(rpt_\d{8}_[a-z0-9]+_[a-z0-9]+)/;
  const reportMatch = s3Path.match(reportIdPattern);
  if (reportMatch) {
    result.reportId = reportMatch[1];
  }

  // Determine type (audio, transcripts, parsed-data, etc.)
  if (s3Path.includes('/audio/')) result.type = 'audio';
  else if (s3Path.includes('/transcripts/')) result.type = 'transcripts';
  else if (s3Path.includes('/parsed-data/')) result.type = 'parsed-data';
  else if (s3Path.includes('/ai-analysis/')) result.type = 'ai-analysis';
  else if (s3Path.includes('/archive/')) result.type = 'archive';

  return result;
};

/**
 * Validate S3 path follows SiteLogix structure
 */
export const isValidSiteLogixPath = (s3Path: string): boolean => {
  // Must start with SITELOGIX/
  if (!s3Path.startsWith('SITELOGIX/')) {
    return false;
  }

  // Must have at least one category (projects, managers, system)
  const validCategories = ['projects', 'managers', 'system'];
  const hasValidCategory = validCategories.some(cat => s3Path.includes(`SITELOGIX/${cat}/`));

  return hasValidCategory;
};

/**
 * Build full S3 URL
 */
export const buildS3Url = (bucket: string, key: string): string => {
  return `s3://${bucket}/${key}`;
};

/**
 * Build HTTPS URL for S3 object
 */
export const buildS3HttpsUrl = (bucket: string, key: string, region: string = 'us-east-1'): string => {
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;
};

// Export all utilities
export default {
  parseDateComponents,
  buildAudioPath,
  buildTranscriptPath,
  buildParsedDataPath,
  buildAnalysisPath,
  buildProjectMetadataPath,
  buildManagerDataPath,
  buildArchivePath,
  buildSystemPath,
  parseS3Path,
  isValidSiteLogixPath,
  buildS3Url,
  buildS3HttpsUrl
};
