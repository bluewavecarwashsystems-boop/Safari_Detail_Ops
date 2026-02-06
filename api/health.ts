/**
 * Health Check Endpoint - Phase A
 * 
 * GET /api/health
 * 
 * Returns the health status of the Safari Detail Ops application.
 * Minimal endpoint scaffolding - does not expose secrets.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health check response structure for Phase A
 */
interface PhaseAHealthResponse {
  app_env: string;
  square_env: string;
  timestamp: string;
  franklin_location_id: string | null;
  build: string | null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Phase A: Defensive - never crash if env vars missing
    const appEnv = process.env.APP_ENV || 'unknown';
    const squareEnv = process.env.SQUARE_ENV || 'unknown';
    const franklinLocationId = process.env.FRANKLIN_SQUARE_LOCATION_ID || null;
    const build = process.env.VERCEL_GIT_COMMIT_SHA || null;
    
    const healthData: PhaseAHealthResponse = {
      app_env: appEnv,
      square_env: squareEnv,
      timestamp: new Date().toISOString(),
      franklin_location_id: franklinLocationId,
      build: build,
    };

    res.status(200).json(healthData);
  } catch (error) {
    // Phase A: Never crash - return minimal error response
    console.error('Health check error:', error);
    res.status(500).json({
      app_env: 'unknown',
      square_env: 'unknown',
      timestamp: new Date().toISOString(),
      franklin_location_id: null,
      build: null,
      error: 'Internal health check error',
    });
  }
}
