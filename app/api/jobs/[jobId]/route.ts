/**
 * Jobs API - Get Single Job & Update Job
 * 
 * GET /api/jobs/[jobId] - Get a specific job by ID with photo URLs
 * PATCH /api/jobs/[jobId] - Update job (status, checklist, notes, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, UpdateJobRequest } from '@/lib/types';
import { WorkStatus, UserRole, PaymentStatus } from '@/lib/types';
import { getJobWithPhotos } from '@/lib/services/job-service';
import { requireAuth } from '@/lib/auth/requireAuth';
import { updateJobWithAudit } from '@/lib/services/job-service';
import * as dynamodb from '@/lib/aws/dynamodb';

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

    // Get current job to check for backward movement and issue operations
    const currentJob = await dynamodb.getJob(jobId);
    
    if (!currentJob) {
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

    // RULE: WORK_COMPLETED is irreversible - cannot move backward
    if (body.workStatus && currentJob.status === WorkStatus.WORK_COMPLETED && body.workStatus !== WorkStatus.WORK_COMPLETED) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Completed jobs cannot be moved backward. Use post-completion issue tracking instead.',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate post-completion issue operations
    if (body.openPostCompletionIssue || body.resolvePostCompletionIssue) {
      const userRole = session.role as UserRole;
      
      // Only MANAGER can open/resolve issues
      if (userRole !== UserRole.MANAGER) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only MANAGER can open or resolve post-completion issues',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 403 });
      }

      // Can only open/resolve issues on WORK_COMPLETED jobs
      if (currentJob.status !== WorkStatus.WORK_COMPLETED) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: 'Post-completion issues can only be managed on completed jobs',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Cannot open issue if one is already open
      if (body.openPostCompletionIssue && currentJob.postCompletionIssue?.isOpen) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'ISSUE_ALREADY_OPEN',
            message: 'An issue is already open for this job',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Cannot resolve issue if none is open
      if (body.resolvePostCompletionIssue && !currentJob.postCompletionIssue?.isOpen) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'NO_OPEN_ISSUE',
            message: 'No open issue to resolve',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Validate issue type if opening
      if (body.openPostCompletionIssue) {
        const validTypes = ['QC_MISS', 'CUSTOMER_COMPLAINT', 'DAMAGE', 'REDO', 'OTHER'];
        if (!validTypes.includes(body.openPostCompletionIssue.type)) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'INVALID_ISSUE_TYPE',
              message: `Invalid issue type. Must be one of: ${validTypes.join(', ')}`,
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }
      }
    }

    // Validate payment status updates
    if (body.payment) {
      const userRole = session.role as UserRole;
      
      // Only MANAGER can change payment status
      if (userRole !== UserRole.MANAGER) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only MANAGER can change payment status',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 403 });
      }

      // If marking as PAID, require at least one receipt photo
      if (body.payment.status === 'PAID') {
        if (!currentJob.receiptPhotos || currentJob.receiptPhotos.length === 0) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'RECEIPT_REQUIRED',
              message: 'At least one receipt photo is required to mark payment as PAID',
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }
      }

      // If marking as UNPAID, require a reason
      if (body.payment.status === 'UNPAID') {
        if (!body.payment.unpaidReason) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'UNPAID_REASON_REQUIRED',
              message: 'A reason is required when marking payment as UNPAID',
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }
      }
    }

    // Phase 5: Validate no-show operations
    if (body.noShow) {
      const userRole = session.role as UserRole;
      
      // Only MANAGER can mark/resolve no-show
      if (userRole !== UserRole.MANAGER) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only MANAGER can manage no-show status',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 403 });
      }

      // Marking as NO_SHOW
      if (body.noShow.status === 'NO_SHOW') {
        // Cannot mark NO_SHOW if already QC_READY or WORK_COMPLETED
        if (currentJob.status === WorkStatus.QC_READY || currentJob.status === WorkStatus.WORK_COMPLETED) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'INVALID_STATUS_FOR_NO_SHOW',
              message: 'Cannot mark as no-show when job is in QC_READY or WORK_COMPLETED status',
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }

        // Require reason when marking as NO_SHOW
        if (!body.noShow.reason) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NO_SHOW_REASON_REQUIRED',
              message: 'A reason is required when marking as no-show',
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }
      }

      // Resolving NO_SHOW
      if (body.noShow.status === 'RESOLVED') {
        // Can only resolve if currently marked as NO_SHOW
        if (!currentJob.noShow || currentJob.noShow.status !== 'NO_SHOW') {
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'NO_OPEN_NO_SHOW',
              message: 'Can only resolve when job is marked as no-show',
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }
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

