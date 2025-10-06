import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Initialize AWS clients
const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const dynamoClient = new DynamoDBClient({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET || 'sitelogix-prod';

interface SaveReportParams {
  audioBlob: Blob | null;
  transcript: any;
  managerId: string;
  managerName: string;
  projectId: string;
  projectName: string;
  projectLocation: string;
  reportDate: string;
  conversationId: string;
}

// Generate S3 paths based on unified SITELOGIX structure
const buildS3AudioPath = (projectId: string, reportDate: string, reportId: string): string => {
  const date = new Date(reportDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/audio.webm`;
};

const buildS3TranscriptPath = (projectId: string, reportDate: string, reportId: string): string => {
  const date = new Date(reportDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `SITELOGIX/projects/${projectId}/reports/${year}/${month}/${day}/${reportId}/transcript.json`;
};

export const saveReport = async (params: SaveReportParams) => {
  const {
    audioBlob,
    transcript,
    managerId,
    managerName,
    projectId,
    projectName,
    projectLocation,
    reportDate,
    conversationId,
  } = params;

  // Generate report ID
  const timestamp = new Date().getTime();
  const reportId = `rpt_${reportDate.replace(/-/g, '')}_${managerId}_${timestamp}`;

  console.log('Saving report:', reportId);

  try {
    // 1. Upload audio to S3 (if available)
    let audioPath = null;
    if (audioBlob && audioBlob.size > 0) {
      audioPath = buildS3AudioPath(projectId, reportDate, reportId);
      const audioBuffer = await audioBlob.arrayBuffer();

      const audioCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: audioPath,
        Body: new Uint8Array(audioBuffer),
        ContentType: 'audio/webm',
        Metadata: {
          projectId,
          managerId,
          reportDate,
          reportId,
          conversationId,
        },
      });

      await s3Client.send(audioCommand);
      console.log('Audio uploaded to S3:', audioPath);
    } else {
      console.log('No audio available, skipping audio upload');
    }

    // 2. Save transcript to S3
    const transcriptPath = buildS3TranscriptPath(projectId, reportDate, reportId);
    const transcriptCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: transcriptPath,
      Body: JSON.stringify(transcript, null, 2),
      ContentType: 'application/json',
      Metadata: {
        projectId,
        managerId,
        reportDate,
        reportId,
        conversationId,
      },
    });

    await s3Client.send(transcriptCommand);
    console.log('Transcript uploaded to S3:', transcriptPath);

    // 3. Create DynamoDB entry
    const dynamoCommand = new PutCommand({
      TableName: 'sitelogix-reports',
      Item: {
        PK: `PROJECT#${projectId}`,
        SK: `REPORT#${reportDate}#${reportId}`,
        report_id: reportId,
        project_id: projectId,
        project_name: projectName,
        manager_id: managerId,
        manager_name: managerName,
        report_date: reportDate,
        conversation_id: conversationId,
        audio_s3_path: audioPath ? `s3://${BUCKET_NAME}/${audioPath}` : null,
        transcript_s3_path: `s3://${BUCKET_NAME}/${transcriptPath}`,
        status: 'uploaded',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    await docClient.send(dynamoCommand);
    console.log('Report entry created in DynamoDB');

    return {
      success: true,
      reportId,
      audioPath,
      transcriptPath,
    };
  } catch (error) {
    console.error('Error saving report:', error);
    throw error;
  }
};
