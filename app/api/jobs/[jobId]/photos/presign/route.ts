/**
 * Photo Presign API
 * 
 * POST /api/jobs/[jobId]/photos/presign
 * 
 * Generate presigned URLs for client-side S3 uploads.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PresignPhotoRequest, PresignPhotoResponse } from '@/lib/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import { generatePresignedUploadUrls } from '@/lib/services/job-service';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const POST = requireAuth(async (
  request: NextRequest,
  session,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> => {
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

    const body: PresignPhotoRequest = await request.json();

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'files array is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate file count (max 20 photos at once)
    if (body.files.length > 20) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Maximum 20 files per upload',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate content types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    for (const file of body.files) {
      if (!validTypes.includes(file.contentType)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Invalid content type: ${file.contentType}. Allowed: ${validTypes.join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Check if user can upload photos (TECH, QC, MANAGER)
    const userRole = session.role as UserRole;
    if (![UserRole.TECH, UserRole.QC, UserRole.MANAGER].includes(userRole)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only TECH, QC, and MANAGER can upload photos',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    // Generate presigned URLs
    const uploads = await generatePresignedUploadUrls(jobId, body.files);

    const responseData: PresignPhotoResponse = { uploads };

    const response: ApiResponse = {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[PHOTO PRESIGN ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PRESIGN_ERROR',
        message: error.message || 'Failed to generate presigned URLs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
