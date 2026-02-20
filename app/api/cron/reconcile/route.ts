/**
 * Reconciliation Cron Endpoint
 * 
 * GET /api/cron/reconcile?token=<secret>
 * 
 * Reconciles Square bookings with DynamoDB jobs.
 * Protected by CRON_SECRET token (not session-based).
 * 
 * Called by Vercel Cron on schedule (every 10-15 minutes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { 
  reconcileBookings, 
  getTimeRangeWithBuffer,
  type ReconciliationResult 
} from '@/lib/reconcile/reconcileBookings';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Disable body size limit for cron routes
export const maxDuration = 60; // 60 seconds max execution time

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Check CRON_SECRET token
    const token = request.nextUrl.searchParams.get('token');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CRON RECONCILE] CRON_SECRET not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
        },
        { status: 500 }
      );
    }

    if (!token || token !== cronSecret) {
      console.warn('[CRON RECONCILE] Invalid or missing token', {
        hasToken: !!token,
        tokenValid: token === cronSecret,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    console.log('[CRON RECONCILE] Starting reconciliation');

    // Get config for location filtering
    const config = getConfig();
    
    // Get time range (yesterday to tomorrow for buffer)
    const timeRange = getTimeRangeWithBuffer();

    // Run reconciliation
    const result: ReconciliationResult = await reconcileBookings({
      startAtMin: timeRange.startAtMin,
      startAtMax: timeRange.startAtMax,
      locationId: config.square.franklinLocationId || undefined,
      dryRun: false,
    });

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    console.log('[CRON RECONCILE] Reconciliation complete', {
      ...result,
      totalDurationMs: durationMs,
    });

    // Return summary
    return NextResponse.json(
      {
        success: true,
        data: {
          ...result,
          totalDurationMs: durationMs,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    console.error('[CRON RECONCILE] Reconciliation error', {
      error: error.message,
      stack: error.stack,
      durationMs,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RECONCILIATION_ERROR',
          message: error.message || 'Failed to reconcile bookings',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
