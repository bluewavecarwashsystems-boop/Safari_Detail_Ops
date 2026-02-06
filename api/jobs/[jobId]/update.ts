/**
 * Jobs API - Update Job
 * 
 * PATCH /api/jobs/[jobId]/update
 * 
 * Update job details (status, vehicle info, notes, etc.).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiResponse, JobStatus } from '../../../lib/types';
import { updateJobStatus, updateJobVehicle } from '../../../lib/services/job-service';
import { updateJob } from '../../../lib/aws/dynamodb';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow PATCH requests
  if (req.method !== 'PATCH') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only PATCH requests are allowed',
      },
      timestamp: new Date().toISOString(),
    };
    res.status(405).json(response);
    return;
  }

  try {
    const jobId = req.query.jobId as string;

    if (!jobId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_JOB_ID',
          message: 'Job ID is required',
        },
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(response);
      return;
    }

    const updates = req.body;
    const updatedBy = req.body.updatedBy || 'staff';

    // Handle different types of updates
    let updatedJob;

    if (updates.status) {
      // Update status
      updatedJob = await updateJobStatus(jobId, updates.status as JobStatus, updatedBy);
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

    res.status(200).json(response);
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

    res.status(500).json(response);
  }
}
