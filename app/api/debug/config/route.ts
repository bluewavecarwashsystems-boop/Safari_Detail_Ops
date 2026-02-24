import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check configuration values
 * TEMPORARY - Remove after diagnosing phone booking issue
 */
export async function GET() {
  try {
    const config = getConfig();
    
    return NextResponse.json({
      success: true,
      data: {
        environment: config.square.environment,
        franklinLocationId: config.square.franklinLocationId,
        hasAccessToken: !!config.square.accessToken,
        accessTokenLength: config.square.accessToken?.length || 0,
        envVars: {
          SQUARE_ENV: process.env.SQUARE_ENV || 'NOT SET',
          FRANKLIN_SQUARE_LOCATION_ID: process.env.FRANKLIN_SQUARE_LOCATION_ID || 'NOT SET',
          APP_ENV: process.env.APP_ENV || 'NOT SET',
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
