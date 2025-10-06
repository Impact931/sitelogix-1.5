import {
  buildAudioPath,
  buildTranscriptPath,
  buildParsedDataPath,
  buildAnalysisPath,
  parseS3Path,
  isValidSiteLogixPath,
  buildS3Url
} from './s3-paths';

describe('S3 Path Utilities', () => {
  describe('buildAudioPath', () => {
    it('should build correct audio path with SiteLogix root', () => {
      const path = buildAudioPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123', 'webm');
      expect(path).toBe('SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm');
    });

    it('should handle single-digit months and days', () => {
      const path = buildAudioPath('proj_001', '2025-01-05', 'rpt_20250105_mgr001_abc123', 'webm');
      expect(path).toBe('SiteLogix/projects/proj_001/audio/2025/01/05/rpt_20250105_mgr001_abc123.webm');
    });

    it('should use default format if not provided', () => {
      const path = buildAudioPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123');
      expect(path).toContain('.webm');
    });
  });

  describe('buildTranscriptPath', () => {
    it('should build correct transcript path', () => {
      const path = buildTranscriptPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123');
      expect(path).toBe('SiteLogix/projects/proj_001/transcripts/2025/10/05/rpt_20251005_mgr001_abc123.txt');
    });
  });

  describe('buildParsedDataPath', () => {
    it('should build correct parsed data path', () => {
      const path = buildParsedDataPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123');
      expect(path).toBe('SiteLogix/projects/proj_001/parsed-data/2025/10/05/rpt_20251005_mgr001_abc123-parsed.json');
    });
  });

  describe('buildAnalysisPath', () => {
    it('should build correct personnel matches path', () => {
      const path = buildAnalysisPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123', 'personnel-matches');
      expect(path).toBe('SiteLogix/projects/proj_001/ai-analysis/personnel-matches/2025/10/05/rpt_20251005_mgr001_abc123-personnel-matches.json');
    });

    it('should build correct vendor matches path', () => {
      const path = buildAnalysisPath('proj_001', '2025-10-05', 'rpt_20251005_mgr001_abc123', 'vendor-matches');
      expect(path).toBe('SiteLogix/projects/proj_001/ai-analysis/vendor-matches/2025/10/05/rpt_20251005_mgr001_abc123-vendor-matches.json');
    });
  });

  describe('parseS3Path', () => {
    it('should extract components from audio path', () => {
      const path = 'SiteLogix/projects/proj_001/audio/2025/10/05/rpt_20251005_mgr001_abc123.webm';
      const components = parseS3Path(path);

      expect(components.projectId).toBe('proj_001');
      expect(components.reportId).toBe('rpt_20251005_mgr001_abc123');
      expect(components.year).toBe('2025');
      expect(components.month).toBe('10');
      expect(components.day).toBe('05');
      expect(components.type).toBe('audio');
    });

    it('should extract components from transcript path', () => {
      const path = 'SiteLogix/projects/proj_002/transcripts/2025/10/05/rpt_20251005_mgr002_def456.txt';
      const components = parseS3Path(path);

      expect(components.projectId).toBe('proj_002');
      expect(components.reportId).toBe('rpt_20251005_mgr002_def456');
      expect(components.type).toBe('transcripts');
    });

    it('should extract manager ID from manager paths', () => {
      const path = 'SiteLogix/managers/mgr_001/reports/report-index.json';
      const components = parseS3Path(path);

      expect(components.managerId).toBe('mgr_001');
    });
  });

  describe('isValidSiteLogixPath', () => {
    it('should validate correct SiteLogix paths', () => {
      expect(isValidSiteLogixPath('SiteLogix/projects/proj_001/audio/2025/10/05/file.webm')).toBe(true);
      expect(isValidSiteLogixPath('SiteLogix/managers/mgr_001/profile/data.json')).toBe(true);
      expect(isValidSiteLogixPath('SiteLogix/system/config/app.json')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(isValidSiteLogixPath('proj_001/audio/file.webm')).toBe(false);
      expect(isValidSiteLogixPath('audio/file.webm')).toBe(false);
      expect(isValidSiteLogixPath('SiteLogix/invalid/path.json')).toBe(false);
    });
  });

  describe('buildS3Url', () => {
    it('should build correct S3 URL', () => {
      const url = buildS3Url('sitelogix-audio-files-prod', 'SiteLogix/projects/proj_001/audio/file.webm');
      expect(url).toBe('s3://sitelogix-audio-files-prod/SiteLogix/projects/proj_001/audio/file.webm');
    });
  });
});
