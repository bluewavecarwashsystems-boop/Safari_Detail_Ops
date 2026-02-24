import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { getEnvironmentConfig, isProduction } from '@/lib/env';
import { getTableNamesSummary } from '@/lib/awsTables';

/**
 * Health Check Endpoint - Production Ready
 * 
 * GET /api/health
 * 
 * Returns comprehensive health and environment status.
 * Used for:
 * - Verifying correct environment deployment
 * - Debugging configuration issues
 * - Monitoring service health
 */

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'error';
  app_env: string;
  square_env: string;
  timestamp: string;
  build: string | null;
  environment: {
    app_environment: string;
    square_environment: string;
    is_production: boolean;
    environment_validated: boolean;
  };
  square: {
    location_id: string | null;
    team_member_id: string | null;
    webhook_signature_configured: boolean;
  };
  aws: {
    region: string;
    credentials_configured: boolean;
    tables: Record<string, string>;
  };
  vercel?: {
    commit_sha: string | null;
    git_branch: string | null;
    url: string | null;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get configuration (with validation)
    const config = getConfig();
    let envConfig;
    let environmentValidated = true;
    
    try {
      envConfig = getEnvironmentConfig();
    } catch (error) {
      // Environment validation failed
      environmentValidated = false;
      console.error('[HEALTH] Environment validation failed:', error);
    }
    
    const hasAwsCreds = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const hasWebhookKey = !!config.square.webhookSignatureKey;
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (!environmentValidated) {
      status = 'error';
    } else if (!hasAwsCreds || (!hasWebhookKey && isProduction())) {
      status = 'degraded';
    }
    
    const healthData: HealthResponse = {
      status,
      app_env: config.env,
      square_env: config.square.environment,
      timestamp: new Date().toISOString(),
      build: process.env.VERCEL_GIT_COMMIT_SHA || null,
      environment: {
        app_environment: config.env,
        square_environment: config.square.environment,
        is_production: isProduction(),
        environment_validated: environmentValidated,
      },
      square: {
        location_id: config.square.franklinLocationId,
        team_member_id: config.square.teamMemberId,
        webhook_signature_configured: hasWebhookKey,
      },
      aws: {
        region: config.aws.region,
        credentials_configured: hasAwsCreds,
        tables: getTableNamesSummary(),
      },
      vercel: {
        commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        git_branch: process.env.VERCEL_GIT_COMMIT_REF || null,
        url: process.env.VERCEL_URL || null,
      },
    };

    return NextResponse.json(healthData);
  } catch (error) {
    // Never crash - return error response
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        app_env: 'unknown',
        square_env: 'unknown',
        timestamp: new Date().toISOString(),
        build: null,
        environment: {
          app_environment: 'unknown',
          square_environment: 'unknown',
          is_production: false,
          environment_validated: false,
        },
        error: 'Internal health check error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
