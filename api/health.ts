/**
 * Health Check Endpoint
 * 
 * GET /api/health
 * 
 * Returns the health status of the Safari Detail Ops application.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from '../lib/config';
import type { ApiResponse, HealthCheckResponse } from '../lib/types';

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
    // Get configuration
    const config = getConfig();
    
    // Basic health check response
    const healthData: HealthCheckResponse = {
      status: 'healthy',
      environment: config.env,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'up',
          message: 'API is operational',
        },
        // Future: Add DynamoDB, S3 health checks in later phases
      },
    };

    const response: ApiResponse<HealthCheckResponse> = {
      success: true,
      data: healthData,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: error.message || 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
}
