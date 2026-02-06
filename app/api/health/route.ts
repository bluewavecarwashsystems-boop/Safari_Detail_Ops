import { NextRequest, NextResponse } from 'next/server';

/**
 * Health Check Endpoint - Phase A/B
 * 
 * GET /api/health
 * 
 * Returns the health status of the Safari Detail Ops application.
 */

interface PhaseAHealthResponse {
  app_env: string;
  square_env: string;
  timestamp: string;
  franklin_location_id: string | null;
  build: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Phase A/B: Defensive - never crash if env vars missing
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

    return NextResponse.json(healthData);
  } catch (error) {
    // Phase A/B: Never crash - return minimal error response
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        app_env: 'unknown',
        square_env: 'unknown',
        timestamp: new Date().toISOString(),
        franklin_location_id: null,
        build: null,
        error: 'Internal health check error',
      },
      { status: 500 }
    );
  }
}
