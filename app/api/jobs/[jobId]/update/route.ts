/**
 * Jobs API - Update Job
 * 
 * PATCH /api/jobs/[jobId]/update
 * 
 * Update job details (status, vehicle info, notes, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, WorkStatus } from '@/lib/types';
import { updateJobStatus, updateJobVehicle } from '@/lib/services/job-service';
import { updateJob } from '@/lib/aws/dynamodb';

export async function PATCH(
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

    const body = await request.json();
    const updates = body;
    const updatedBy = body.updatedBy || 'staff';

    // Handle different types of updates
    let updatedJob;

    if (updates.status) {
      // Update status
      updatedJob = await updateJobStatus(jobId, updates.status as WorkStatus, updatedBy);
    } else if (updates.vehicleInfo) {
      // Update vehicle info
      updatedJob = await updateJobVehicle(jobId, updates.vehicleInfo, updatedBy);
    } else {
      // Generic update
      updatedJob = await updateJob(jobId, { ...updates, updatedBy });
    }

    const response: ApiResponse = {
      success: true,
      data: updatedJob,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[JOB UPDATE ERROR]', {
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
}
