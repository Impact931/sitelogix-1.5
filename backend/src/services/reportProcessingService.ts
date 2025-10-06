/**
 * Report Processing Service
 *
 * Orchestrates the complete AI processing pipeline:
 * 1. Fetch transcript from S3/DynamoDB
 * 2. Analyze with AI
 * 3. Deduplicate and store in database
 * 4. Generate reports (PDF + Google Sheets)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

import { getTranscriptAnalysisService, ExtractedReportData } from './transcriptAnalysisService';
import { getPersonnelDeduplicationService } from './personnelDeduplicationService';
import { getVendorDeduplicationService } from './vendorDeduplicationService';
import { getGoogleSheetsService } from './googleSheetsService';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const REPORTS_TABLE = process.env.REPORTS_TABLE || 'sitelogix-reports';
const WORK_LOGS_TABLE = process.env.WORK_LOGS_TABLE || 'sitelogix-work-logs';
const CONSTRAINTS_TABLE = process.env.CONSTRAINTS_TABLE || 'sitelogix-constraints';
const AI_CACHE_TABLE = process.env.AI_CACHE_TABLE || 'sitelogix-ai-analysis-cache';
const S3_BUCKET = process.env.VITE_S3_BUCKET || 'sitelogix-prod';

interface ReportRecord {
  reportId: string;
  conversationId: string;
  projectId: string;
  projectName: string;
  projectLocation: string;
  managerId: string;
  managerName: string;
  reportDate: string;
  timestamp: string;
  status: string;
  transcriptS3Path: string;
  audioS3Path?: string;
  rawTranscriptText?: string;
}

export class ReportProcessingService {
  /**
   * Fetch transcript from S3
   */
  private async fetchTranscriptFromS3(s3Path: string): Promise<any> {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Path
        })
      );

      const bodyString = await response.Body?.transformToString();
      if (!bodyString) {
        throw new Error('Empty transcript file');
      }

      return JSON.parse(bodyString);
    } catch (error) {
      console.error('Error fetching transcript from S3:', error);
      throw error;
    }
  }

  /**
   * Get report from DynamoDB
   */
  private async getReport(reportId: string): Promise<ReportRecord> {
    const result = await docClient.send(
      new GetCommand({
        TableName: REPORTS_TABLE,
        Key: {
          PK: `REPORT#${reportId}`,
          SK: 'METADATA'
        }
      })
    );

    if (!result.Item) {
      throw new Error(`Report not found: ${reportId}`);
    }

    return result.Item as ReportRecord;
  }

  /**
   * Update report status
   */
  private async updateReportStatus(
    reportId: string,
    status: string,
    aiProcessingVersion?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: REPORTS_TABLE,
        Key: {
          PK: `REPORT#${reportId}`,
          SK: 'METADATA'
        },
        UpdateExpression: `
          SET #status = :status,
              updatedAt = :updatedAt,
              aiProcessedAt = :aiProcessedAt,
              aiProcessingVersion = :aiProcessingVersion
        `,
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': now,
          ':aiProcessedAt': now,
          ':aiProcessingVersion': aiProcessingVersion || 'v1.0.0'
        }
      })
    );
  }

  /**
   * Save AI analysis to cache
   */
  private async saveAIAnalysisCache(
    reportId: string,
    analysisType: string,
    extractedData: any,
    modelUsed: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: AI_CACHE_TABLE,
        Item: {
          PK: `REPORT#${reportId}`,
          SK: `AI_ANALYSIS#${analysisType}`,
          analysisType,
          modelUsed,
          modelVersion: '1.0',
          structuredData: extractedData,
          createdAt: now,
          needsReanalysis: false
        }
      })
    );
  }

  /**
   * Store work logs
   */
  private async storeWorkLogs(
    reportId: string,
    reportDate: string,
    projectId: string,
    workLogs: ExtractedReportData['workLogs']
  ): Promise<void> {
    for (const workLog of workLogs) {
      const workLogId = `${workLog.teamId}_${workLog.level}`.replace(/\s+/g, '_');

      await docClient.send(
        new PutCommand({
          TableName: WORK_LOGS_TABLE,
          Item: {
            PK: `REPORT#${reportId}`,
            SK: `WORKLOG#${workLogId}`,
            reportId,
            reportDate,
            projectId,
            project_id: projectId, // For GSI
            report_date: reportDate, // For GSI
            team_id: workLog.teamId, // For GSI
            teamId: workLog.teamId,
            level: workLog.level,
            personnelAssigned: workLog.personnelAssigned,
            personnelCount: workLog.personnelCount,
            taskDescription: workLog.taskDescription,
            hoursWorked: workLog.hoursWorked,
            overtimeHours: workLog.overtimeHours,
            materialsUsed: workLog.materialsUsed || [],
            equipmentUsed: workLog.equipmentUsed || [],
            extractedFromText: workLog.extractedFromText,
            createdAt: new Date().toISOString()
          }
        })
      );
    }
  }

  /**
   * Store constraints
   */
  private async storeConstraints(
    reportId: string,
    reportDate: string,
    projectId: string,
    projectName: string,
    constraints: ExtractedReportData['constraints']
  ): Promise<void> {
    for (const constraint of constraints) {
      const constraintId = `constraint_${uuidv4()}`;

      await docClient.send(
        new PutCommand({
          TableName: CONSTRAINTS_TABLE,
          Item: {
            PK: `PROJECT#${projectId}`,
            SK: `CONSTRAINT#${constraintId}`,
            constraintId,
            projectId,
            project_id: projectId, // For GSI
            report_date: reportDate, // For GSI
            projectName,
            reportId,
            reportDate,
            category: constraint.category,
            level: constraint.level,
            severity: constraint.severity,
            title: constraint.title,
            description: constraint.description,
            status: constraint.status,
            dateIdentified: reportDate,
            extractedFromText: constraint.extractedFromText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        })
      );
    }
  }

  /**
   * Process personnel and create deduplicated records
   */
  private async processPersonnel(
    reportId: string,
    reportDate: string,
    projectId: string,
    projectName: string,
    personnel: ExtractedReportData['personnel']
  ): Promise<void> {
    const personnelService = getPersonnelDeduplicationService();

    for (const person of personnel) {
      await personnelService.findOrCreatePerson(
        person.fullName,
        person.goByName,
        person.position,
        person.teamAssignment,
        person.hoursWorked,
        person.overtimeHours,
        person.healthStatus,
        reportId,
        reportDate,
        projectId,
        projectName,
        person.activitiesPerformed
      );
    }
  }

  /**
   * Process vendors and create deduplicated records
   */
  private async processVendors(
    reportId: string,
    reportDate: string,
    projectId: string,
    projectName: string,
    vendors: ExtractedReportData['vendors']
  ): Promise<void> {
    const vendorService = getVendorDeduplicationService();

    for (const vendor of vendors) {
      await vendorService.findOrCreateVendor(
        vendor.companyName,
        vendor.vendorType,
        vendor.materialsDelivered,
        vendor.deliveryTime,
        vendor.receivedBy,
        vendor.deliveryNotes,
        vendor.extractedFromText,
        reportId,
        reportDate,
        projectId,
        projectName
      );
    }
  }

  /**
   * Generate Google Sheets report
   */
  private async generateGoogleSheetsReport(
    report: ReportRecord,
    extractedData: ExtractedReportData,
    spreadsheetUrl: string
  ): Promise<void> {
    const sheetsService = getGoogleSheetsService();

    const reportData = {
      reportId: report.reportId,
      reportDate: report.reportDate,
      projectName: report.projectName,
      projectLocation: report.projectLocation,
      managerName: report.managerName,
      personnel: extractedData.personnel.map(p => ({
        fullName: p.fullName,
        goByName: p.goByName,
        position: p.position,
        teamAssignment: p.teamAssignment,
        healthStatus: p.healthStatus,
        hoursWorked: p.hoursWorked,
        overtimeHours: p.overtimeHours
      })),
      workLogs: extractedData.workLogs.map(w => ({
        teamId: w.teamId,
        taskDescription: w.taskDescription,
        level: w.level
      })),
      constraints: extractedData.constraints.map(c => ({
        level: c.level,
        description: c.description
      })),
      totalHeadcount: extractedData.timeSummary.totalPersonnelCount,
      totalRegularHours: extractedData.timeSummary.totalRegularHours,
      totalOvertimeHours: extractedData.timeSummary.totalOvertimeHours
    };

    await sheetsService.writeDailyReport(spreadsheetUrl, reportData);
  }

  /**
   * Main processing function
   */
  async processReport(reportId: string, googleSheetsUrl?: string): Promise<void> {
    console.log('='.repeat(80));
    console.log(`🚀 Starting AI processing for report: ${reportId}`);
    console.log('='.repeat(80));

    try {
      // 1. Get report from DynamoDB
      console.log('📄 Fetching report from DynamoDB...');
      const report = await this.getReport(reportId);

      if (report.status === 'analyzed') {
        console.log('⚠️  Report already analyzed. Skipping...');
        return;
      }

      // 2. Fetch transcript from S3
      console.log('📥 Fetching transcript from S3...');
      const transcriptData = await this.fetchTranscriptFromS3(report.transcriptS3Path);

      // 3. Analyze transcript with AI
      console.log('🤖 Analyzing transcript with AI...');
      const analysisService = getTranscriptAnalysisService();
      const extractedData = await analysisService.analyzeTranscript(transcriptData, {
        projectName: report.projectName,
        projectLocation: report.projectLocation,
        managerName: report.managerName,
        reportDate: report.reportDate
      });

      // 4. Save AI analysis to cache
      console.log('💾 Saving AI analysis to cache...');
      await this.saveAIAnalysisCache(reportId, 'full_extraction', extractedData, 'claude-3-5-sonnet');

      // 5. Process and deduplicate personnel
      console.log('👥 Processing personnel with deduplication...');
      await this.processPersonnel(
        reportId,
        report.reportDate,
        report.projectId,
        report.projectName,
        extractedData.personnel
      );

      // 6. Process and deduplicate vendors
      console.log('🏢 Processing vendors with deduplication...');
      await this.processVendors(
        reportId,
        report.reportDate,
        report.projectId,
        report.projectName,
        extractedData.vendors
      );

      // 7. Store work logs
      console.log('📝 Storing work logs...');
      await this.storeWorkLogs(reportId, report.reportDate, report.projectId, extractedData.workLogs);

      // 8. Store constraints
      console.log('⚠️  Storing constraints...');
      await this.storeConstraints(
        reportId,
        report.reportDate,
        report.projectId,
        report.projectName,
        extractedData.constraints
      );

      // 9. Generate Google Sheets report (if URL provided)
      if (googleSheetsUrl) {
        console.log('📊 Generating Google Sheets report...');
        await this.generateGoogleSheetsReport(report, extractedData, googleSheetsUrl);
      }

      // 10. Update report status
      console.log('✅ Updating report status to "analyzed"...');
      await this.updateReportStatus(reportId, 'analyzed', 'v1.0.0');

      console.log('='.repeat(80));
      console.log('✅ Report processing complete!');
      console.log('='.repeat(80));
      console.log(`Personnel processed: ${extractedData.personnel.length}`);
      console.log(`Work logs created: ${extractedData.workLogs.length}`);
      console.log(`Constraints identified: ${extractedData.constraints.length}`);
      console.log(`Vendors tracked: ${extractedData.vendors.length}`);
      console.log('='.repeat(80));
    } catch (error) {
      console.error('❌ Report processing failed:', error);
      await this.updateReportStatus(reportId, 'error');
      throw error;
    }
  }
}

// Export singleton
let processingServiceInstance: ReportProcessingService | null = null;

export function getReportProcessingService(): ReportProcessingService {
  if (!processingServiceInstance) {
    processingServiceInstance = new ReportProcessingService();
  }
  return processingServiceInstance;
}
