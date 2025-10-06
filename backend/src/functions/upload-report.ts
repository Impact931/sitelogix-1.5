import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { buildAudioPath, buildTranscriptPath, buildS3Url } from '../utils/s3-paths';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const BUCKET_NAME = process.env.S3_BUCKET || 'sitelogix-prod';
const REPORTS_TABLE = process.env.REPORTS_TABLE || 'sitelogix-reports';

interface UploadRequest {
  projectId: string;
  projectName: string;
  projectLocation: string;
  managerId: string;
  managerName: string;
  reportDate: string;
  conversationId: string;
  audioData?: string; // base64 encoded, optional
  audioFormat?: string;
  transcript: any; // Full ElevenLabs transcript object
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Upload report request:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body: UploadRequest = JSON.parse(event.body || '{}');
    const {
      projectId,
      projectName,
      projectLocation,
      managerId,
      managerName,
      reportDate,
      conversationId,
      audioData,
      audioFormat,
      transcript
    } = body;

    // Validate required fields
    if (!projectId || !managerId || !reportDate || !conversationId || !transcript) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Missing required fields: projectId, managerId, reportDate, conversationId, transcript'
        })
      };
    }

    // Generate report ID
    const reportId = `rpt_${reportDate.replace(/-/g, '')}_${managerId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Upload transcript to S3
    const transcriptKey = buildTranscriptPath(projectId, reportDate, reportId);
    const transcriptCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: transcriptKey,
      Body: JSON.stringify(transcript, null, 2),
      ContentType: 'application/json',
      Metadata: {
        projectId,
        managerId,
        reportDate,
        reportId,
        conversationId,
        sitelogixVersion: '1.5'
      }
    });

    await s3Client.send(transcriptCommand);
    const transcriptFileUrl = buildS3Url(BUCKET_NAME, transcriptKey);

    // Upload audio to S3 if provided
    let audioFileUrl = null;
    let audioSizeBytes = 0;
    if (audioData) {
      const audioBuffer = Buffer.from(audioData, 'base64');
      audioSizeBytes = audioBuffer.length;

      const audioKey = buildAudioPath(projectId, reportDate, reportId, audioFormat || 'webm');
      const audioCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: `audio/${audioFormat || 'webm'}`,
        Metadata: {
          projectId,
          managerId,
          reportDate,
          reportId,
          conversationId,
          sitelogixVersion: '1.5'
        }
      });

      await s3Client.send(audioCommand);
      audioFileUrl = buildS3Url(BUCKET_NAME, audioKey);
    }

    // Create initial report record in DynamoDB
    const reportItem = {
      PK: `PROJECT#${projectId}`,
      SK: `REPORT#${reportDate}#${reportId}`,
      report_id: reportId,
      project_id: projectId,
      project_name: projectName,
      manager_id: managerId,
      manager_name: managerName,
      report_date: reportDate,
      conversation_id: conversationId,
      status: 'uploaded',
      transcript_s3_path: transcriptFileUrl,
      audio_s3_path: audioFileUrl,
      audio_format: audioFormat || 'webm',
      audio_size_bytes: audioSizeBytes,
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
        conversationId,
        transcriptFileUrl,
        audioFileUrl,
        uploadedAt: timestamp,
        status: 'uploaded',
        nextStep: 'AI processing'
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
