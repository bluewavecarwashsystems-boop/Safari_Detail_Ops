import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

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
  aws: {
    region: string;
    dynamodb_table: string;
    s3_bucket: string;
    credentials_configured: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    const build = process.env.VERCEL_GIT_COMMIT_SHA || null;
    const hasAwsCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    
    const healthData: PhaseAHealthResponse = {
      app_env: config.env,
      square_env: config.square.environment,
      timestamp: new Date().toISOString(),
      franklin_location_id: config.square.franklinLocationId,
      build: build,
      aws: {
        region: config.aws.region,
        dynamodb_table: config.aws.dynamodb.jobsTable,
        s3_bucket: config.aws.s3.photosBucket,
        credentials_configured: hasAwsCreds,
      },
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
