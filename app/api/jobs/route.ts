/**
 * Jobs API - List and Query Jobs
 * 
 * GET /api/jobs
 * 
 * List all jobs with optional filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import type { ApiResponse, JobStatus } from '@/lib/types';
import { listJobs } from '@/lib/services/job-service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getConfig();
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as JobStatus | undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const nextToken = searchParams.get('nextToken') || undefined;

    // List jobs with filters
    const result = await listJobs({
      status,
      customerId,
      limit,
      nextToken,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        jobs: result.jobs,
        count: result.jobs.length,
        nextToken: result.nextToken,
        environment: config.env,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[JOBS LIST ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'JOBS_LIST_ERROR',
        message: error.message || 'Failed to list jobs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
