/**
 * Jobs API - Get Single Job
 * 
 * GET /api/jobs/[jobId]
 * 
 * Get a specific job by ID with photo URLs.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ApiResponse } from '../../lib/types';
import { getJobWithPhotos } from '../../lib/services/job-service';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  //Only allow GET requests
  if (req.method !== 'GET') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET requests are allowed',
      },
      timestamp: new Date().toISOString(),
    };
    res.status(405).json(response);
    return;
  }

  try {
    // Extract jobId from query (Vercel routes [jobId].ts as query param)
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
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
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

    res.status(500).json(response);
  }
}
