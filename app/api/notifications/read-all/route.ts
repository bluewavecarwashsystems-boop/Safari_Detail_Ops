/**
 * Notifications API - Mark all notifications as read
 * 
 * POST /api/notifications/read-all?locationId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { ApiResponse } from '@/lib/types';
import * as notificationService from '@/lib/services/notification-service';

const FRANKLIN_LOCATION_ID = 'L9ZMZD9TTTTZJ';

export const POST = requireAuth(async (
  request: NextRequest,
  session
): Promise<NextResponse<ApiResponse>> => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get('locationId') || FRANKLIN_LOCATION_ID;

    const markedCount = await notificationService.markAllAsRead(locationId);

    const response: ApiResponse = {
      success: true,
      data: {
        markedCount,
        locationId,
        markedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[NOTIFICATIONS MARK ALL READ ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOTIFICATIONS_MARK_ALL_READ_ERROR',
        message: error.message || 'Failed to mark all notifications as read',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
