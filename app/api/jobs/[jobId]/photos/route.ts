/**
 * Jobs API - Photo Upload
 * 
 * POST /api/jobs/[jobId]/photos
 * 
 * Generate pre-signed URL for photo upload or handle direct upload.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { generateUploadUrl } from '@/lib/aws/s3';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> {
  try {
    const jobId = params.jobId;

    if (!jobId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_JOB_ID',
          message: 'Job ID is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    const body = await request.json();
    const { filename, contentType } = body;

    if (!filename) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_FILENAME',
          message: 'Filename is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
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

    return NextResponse.json(response, { status: 200 });
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

    return NextResponse.json(response, { status: 500 });
  }
}
