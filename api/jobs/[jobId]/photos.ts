/**
 * Jobs API - Photo Upload
 * 
 * POST /api/jobs/[jobId]/photos
 * 
 * Generate pre-signed URL for photo upload or handle direct upload.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiResponse } from '../../../lib/types';
import { generateUploadUrl } from '../../../lib/aws/s3';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed',
      },
      timestamp: new Date().toISOString(),
    };
    res.status(405).json(response);
    return;
  }

  try {
    const jobId = req.query.jobId as string;

    if (!jobId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_JOB_ID',
          message: 'Job ID is required',
        },
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(response);
      return;
    }

    const { filename, contentType } = req.body;

    if (!filename) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_FILENAME',
          message: 'Filename is required',
        },
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(response);
      return;
    }

    // Generate pre-signed upload URL
    const { url, key } = await generateUploadUrl(
      jobId,
      filename,
      contentType || 'image/jpeg',
      3600 // 1 hour expiry
    );

    const response: ApiResponse = {
      success: true,
      data: {
        uploadUrl: url,
        photoKey: key,
        expiresIn: 3600,
        instructions: 'Use PUT request to upload the file to uploadUrl',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[PHOTO UPLOAD URL ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PHOTO_UPLOAD_URL_ERROR',
        message: error.message || 'Failed to generate upload URL',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
}
