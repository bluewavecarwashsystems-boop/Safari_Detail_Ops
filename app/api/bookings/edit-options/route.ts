/**
 * GET /api/bookings/edit-options?bookingId=xxx
 * 
 * Returns the service options and current booking details for editing
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import { UserRole } from '@/lib/types';
import type { ApiResponse } from '@/lib/types';
import { retrieveBooking } from '@/lib/square/bookings-api';
import { listPhoneBookingServices } from '@/lib/square/catalog-api';

interface EditOptionsResponse {
  currentBooking: {
    bookingId: string;
    serviceVariationId: string;
    serviceVariationVersion: number;
    startAt: string;
    durationMinutes: number;
    teamMemberId?: string;
    locationId: string;
    status: string;
    version: number;
  };
  availableServices: Array<{
    id: string;
    itemId: string;
    name: string;
    description?: string;
    durationMinutes?: number;
    priceMoney?: {
      amount: number;
      currency: string;
    };
    version: number;
  }>;
}

export const GET = requireRole([UserRole.MANAGER], async (
  request: NextRequest,
  session
): Promise<NextResponse<ApiResponse<EditOptionsResponse>>> => {
  // Only managers can access edit options
  if (session.role !== UserRole.MANAGER) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can access edit options',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_BOOKING_ID',
            message: 'bookingId query parameter is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    console.log('[booking-edit] Fetching edit options', { bookingId });

    // Fetch current booking from Square
    const booking = await retrieveBooking(bookingId);

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_NOT_FOUND',
            message: `Booking ${bookingId} not found`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Extract current booking details
    const segment = booking.appointment_segments?.[0];
    if (!segment || !segment.service_variation_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BOOKING',
            message: 'Booking has no appointment segments',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const currentBooking = {
      bookingId: booking.id,
      serviceVariationId: segment.service_variation_id,
      serviceVariationVersion: segment.service_variation_version || 0,
      startAt: booking.start_at || '',
      durationMinutes: segment.duration_minutes || 60,
      teamMemberId: segment.team_member_id,
      locationId: booking.location_id || 'L9ZMZD9TTTTZJ',
      status: booking.status || 'ACCEPTED',
      version: booking.version || 0,
    };

    // Fetch available services for location L9ZMZD9TTTTZJ
    const services = await listPhoneBookingServices();

    console.log('[booking-edit] Fetched edit options', {
      bookingId,
      currentService: currentBooking.serviceVariationId,
      servicesCount: services.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        currentBooking,
        availableServices: services,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[booking-edit] Get edit options error', {
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to fetch edit options',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});
