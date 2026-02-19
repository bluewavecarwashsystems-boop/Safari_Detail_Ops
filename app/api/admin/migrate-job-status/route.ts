/**
 * Data Migration API: JobStatus to WorkStatus
 * 
 * POST /api/admin/migrate-job-status
 * 
 * Migrates jobs from old JobStatus enum values to new WorkStatus enum values.
 * This is a one-time migration endpoint.
 * 
 * Query params:
 *   ?dryRun=true    - Preview changes without applying them
 *   ?confirm=true   - Required to actually perform migration
 */

import { NextRequest, NextResponse } from 'next/server';
import { listJobs, updateJob } from '@/lib/aws/dynamodb';
import { WorkStatus } from '@/lib/types';
import type { ApiResponse, Job } from '@/lib/types';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Map old JobStatus values to new WorkStatus values
 */
const STATUS_MIGRATION_MAP: Record<string, WorkStatus> = {
  'pending': WorkStatus.SCHEDULED,
  'in_progress': WorkStatus.IN_PROGRESS,
  'completed': WorkStatus.WORK_COMPLETED,
  'cancelled': WorkStatus.NO_SHOW_PENDING_CHARGE,
};

/**
 * Check if status value is an old JobStatus that needs migration
 */
function isOldStatus(status: string): boolean {
  return status in STATUS_MIGRATION_MAP;
}

/**
 * POST /api/admin/migrate-job-status
 * 
 * Run migration to convert old JobStatus to WorkStatus
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dryRun = searchParams.get('dryRun') === 'true';
  const confirm = searchParams.get('confirm') === 'true';

  try {
    console.log('[MIGRATION START]', { dryRun, confirm });

    // Scan all jobs
    const { jobs } = await listJobs({ limit: 1000 });
    
    console.log('[MIGRATION SCAN]', {
      totalJobs: jobs.length,
    });

    // Find jobs with old status
    const jobsToMigrate: Array<{
      jobId: string;
      oldStatus: string;
      newStatus: WorkStatus;
    }> = [];

    for (const job of jobs) {
      if (isOldStatus(job.status as string)) {
        const newStatus = STATUS_MIGRATION_MAP[job.status as string];
        if (newStatus) {
          jobsToMigrate.push({
            jobId: job.jobId,
            oldStatus: job.status as string,
            newStatus,
          });
        }
      }
    }

    console.log('[MIGRATION FOUND]', {
      jobsToMigrate: jobsToMigrate.length,
      jobs: jobsToMigrate,
    });

    // If dry run, just return what would be migrated
    if (dryRun || !confirm) {
      const response: ApiResponse = {
        success: true,
        data: {
          mode: dryRun ? 'dry-run' : 'preview',
          totalJobsScanned: jobs.length,
          jobsRequiringMigration: jobsToMigrate.length,
          migrations: jobsToMigrate,
          message: dryRun 
            ? 'Dry run complete. No changes made.'
            : 'Add ?confirm=true to perform migration',
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    }

    // Perform migration
    const results = {
      successful: [] as string[],
      failed: [] as { jobId: string; error: string }[],
    };

    for (const job of jobsToMigrate) {
      try {
        await updateJob(job.jobId, {
          status: job.newStatus,
        });

        results.successful.push(job.jobId);
        
        console.log('[MIGRATION SUCCESS]', {
          jobId: job.jobId,
          oldStatus: job.oldStatus,
          newStatus: job.newStatus,
        });
      } catch (error: any) {
        results.failed.push({
          jobId: job.jobId,
          error: error.message,
        });

        console.error('[MIGRATION FAILED]', {
          jobId: job.jobId,
          error: error.message,
        });
      }
    }

    const response: ApiResponse = {
      success: results.failed.length === 0,
      data: {
        mode: 'migration-complete',
        totalJobsScanned: jobs.length,
        jobsMigrated: results.successful.length,
        jobsFailed: results.failed.length,
        successful: results.successful,
        failed: results.failed,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { 
      status: results.failed.length > 0 ? 207 : 200 
    });

  } catch (error: any) {
    console.error('[MIGRATION ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'MIGRATION_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * GET /api/admin/migrate-job-status
 * 
 * Preview migration (same as POST with dryRun=true)
 */
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  searchParams.set('dryRun', 'true');
  
  const newRequest = new NextRequest(
    new URL(`${request.url}?dryRun=true`),
    request
  );
  
  return POST(newRequest);
}
