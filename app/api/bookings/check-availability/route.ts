/**
 * POST /api/bookings/check-availability
 * 
 * Checks if a booking time slot is available for a service
 * Uses Square Bookings Availability API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import { UserRole } from '@/lib/types';
import type { ApiResponse } from '@/lib/types';
import { getConfig } from '@/lib/config';

interface CheckAvailabilityRequest {
  bookingId: string;
  serviceVariationId: string;
  serviceVariationVersion: number;
  startAt: string; // ISO timestamp
  durationMinutes: number;
  teamMemberId?: string;
}

interface CheckAvailabilityResponse {
  available: boolean;
  suggestedStartTimes?: string[];
  conflict?: {
    code: string;
    message: string;
  };
}

export const POST = requireRole([UserRole.MANAGER], async (
  request: NextRequest,
  session
): Promise<NextResponse<ApiResponse<CheckAvailabilityResponse>>> => {
  // Only managers can check availability
  if (session.role !== UserRole.MANAGER) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can check availability',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }

  try {
    const body: CheckAvailabilityRequest = await request.json();
    const config = getConfig();

    console.log('[booking-edit] Checking availability', {
      bookingId: body.bookingId,
      serviceVariationId: body.serviceVariationId,
      startAt: body.startAt,
      durationMinutes: body.durationMinutes,
    });

    // Force location L9ZMZD9TTTTZJ
    const locationId = 'L9ZMZD9TTTTZJ';
    
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';

    // Build availability search request
    // Note: segment_filters only accepts service_variation_id
    // Duration is inferred from the service variation
    const availabilityBody = {
      query: {
        filter: {
          location_id: locationId,
          start_at_range: {
            start_at: body.startAt,
            end_at: body.startAt, // Check exact time
          },
          segment_filters: [
            {
              service_variation_id: body.serviceVariationId,
            }
          ],
        },
      },
    };

    const response = await fetch(`${baseUrl}/v2/bookings/availability/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify(availabilityBody),
    });

    const data = await response.json();

    if (!response.ok || (data.errors && data.errors.length > 0)) {
      console.error('[booking-edit] Availability check failed', {
        status: response.status,
        errors: data.errors,
      });

      const errorMsg = data.errors?.map((e: any) => e.detail || e.code).join(', ') || 'Unknown error';
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AVAILABILITY_CHECK_FAILED',
            message: errorMsg,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if the requested time is available
    const availabilities = data.availabilities || [];
    const isAvailable = availabilities.some((avail: any) => avail.start_at === body.startAt);

    // Extract suggested times if not available
    const suggestedStartTimes = availabilities
      .map((avail: any) => avail.start_at)
      .filter((time: string) => time !== body.startAt)
      .slice(0, 5); // Limit to 5 suggestions

    console.log('[booking-edit] Availability check result', {
      available: isAvailable,
      suggestedCount: suggestedStartTimes.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        available: isAvailable,
        suggestedStartTimes: isAvailable ? undefined : suggestedStartTimes,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[booking-edit] Check availability error', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to check availability',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});
