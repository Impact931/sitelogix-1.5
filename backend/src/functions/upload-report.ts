import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { buildAudioPath, buildS3Url } from '../utils/s3-paths';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const AUDIO_BUCKET = process.env.AUDIO_BUCKET || 'sitelogix-audio-files-prod';
const REPORTS_TABLE = process.env.REPORTS_TABLE || 'sitelogix-reports';

interface UploadRequest {
  projectId: string;
  managerId: string;
  date: string;
  audioData: string; // base64 encoded
  audioFormat: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Upload report request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body: UploadRequest = JSON.parse(event.body || '{}');
    const { projectId, managerId, date, audioData, audioFormat } = body;

    // Validate required fields
    if (!projectId || !managerId || !date || !audioData) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Missing required fields: projectId, managerId, date, audioData'
        })
      };
    }

    // Generate report ID
    const reportId = `rpt_${date.replace(/-/g, '')}_${managerId}_${uuidv4().slice(0, 8)}`;
    const timestamp = new Date().toISOString();

    // Decode base64 audio data
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Build S3 path using utility (ensures SiteLogix root folder structure)
    const s3Key = buildAudioPath(projectId, date, reportId, audioFormat || 'webm');

    const s3Command = new PutObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: `audio/${audioFormat || 'webm'}`,
      Metadata: {
        projectId,
        managerId,
        reportDate: date,
        reportId,
        sitelogixVersion: '1.5'
      }
    });

    await s3Client.send(s3Command);

    const audioFileUrl = buildS3Url(AUDIO_BUCKET, s3Key);

    // Create initial report record in DynamoDB
    const reportItem = {
      PK: `REPORT#${projectId}#${date}`,
      SK: `MANAGER#${managerId}#${timestamp}`,
      reportId,
      project_id: projectId,
      manager_id: managerId,
      report_date: date,
      status: 'uploaded',
      audio_file_url: audioFileUrl,
      audio_format: audioFormat || 'webm',
      audio_size_bytes: audioBuffer.length,
      created_at: timestamp,
      updated_at: timestamp
    };

    const dynamoCommand = new PutCommand({
      TableName: REPORTS_TABLE,
      Item: reportItem
    });

    await dynamoClient.send(dynamoCommand);

    // Return success response
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        reportId,
        audioFileUrl,
        uploadedAt: timestamp,
        status: 'uploaded',
        nextStep: 'transcription'
      })
    };

  } catch (error) {
    console.error('Error uploading report:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: 'Failed to upload report',
        requestId: event.requestContext?.requestId
      })
    };
  }
};
