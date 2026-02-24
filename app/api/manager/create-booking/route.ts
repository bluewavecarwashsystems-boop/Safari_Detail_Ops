/**
 * Phase 5: Manager Phone Booking Creation API
 * 
 * POST /api/manager/create-booking
 * 
 * Manager-only endpoint to create bookings via phone
 * RESTRICTED to location L9ZMZD9TTTTZJ
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, CreateManagerBookingRequest, CreateManagerBookingResponse } from '@/lib/types';
import { WorkStatus, UserRole } from '@/lib/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import { findOrCreateCustomer } from '@/lib/square/customers-api';
import { createBooking } from '@/lib/square/bookings-api';
import { listPhoneBookingServices, listAddons } from '@/lib/square/catalog-api';
import { createOrder } from '@/lib/square/orders-api';
import type { OrderLineItem } from '@/lib/square/orders-api';
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
    const locationId = config.square.franklinLocationId;

    console.log('[MANAGER BOOKING] Configuration:', {
      locationId,
      environment: config.square.environment,
      hasAccessToken: !!config.square.accessToken,
    });

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

    // Step 2: Validate service variation ID is from allowed location
    if (!body.service.serviceVariationId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Service variation ID is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    const serviceVariationId = body.service.serviceVariationId;
    const isProduction = config.square.environment === 'production';
    
    // SERVER-SIDE VALIDATION: In production, ensure service is from the allowed location
    if (isProduction && locationId) {
      console.log('[MANAGER BOOKING] Validating service variation (production)', {
        serviceVariationId,
        requiredLocation: locationId,
      });
      
      const allowedServices = await listPhoneBookingServices();
      const isValidService = allowedServices.some(s => s.id === serviceVariationId);
      
      if (!isValidService) {
        console.error('[MANAGER BOOKING] SECURITY: Attempted to book service not from allowed location', {
          serviceVariationId,
          allowedLocation: locationId,
          allowedServiceIds: allowedServices.map(s => s.id),
        });
        
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_SERVICE',
            message: `Service variation ${serviceVariationId} is not available at location ${locationId}`,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
      
      console.log('[MANAGER BOOKING] Service validated successfully', {
        serviceVariationId,
        locationId,
      });
    } else {
      console.log('[MANAGER BOOKING] Skipping service validation (sandbox/qa)', {
        serviceVariationId,
        environment: config.square.environment,
      });
    }

    // Step 3: Create booking in Square
    console.log('[MANAGER BOOKING] Service validated successfully', {
      serviceVariationId,
      locationId,
    });

    // Step 3: Validate and prepare add-ons if provided
    let addonVariations: Array<{ id: string; version: number }> = [];
    
    if (body.addonItemVariationIds && body.addonItemVariationIds.length > 0) {
      console.log('[MANAGER BOOKING] Fetching add-on details', {
        addonCount: body.addonItemVariationIds.length,
        addonIds: body.addonItemVariationIds,
      });
      
      // Fetch all add-ons to validate and get version numbers
      const availableAddons = await listAddons();
      
      // Validate and extract version numbers for each selected add-on
      for (const addonId of body.addonItemVariationIds) {
        const addon = availableAddons.find(a => a.id === addonId);
        
        if (!addon) {
          console.error('[MANAGER BOOKING] SECURITY: Invalid add-on variation ID', {
            addonId,
            locationId,
          });
          
          const response: ApiResponse = {
            success: false,
            error: {
              code: 'INVALID_ADDONS',
              message: `Invalid add-on variation ID: ${addonId}`,
            },
            timestamp: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 400 });
        }
        
        addonVariations.push({
          id: addon.id,
          version: addon.version,
        });
      }
      
      console.log('[MANAGER BOOKING] Add-ons validated', {
        count: addonVariations.length,
      });
    }

    // Step 4: Create booking in Square with add-ons as appointment segments
    const serviceVariationVersion = body.service.serviceVariationVersion || 1;

    console.log('[MANAGER BOOKING] Creating Square booking with add-ons as segments', {
      customerId: customer.id,
      startAt: body.appointmentTime.startAt,
      serviceVariationId,
      serviceVariationVersion,
      locationId,
      teamMemberId: config.square.teamMemberId || 'not set',
      addonCount: addonVariations.length,
    });

    const squareBooking = await createBooking({
      customerId: customer.id,
      locationId: locationId,
      serviceVariationId: serviceVariationId,
      serviceVariationVersion: serviceVariationVersion,
      startAt: body.appointmentTime.startAt,
      durationMinutes: body.service.durationMinutes,
      teamMemberId: config.square.teamMemberId && config.square.teamMemberId.trim() !== '' 
        ? config.square.teamMemberId 
        : undefined,
      customerNote: body.notes,
      sellerNote: body.vehicle ? 
        `Vehicle: ${body.vehicle.year || ''} ${body.vehicle.make || ''} ${body.vehicle.model || ''}`.trim() : 
        undefined,
      addonVariationIds: addonVariations.length > 0 ? addonVariations : undefined,
    });

    console.log('[MANAGER BOOKING] Square booking created with add-ons', {
      bookingId: squareBooking.id,
      segmentCount: squareBooking.appointment_segments?.length || 0,
    });

    // Step 4.5: Optionally create order for reference tracking (backward compatibility)
    let orderId: string | undefined = undefined;
    
    if (addonVariations.length > 0) {
      console.log('[MANAGER BOOKING] Creating reference order for add-ons tracking', {
        bookingId: squareBooking.id,
        addonCount: addonVariations.length,
      });
      
      try {
        const lineItems: OrderLineItem[] = addonVariations.map((addon) => ({
          catalog_object_id: addon.id,
          quantity: '1',
          metadata: {
            source: 'detail-ops-addon',
          },
        }));
        
        const order = await createOrder({
          locationId: locationId,
          lineItems: lineItems,
          metadata: {
            booking_id: squareBooking.id,
            source: 'phone-booking',
          },
        });
        
        orderId = order.id;
        
        console.log('[MANAGER BOOKING] Reference order created', {
          orderId: order.id,
          bookingId: squareBooking.id,
        });
      } catch (orderError: any) {
        console.error('[MANAGER BOOKING] Failed to create reference order', {
          error: orderError.message,
          bookingId: squareBooking.id,
        });
        
        // Don't fail - add-ons are already in the booking as appointment segments
        console.warn('[MANAGER BOOKING] Continuing without reference order (add-ons in booking segments)', {
          bookingId: squareBooking.id,
        });
      }
    }

    // Step 5: Create job in DynamoDB immediately (don't wait for webhook)
    const jobId = squareBooking.id; // Use booking ID as job ID for consistency

    console.log('[MANAGER BOOKING] Checking for existing job', {
      jobId,
      bookingId: squareBooking.id,
    });

    // Check if job already exists (idempotency)
    const existingJob = await dynamodb.getJob(jobId);
    if (existingJob) {
      console.log('[MANAGER BOOKING] Job already exists, returning existing', {
        jobId,
        existingJobCreatedAt: existingJob.createdAt,
        existingJobCreatedBy: existingJob.createdBy,
      });

      const response: ApiResponse<CreateManagerBookingResponse> = {
        success: true,
        data: {
          jobId: existingJob.jobId,
          bookingId: squareBooking.id,
          orderId: existingJob.orderId,
          job: existingJob,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    }

    // Create new job
    const now = new Date().toISOString();
    
    console.log('[MANAGER BOOKING] Creating new job in DynamoDB', {
      jobId,
      customerId: customer.id,
      customerName: body.customer.name,
      customerPhone: body.customer.phone,
      serviceType: body.service.serviceName,
      appointmentTime: body.appointmentTime.startAt,
    });
    
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
      orderId: orderId, // Store order ID if add-ons were created
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
      orderId: orderId || 'none',
      addonCount: body.addonItemVariationIds?.length || 0,
    });

    const response: ApiResponse<CreateManagerBookingResponse> = {
      success: true,
      data: {
        jobId: job.jobId,
        bookingId: squareBooking.id,
        orderId: orderId,
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
