/**
 * Jobs API - Get Single Job
 * 
 * GET /api/jobs/[jobId]
 * 
 * Get a specific job by ID with photo URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { getJobWithPhotos } from '@/lib/services/job-service';

export async function GET(
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

    // Get job with photo URLs
    const job = await getJobWithPhotos(jobId);

    if (!job) {
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
      data: job,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[JOB GET ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'JOB_GET_ERROR',
        message: error.message || 'Failed to get job',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
