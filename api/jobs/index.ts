/**
 * Jobs API - List and Query Jobs
 * 
 * GET /api/jobs
 * 
 * List all jobs with optional filtering.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from '../../lib/config';
import type { ApiResponse, JobStatus } from '../../lib/types';
import { listJobs } from '../../lib/services/job-service';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET requests
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
    const config = getConfig();
    
    // Parse query parameters
    const status = req.query.status as JobStatus | undefined;
    const customerId = req.query.customerId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const nextToken = req.query.nextToken as string | undefined;

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

    res.status(200).json(response);
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

    res.status(500).json(response);
  }
}
