/**
 * PATCH /api/bookings/[id]
 * 
 * Updates a Square booking (service and/or start time)
 * Syncs changes to internal job record
 */

import { NextRequest,NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import { UserRole } from '@/lib/types';
import type { ApiResponse } from '@/lib/types';
import { retrieveBooking, updateBookingDetails } from '@/lib/square/bookings-api';
import * as dynamodb from '@/lib/aws/dynamodb';
import { getConfig } from '@/lib/config';

interface UpdateBookingRequest {
  serviceVariationId: string;
  serviceVariationVersion: number;
  startAt: string; // ISO timestamp
  durationMinutes: number;
}

interface UpdateBookingResponse {
  booking: any; // Updated Square booking
  job: any; // Updated internal job
}

export const PATCH = requireRole([UserRole.MANAGER], async (
  request: NextRequest,
  session,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<UpdateBookingResponse>>> => {
  // Only managers can update bookings
  if (session.role !== UserRole.MANAGER) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can update bookings',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }

  try {
    const bookingId = params.id;
    const body: UpdateBookingRequest = await request.json();
    const config = getConfig();

    console.log('[booking-edit] Updating booking', {
      bookingId,
      oldStart: '<to be fetched>',
      newStart: body.startAt,
      oldService: '<to be fetched>',
      newService: body.serviceVariationId,
    });

    // Step 1: Fetch current booking from Square
    const currentBooking = await retrieveBooking(bookingId);

    if (!currentBooking) {
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

    // Step 2: Validate booking status - cannot edit cancelled/completed bookings
    const invalidStatuses = ['CANCELLED', 'DECLINED', 'NO_SHOW', 'COMPLETED'];
    if (invalidStatuses.includes(currentBooking.status?.toUpperCase() || '')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_NOT_EDITABLE',
            message: `Cannot edit booking with status: ${currentBooking.status}`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Log the actual old values
    const oldSegment = currentBooking.appointment_segments?.[0];
    console.log('[booking-edit] Current booking state', {
      bookingId,
      oldStart: currentBooking.start_at,
      newStart: body.startAt,
      oldService: oldSegment?.service_variation_id,
      newService: body.serviceVariationId,
    });

    // Step 3: Check if booking is in the past
    const bookingTime = new Date(body.startAt);
    const now = new Date();
    if (bookingTime < now) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAST_TIME',
            message: 'Cannot schedule booking in the past',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Step 4: Update booking in Square
    const updatedBooking = await updateBookingDetails({
      bookingId,
      version: currentBooking.version || 0,
      locationId: 'L9ZMZD9TTTTZJ', // Force location
      serviceVariationId: body.serviceVariationId,
      serviceVariationVersion: body.serviceVariationVersion,
      startAt: body.startAt,
      durationMinutes: body.durationMinutes,
      teamMemberId: oldSegment?.team_member_id, // Preserve team member
      customerNote: currentBooking.customer_note,
      sellerNote: currentBooking.seller_note,
    });

    console.log('[booking-edit] Square booking updated', {
      bookingId,
      newVersion: updatedBooking.version,
    });

    // Step 5: Update internal job record
    const job = await dynamodb.getJob(bookingId);

    if (job) {
      const updates: any = {
        appointmentTime: body.startAt,
        updatedAt: new Date().toISOString(),
        updatedBy: {
          userId: session.sub, // sub is userId from SessionPayload
          name: session.name,
          role: session.role as 'MANAGER',
        },
      };

      // Note: serviceType is updated separately via catalog lookup if needed
      // For now, we just update the core booking fields

      const updatedJob = await dynamodb.updateJob(bookingId, updates);

      console.log('[booking-edit] Job record updated', {
        jobId: bookingId,
        newStart: updates.appointmentTime,
      });

      return NextResponse.json({
        success: true,
        data: {
          booking: updatedBooking,
          job: updatedJob,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      // Booking updated but no job found (shouldn't happen normally)
      console.warn('[booking-edit] Booking updated but job not found', { bookingId });

      return NextResponse.json({
        success: true,
        data: {
          booking: updatedBooking,
          job: null,
        },
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error: any) {
    console.error('[booking-edit] Update booking error', {
      bookingId: params.id,
      error: error.message,
      stack: error.stack,
    });

    // Check if it's a Square API conflict error
    if (error.message?.includes('VERSION_MISMATCH') || error.message?.includes('version')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BOOKING_CHANGED',
            message: 'Booking was changed elsewhere. Please reload and try again.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Check if it's an availability error
    if (error.message?.includes('not available') || error.message?.includes('INVALID_REQUEST_ERROR')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SLOT_NOT_AVAILABLE',
            message: 'The selected time slot is not available',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to update booking',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});
