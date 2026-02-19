/**
 * Jobs API - Get Single Job & Update Job
 * 
 * GET /api/jobs/[jobId] - Get a specific job by ID with photo URLs
 * PATCH /api/jobs/[jobId] - Update job (status, checklist, notes, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, UpdateJobRequest } from '@/lib/types';
import { WorkStatus, UserRole } from '@/lib/types';
import { getJobWithPhotos } from '@/lib/services/job-service';
import { requireAuth } from '@/lib/auth/requireAuth';
import { updateJobWithAudit } from '@/lib/services/job-service';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
): Promise<NextResponse> {
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

/**
 * PATCH /api/jobs/[jobId]
 * 
 * Update job with audit trail
 * Supports partial updates for:
 * - workStatus
 * - checklist (tech/qc)
 * - notes
 * - vehicleInfo
 */
export const PATCH = requireAuth(async (
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

    const body: UpdateJobRequest = await request.json();

    // Validate workStatus if provided
    if (body.workStatus) {
      const validStatuses = Object.values(WorkStatus);
      if (!validStatuses.includes(body.workStatus)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Invalid work status. Must be one of: ${validStatuses.join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Validate checklist role permissions
    if (body.checklist) {
      const userRole = session.role as UserRole;
      
      if (body.checklist.tech && userRole !== UserRole.TECH && userRole !== UserRole.MANAGER) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only TECH and MANAGER can update tech checklist',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 403 });
      }
      
      if (body.checklist.qc && userRole !== UserRole.QC && userRole !== UserRole.MANAGER) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only QC and MANAGER can update QC checklist',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 403 });
      }
    }

    // Update job with audit trail
    const updatedJob = await updateJobWithAudit(jobId, body, {
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
    console.error('[JOB PATCH ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'JOB_UPDATE_ERROR',
        message: error.message || 'Failed to update job',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});

