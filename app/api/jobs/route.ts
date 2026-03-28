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
    const status = (searchParams.get('status') || undefined) as WorkStatus | undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const nextToken = searchParams.get('nextToken') || undefined;
    const boardDate = searchParams.get('boardDate') || null; // Only filter if explicitly provided

    console.log('[JOBS API] GET request', {
      status,
      customerId,
      limit,
      nextToken,
      boardDate,
      statusType: typeof status,
      statusIsNull: status === null,
      statusIsUndefined: status === undefined,
    });

    // List jobs with filters - pass options explicitly
    // For now, don't pass boardDate to listJobs to avoid filter expression issues
    // We'll filter at the application level instead
    const listJobsOptions = {
      status,
      customerId,
      limit: 200, // Increased limit to scan more jobs instead of using DB-level date filter
      nextToken,
      // boardDate: boardDate || undefined, // Temporarily disabled - filter at app level instead
    };
    
    console.log('[JOBS API] Calling listJobs with options:', JSON.stringify(listJobsOptions, null, 2));
    
    const result = await listJobs(listJobsOptions);

    console.log('[JOBS API] listJobs returned', {
      totalJobs: result.jobs.length,
      hasNextToken: !!result.nextToken,
      firstJobId: result.jobs[0]?.jobId,
      firstJobStatus: result.jobs[0]?.status,
      firstJobAppointment: result.jobs[0]?.appointmentTime,
    });

    // Apply board date filtering ONLY if boardDate is explicitly provided
    // Note: When boardDate is provided, listJobs already pre-filtered at DB level
    // This is additional validation to ensure data consistency
    const filteredJobs = boardDate 
      ? filterJobsByBoardDate(result.jobs, boardDate)
      : result.jobs;

    // Log filtering stats for debugging (only if filtering is applied)
    if (boardDate) {
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
    } else {
      console.log('[JOBS API] No date filtering - returning all jobs', {
        totalJobs: result.jobs.length,
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        jobs: filteredJobs,
        count: filteredJobs.length,
        nextToken: result.nextToken,
        environment: config.env,
        ...(boardDate && { 
          boardDate,
          timezone: getDayBoundaries(boardDate).timezone 
        }),
        // DEBUG INFO
        _debug: {
          queryStatus: status,
          queryCustomerId: customerId,
          jobsFromListJobs: result.jobs.length,
          jobsAfterFiltering: filteredJobs.length,
          boardDateProvided: !!boardDate,
          firstRawJob: result.jobs[0] ? {
            jobId: result.jobs[0].jobId,
            status: result.jobs[0].status,
            appointmentTime: result.jobs[0].appointmentTime,
          } : null,
        },
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
        details: error.stack || undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
