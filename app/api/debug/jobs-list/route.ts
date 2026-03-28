/**
 * Debug: List jobs API response
 * 
 * GET /api/debug/jobs-list?boardDate=2026-03-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { listJobs } from '@/lib/services/job-service';
import { filterJobsByBoardDate, getFilteringStats } from '@/lib/utils/board-filters';
import { getDayBoundaries } from '@/lib/utils/timezone';

export async function GET(request: NextRequest) {
  const boardDate = request.nextUrl.searchParams.get('boardDate');
  
  try {
    // Fetch all jobs
    const result = await listJobs({ limit: 100 });
    
    console.log('[DEBUG JOBS] Total jobs in DB:', result.jobs.length);
    
    // Show raw jobs
    const rawJobsSummary = result.jobs.map(j => ({
      jobId: j.jobId,
      status: j.status,
      workStatus: j.workStatus,
      appointmentTime: j.appointmentTime,
      customerName: j.customerName,
    }));

    // Apply filtering
    const filteredJobs = boardDate 
      ? filterJobsByBoardDate(result.jobs, boardDate)
      : result.jobs;

    const boundaries = boardDate ? getDayBoundaries(boardDate) : null;
    const stats = boardDate ? getFilteringStats(result.jobs, filteredJobs, boardDate) : null;

    console.log('[DEBUG JOBS] Filtering results:', {
      boardDate,
      totalFetched: result.jobs.length,
      totalAfterFilter: filteredJobs.length,
      stats,
    });

    return NextResponse.json({
      debug: true,
      boardDate,
      boundaries,
      stats,
      allJobsCount: result.jobs.length,
      filteredJobsCount: filteredJobs.length,
      rawJobs: rawJobsSummary,
      filteredJobs: filteredJobs.map(j => ({
        jobId: j.jobId,
        bookingId: j.bookingId,
        status: j.status,
        workStatus: j.workStatus,
        appointmentTime: j.appointmentTime,
        customerName: j.customerName,
        serviceType: j.serviceType,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
