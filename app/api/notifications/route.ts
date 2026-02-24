/**
 * Notifications API - List and retrieve notifications
 * 
 * GET /api/notifications?locationId=xxx&since=xxx
 * 
 * Returns notifications for a location with unread count
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { ApiResponse, NotificationListResponse } from '@/lib/types';
import * as notificationService from '@/lib/services/notification-service';

const FRANKLIN_LOCATION_ID = 'L9ZMZD9TTTTZJ';

export const GET = requireAuth(async (
  request: NextRequest,
  session
): Promise<NextResponse<ApiResponse<NotificationListResponse>>> => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get('locationId') || FRANKLIN_LOCATION_ID;
    const since = searchParams.get('since') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit must be between 1 and 100',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Get notifications
    const notifications = await notificationService.getNotifications(
      locationId,
      since,
      limit
    );

    // Get unread count
    const unreadCount = await notificationService.getUnreadCount(locationId);

    const response: ApiResponse<NotificationListResponse> = {
      success: true,
      data: {
        notifications,
        unreadCount,
        hasMore: notifications.length === limit,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[NOTIFICATIONS LIST ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOTIFICATIONS_LIST_ERROR',
        message: error.message || 'Failed to list notifications',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
