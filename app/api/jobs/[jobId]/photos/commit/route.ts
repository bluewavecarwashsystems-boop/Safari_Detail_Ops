/**
 * Photo Commit API
 * 
 * POST /api/jobs/[jobId]/photos/commit
 * 
 * Commit uploaded photos to job record after successful S3 upload.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, CommitPhotosRequest } from '@/lib/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import { commitPhotosToJob } from '@/lib/services/job-service';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const POST = requireAuth(async (
  request: NextRequest,
  session,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
): Promise<NextResponse> => {
  try {
    // Await params in case it's a Promise (Next.js 15+)
    const params = await Promise.resolve(context.params);
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

    const body: CommitPhotosRequest = await request.json();

    if (!body.photos || !Array.isArray(body.photos) || body.photos.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'photos array is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate photo data
    for (const photo of body.photos) {
      if (!photo.photoId || !photo.s3Key || !photo.publicUrl || !photo.contentType) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_PHOTO_DATA',
            message: 'Each photo must have photoId, s3Key, publicUrl, and contentType',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Commit photos to job
    const updatedJob = await commitPhotosToJob(jobId, body.photos, {
      userId: session.sub,
      name: session.name,
      role: session.role as UserRole,
    });

    if (!updatedJob) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found`,
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      data: { job: updatedJob },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[PHOTO COMMIT ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'COMMIT_ERROR',
        message: error.message || 'Failed to commit photos',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
