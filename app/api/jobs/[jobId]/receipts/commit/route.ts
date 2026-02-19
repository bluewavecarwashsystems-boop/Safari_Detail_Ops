/**
 * Receipt Commit API
 * 
 * POST /api/jobs/[jobId]/receipts/commit
 * 
 * Commit uploaded receipt photos to job record after successful S3 upload (MANAGER only).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, CommitReceiptsRequest } from '@/lib/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import { commitReceiptsToJob } from '@/lib/services/job-service';
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

    const body: CommitReceiptsRequest = await request.json();

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

    // Validate receipt photo data
    for (const photo of body.photos) {
      if (!photo.photoId || !photo.s3Key || !photo.publicUrl || !photo.contentType) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_RECEIPT_DATA',
            message: 'Each receipt must have photoId, s3Key, publicUrl, and contentType',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Only MANAGER can commit receipts
    const userRole = session.role as UserRole;
    if (userRole !== UserRole.MANAGER) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can commit receipt photos',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    // Commit receipts to job
    const updatedJob = await commitReceiptsToJob(jobId, body.photos, {
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
    console.error('[RECEIPT COMMIT ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'COMMIT_ERROR',
        message: error.message || 'Failed to commit receipt photos',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
