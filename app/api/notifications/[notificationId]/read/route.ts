/**
 * Notifications API - Mark single notification as read
 * 
 * POST /api/notifications/[notificationId]/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { ApiResponse } from '@/lib/types';
import * as notificationService from '@/lib/services/notification-service';

export const POST = requireAuth(async (
  request: NextRequest,
  session,
  context: { params: Promise<{ notificationId: string }> | { notificationId: string } }
): Promise<NextResponse<ApiResponse>> => {
  try {
    // Await params in case it's a Promise (Next.js 15+)
    const params = await Promise.resolve(context.params);
    const notificationId = params.notificationId;

    if (!notificationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_NOTIFICATION_ID',
            message: 'Notification ID is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    await notificationService.markAsRead(notificationId);

    const response: ApiResponse = {
      success: true,
      data: {
        notificationId,
        readAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[NOTIFICATION MARK READ ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOTIFICATION_MARK_READ_ERROR',
        message: error.message || 'Failed to mark notification as read',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
