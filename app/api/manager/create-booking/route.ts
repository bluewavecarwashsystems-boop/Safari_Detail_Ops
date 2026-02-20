/**
 * Phase 5: Manager Phone Booking Creation API
 * 
 * POST /api/manager/create-booking
 * 
 * Manager-only endpoint to create bookings via phone
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, CreateManagerBookingRequest, CreateManagerBookingResponse } from '@/lib/types';
import { WorkStatus, UserRole } from '@/lib/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import { findOrCreateCustomer } from '@/lib/square/customers-api';
import { createBooking } from '@/lib/square/bookings-api';
import * as dynamodb from '@/lib/aws/dynamodb';
import { getConfig } from '@/lib/config';

/**
 * POST /api/manager/create-booking
 * 
 * Create a phone booking (Manager-only)
 */
export const POST = requireAuth(async (
  request: NextRequest,
  session
): Promise<NextResponse> => {
  try {
    const userRole = session.role as UserRole;
    
    // Only MANAGER can create phone bookings
    if (userRole !== UserRole.MANAGER) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can create phone bookings',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body: CreateManagerBookingRequest = await request.json();

    // Validate required fields
    if (!body.customer?.name || !body.customer?.phone) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Customer name and phone are required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!body.service?.serviceName || !body.service?.durationMinutes) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Service name and duration are required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!body.appointmentTime?.startAt) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Appointment start time is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    const config = getConfig();
    const locationId = config.square.locationId;

    if (!locationId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Square location ID not configured',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 500 });
    }

    // Step 1: Find or create customer in Square
    console.log('[MANAGER BOOKING] Finding/creating customer', {
      name: body.customer.name,
      phone: body.customer.phone,
    });

    const customer = await findOrCreateCustomer({
      name: body.customer.name,
      phone: body.customer.phone,
      email: body.customer.email,
    });

    console.log('[MANAGER BOOKING] Customer ready', {
      customerId: customer.id,
      isNew: !customer.id,
    });

    // Step 2: Create booking in Square
    // Note: For MVP, we use a default service variation ID
    // In production, you'd have a catalog lookup or predefined service IDs
    const serviceVariationId = body.service.serviceVariationId || 'default-service-variation-id';
    const serviceVariationVersion = 1;

    console.log('[MANAGER BOOKING] Creating Square booking', {
      customerId: customer.id,
      startAt: body.appointmentTime.startAt,
    });

    const squareBooking = await createBooking({
      customerId: customer.id,
      locationId: locationId,
      serviceVariationId: serviceVariationId,
      serviceVariationVersion: serviceVariationVersion,
      startAt: body.appointmentTime.startAt,
      durationMinutes: body.service.durationMinutes,
      customerNote: body.notes,
      sellerNote: body.vehicle ? 
        `Vehicle: ${body.vehicle.year || ''} ${body.vehicle.make || ''} ${body.vehicle.model || ''}`.trim() : 
        undefined,
    });

    console.log('[MANAGER BOOKING] Square booking created', {
      bookingId: squareBooking.id,
    });

    // Step 3: Create job in DynamoDB immediately (don't wait for webhook)
    const jobId = squareBooking.id; // Use booking ID as job ID for consistency

    // Check if job already exists (idempotency)
    const existingJob = await dynamodb.getJob(jobId);
    if (existingJob) {
      console.log('[MANAGER BOOKING] Job already exists, returning existing', {
        jobId,
      });

      const response: ApiResponse<CreateManagerBookingResponse> = {
        success: true,
        data: {
          jobId: existingJob.jobId,
          bookingId: squareBooking.id,
          job: existingJob,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    }

    // Create new job
    const now = new Date().toISOString();
    const job = await dynamodb.createJob({
      jobId: jobId,
      customerId: customer.id,
      customerName: body.customer.name,
      customerEmail: body.customer.email,
      customerPhone: body.customer.phone,
      vehicleInfo: {
        make: body.vehicle?.make,
        model: body.vehicle?.model,
        year: body.vehicle?.year,
        color: body.vehicle?.color,
      },
      serviceType: body.service.serviceName,
      status: WorkStatus.SCHEDULED,
      bookingId: squareBooking.id,
      appointmentTime: body.appointmentTime.startAt,
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: `manager-phone:${session.sub}`,
      customerCached: {
        id: customer.id,
        name: body.customer.name,
        email: body.customer.email,
        phone: body.customer.phone,
        cachedAt: now,
      },
      photosMeta: [],
      statusHistory: [
        {
          from: null,
          to: WorkStatus.SCHEDULED,
          event: 'STATUS_CHANGE',
          changedAt: now,
          changedBy: {
            userId: session.sub,
            name: session.name,
            role: UserRole.MANAGER,
          },
          reason: 'Phone booking created by manager',
        },
      ],
    });

    console.log('[MANAGER BOOKING] Job created in DynamoDB', {
      jobId: job.jobId,
    });

    const response: ApiResponse<CreateManagerBookingResponse> = {
      success: true,
      data: {
        jobId: job.jobId,
        bookingId: squareBooking.id,
        job: job,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('[MANAGER BOOKING ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'BOOKING_CREATION_ERROR',
        message: error.message || 'Failed to create booking',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
