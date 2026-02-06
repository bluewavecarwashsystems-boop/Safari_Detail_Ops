/**
 * S3 Service Layer
 * 
 * Handles all S3 operations for Safari Detail Ops photo storage.
 * Uses AWS SDK v3 with S3Client for file operations.
 */

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getConfig } from '../config';

let s3Client: S3Client | null = null;

/**
 * Get or create S3 Client
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getConfig();
    
    s3Client = new S3Client({
      region: config.aws.region,
    });
  }
  
  return s3Client;
}

/**
 * Generate S3 key for photo
 */
export function generatePhotoKey(jobId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `jobs/${jobId}/photos/${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload photo to S3
 */
export async function uploadPhoto(
  jobId: string,
  filename: string,
  content: Buffer,
  contentType: string = 'image/jpeg'
): Promise<string> {
  const client = getS3Client();
  const config = getConfig();
  
  const key = generatePhotoKey(jobId, filename);
  
  await client.send(new PutObjectCommand({
    Bucket: config.aws.s3.photosBucket,
    Key: key,
    Body: content,
    ContentType: contentType,
    Metadata: {
      jobId,
      uploadedAt: new Date().toISOString(),
    },
  }));
  
  return key;
}

/**
 * Generate pre-signed URL for photo upload
 * (Allows client-side direct upload to S3)
 */
export async function generateUploadUrl(
  jobId: string,
  filename: string,
  contentType: string = 'image/jpeg',
  expiresIn: number = 3600
): Promise<{ url: string; key: string }> {
  const client = getS3Client();
  const config = getConfig();
  
  const key = generatePhotoKey(jobId, filename);
  
  const command = new PutObjectCommand({
    Bucket: config.aws.s3.photosBucket,
    Key: key,
    ContentType: contentType,
    Metadata: {
      jobId,
    },
  });
  
  const url = await getSignedUrl(client, command, { expiresIn });
  
  return { url, key };
}

/**
 * Generate pre-signed URL for photo download
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const config = getConfig();
  
  const command = new GetObjectCommand({
    Bucket: config.aws.s3.photosBucket,
    Key: key,
  });
  
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete photo from S3
 */
export async function deletePhoto(key: string): Promise<void> {
  const client = getS3Client();
  const config = getConfig();
  
  await client.send(new DeleteObjectCommand({
    Bucket: config.aws.s3.photosBucket,
    Key: key,
  }));
}

/**
 * List all photos for a job
 */
export async function listJobPhotos(jobId: string): Promise<string[]> {
  const client = getS3Client();
  const config = getConfig();
  
  const prefix = `jobs/${jobId}/photos/`;
  
  const result = await client.send(new ListObjectsV2Command({
    Bucket: config.aws.s3.photosBucket,
    Prefix: prefix,
  }));
  
  return result.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
}

/**
 * Check if photo exists
 */
export async function photoExists(key: string): Promise<boolean> {
  const client = getS3Client();
  const config = getConfig();
  
  try {
    await client.send(new HeadObjectCommand({
      Bucket: config.aws.s3.photosBucket,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Delete all photos for a job
 */
export async function deleteJobPhotos(jobId: string): Promise<number> {
  const keys = await listJobPhotos(jobId);
  
  await Promise.all(keys.map(key => deletePhoto(key)));
  
  return keys.length;
}
