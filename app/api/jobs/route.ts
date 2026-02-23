/**
 * Jobs API - List and Query Jobs
 * 
 * GET /api/jobs
 * 
 * List all jobs with optional filtering.
 * Supports boardDate filtering for Today's Board.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import type { ApiResponse, WorkStatus } from '@/lib/types';
import { listJobs } from '@/lib/services/job-service';
import { filterJobsByBoardDate, getFilteringStats } from '@/lib/utils/board-filters';
import { getTodayInTimezone, getDayBoundaries } from '@/lib/utils/timezone';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const config = getConfig();
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as WorkStatus | undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const nextToken = searchParams.get('nextToken') || undefined;
    const boardDate = searchParams.get('boardDate') || getTodayInTimezone();

    // List jobs with filters
    const result = await listJobs({
      status,
      customerId,
      limit,
      nextToken,
    });

    // Apply board date filtering if boardDate is provided
    const filteredJobs = boardDate 
      ? filterJobsByBoardDate(result.jobs, boardDate)
      : result.jobs;

    // Log filtering stats for debugging
    const boundaries = getDayBoundaries(boardDate);
    const stats = getFilteringStats(result.jobs, filteredJobs, boardDate);
    
    console.log('[JOBS API] Board date filtering applied', {
      boardDate,
      timezone: boundaries.timezone,
      startBoundary: boundaries.start,
      endBoundary: boundaries.end,
      totalFetched: stats.total,
      totalIncluded: stats.filtered,
      totalExcluded: stats.excluded,
      byStatus: stats.byStatus,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        jobs: filteredJobs,
        count: filteredJobs.length,
        nextToken: result.nextToken,
        environment: config.env,
        boardDate,
        timezone: boundaries.timezone,
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
