/**
 * Square Webhooks - Bookings Endpoint - Phase B (Next.js API Route)
 * 
 * POST /api/square/webhooks/bookings
 * 
 * Receives webhook events from Square for booking.created, booking.updated, booking.canceled
 * 
 * QA MODE: GET/HEAD/POST all return 200 OK to allow Square webhook subscription creation
 * 
 * Phase B: Full implementation with:
 * - Signature verification
 * - Booking parsing
 * - DynamoDB integration
 * - Idempotent job creation/updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import type { ApiResponse, SquareBookingWebhook } from '@/lib/types';
import { 
  validateWebhookSignature, 
  extractSignature, 
  buildWebhookUrl 
} from '@/lib/square/webhook-validator';
import {
  parseBookingEvent,
  determineBookingAction,
  isValidBooking
} from '@/lib/square/booking-parser';
import { 
  createJobFromBooking, 
  updateJobFromBooking 
} from '@/lib/services/job-service';
import { getJobByBookingId } from '@/lib/aws/dynamodb';

/**
 * GET handler - Square webhook UI validation
 * Returns 200 OK to allow webhook subscription creation
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[WEBHOOK GET]', {
    url: request.url,
    method: 'GET',
    timestamp: new Date().toISOString(),
  });
  
  return new NextResponse('OK', { 
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}

/**
 * HEAD handler - Square webhook UI validation
 * Returns 200 OK with no body
 */
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  console.log('[WEBHOOK HEAD]', {
    url: request.url,
    method: 'HEAD',
    timestamp: new Date().toISOString(),
  });
  
  return new NextResponse(null, { status: 200 });
}

/**
 * POST handler - Actual webhook receiver
 * Wrapped to never throw, always returns 200 OK in QA mode
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Get configuration (outside try block for error handler access)
  const appConfig = getConfig();
  
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();
    
    // Log request details (non-sensitive)
    console.log('[WEBHOOK POST]', {
      url: request.url,
      method: 'POST',
      bodyLength: rawBody.length,
      hasContentType: request.headers.has('content-type'),
      contentType: request.headers.get('content-type'),
      hasSignature: request.headers.has('x-square-hmacsha256-signature'),
      timestamp: new Date().toISOString(),
    });
    
    // Convert Next.js Headers to plain object for extractSignature
    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });
    
    // Phase B: Signature Verification
    const signature = extractSignature(headersObj);
    
    if (signature && appConfig.square.webhookSignatureKey) {
      const host = request.headers.get('host') || '';
      const url = buildWebhookUrl(host, request.nextUrl.pathname);
      
      const isValid = validateWebhookSignature(
        rawBody,
        signature,
        appConfig.square.webhookSignatureKey,
        url
      );
      
      if (!isValid) {
        console.error('[WEBHOOK SIGNATURE INVALID]', {
          url,
          hasBody: rawBody.length > 0,
        });
        
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Webhook signature validation failed',
          },
          timestamp: new Date().toISOString(),
        };
        
        return NextResponse.json(response, { status: 401 });
      }
      
      console.log('[WEBHOOK SIGNATURE VALID]');
    } else {
      console.warn('[WEBHOOK SIGNATURE SKIPPED]', {
        hasSignature: !!signature,
        hasKey: !!appConfig.square.webhookSignatureKey,
        environment: appConfig.env,
      });
      
      // In production, reject if no signature
      if (appConfig.env === 'prod' && !signature) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Webhook signature required in production',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 401 });
      }
    }

    // Parse webhook payload
    let webhookEvent: SquareBookingWebhook;
    try {
      webhookEvent = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[WEBHOOK PARSE ERROR]', { error: parseError });
      throw new Error('Invalid JSON in webhook body');
    }

    // Determine action based on event type
    const action = determineBookingAction(webhookEvent.type);
    
    if (action === 'skip') {
      console.log('[WEBHOOK SKIPPED]', {
        eventId: webhookEvent.event_id,
        eventType: webhookEvent.type,
        reason: 'Unsupported event type',
      });
      
      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Event acknowledged but not processed',
          eventId: webhookEvent.event_id,
          eventType: webhookEvent.type,
          processed: false,
        },
        timestamp: new Date().toISOString(),
      };
      
      return NextResponse.json(response, { status: 200 });
    }

    // Parse booking details
    let parsedBooking;
    try {
      parsedBooking = parseBookingEvent(webhookEvent);
    } catch (parseError: any) {
      console.error('[BOOKING PARSE ERROR]', {
        eventId: webhookEvent.event_id,
        error: parseError.message,
      });
      
      throw new Error(`Failed to parse booking: ${parseError.message}`);
    }

    // Validate parsed booking
    if (!isValidBooking(parsedBooking)) {
      console.error('[BOOKING VALIDATION FAILED]', {
        eventId: webhookEvent.event_id,
        booking: parsedBooking,
      });
      
      throw new Error('Booking validation failed: missing required fields');
    }

    // Filter by Franklin location only
    if (parsedBooking.locationId && appConfig.square.franklinLocationId) {
      if (parsedBooking.locationId !== appConfig.square.franklinLocationId) {
        console.log('[WEBHOOK FILTERED]', {
          eventId: webhookEvent.event_id,
          locationId: parsedBooking.locationId,
          franklinLocationId: appConfig.square.franklinLocationId,
          reason: 'Not Franklin location',
        });
        
        const response: ApiResponse = {
          success: true,
          data: {
            message: 'Event acknowledged but filtered (not Franklin location)',
            eventId: webhookEvent.event_id,
            processed: false,
          },
          timestamp: new Date().toISOString(),
        };
        
        return NextResponse.json(response, { status: 200 });
      }
    }

    console.log('[WEBHOOK PROCESSED]', {
      environment: appConfig.env,
      eventId: webhookEvent.event_id,
      eventType: webhookEvent.type,
      action,
      booking: {
        bookingId: parsedBooking.bookingId,
        customerId: parsedBooking.customerId,
        customerName: parsedBooking.customerName,
        appointmentTime: parsedBooking.appointmentTime,
        status: parsedBooking.status,
        locationId: parsedBooking.locationId,
      },
    });

    // Create or update job in DynamoDB (idempotent)
    let job;
    let jobAction: 'created' | 'updated' | 'none' = 'none';

    try {
      if (action === 'create') {
        // Check if job already exists for this booking
        const existingJob = await getJobByBookingId(parsedBooking.bookingId);
        
        if (existingJob) {
          console.log('[JOB EXISTS]', {
            jobId: existingJob.jobId,
            bookingId: parsedBooking.bookingId,
            action: 'updating existing job',
          });
          
          job = await updateJobFromBooking(existingJob.jobId, parsedBooking);
          jobAction = 'updated';
        } else {
          console.log('[JOB CREATING]', {
            bookingId: parsedBooking.bookingId,
          });
          
          job = await createJobFromBooking(parsedBooking);
          jobAction = 'created';
        }
      } else if (action === 'update') {
        // Find existing job by booking ID
        const existingJob = await getJobByBookingId(parsedBooking.bookingId);
        
        if (existingJob) {
          console.log('[JOB UPDATING]', {
            jobId: existingJob.jobId,
            bookingId: parsedBooking.bookingId,
          });
          
          job = await updateJobFromBooking(existingJob.jobId, parsedBooking);
          jobAction = 'updated';
        } else {
          console.warn('[JOB NOT FOUND]', {
            bookingId: parsedBooking.bookingId,
            action: 'creating new job for update event',
          });
          
          // Create job if it doesn't exist (in case we missed the create event)
          job = await createJobFromBooking(parsedBooking);
          jobAction = 'created';
        }
      }

      console.log('[JOB SAVED]', {
        jobId: job?.jobId,
        bookingId: parsedBooking.bookingId,
        action: jobAction,
      });
    } catch (dbError: any) {
      console.error('[DATABASE ERROR]', {
        eventId: webhookEvent.event_id,
        bookingId: parsedBooking.bookingId,
        error: dbError.message,
        stack: dbError.stack,
      });
      
      // Return 500 to signal Square to retry
      throw new Error(`Database operation failed: ${dbError.message}`);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Webhook processed successfully',
        eventId: webhookEvent.event_id,
        eventType: webhookEvent.type,
        action,
        bookingId: parsedBooking.bookingId,
        jobId: job?.jobId,
        jobAction,
        processed: true,
      },
      timestamp: new Date().toISOString(),
    };

    // Return 200 OK to acknowledge receipt
    return NextResponse.json(response, { status: 200 });
    
  } catch (error: any) {
    console.error('[WEBHOOK ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'WEBHOOK_PROCESSING_ERROR',
        message: error.message || 'Failed to process webhook',
        details: process.env.APP_ENV === 'qa' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };
    
    // QA MODE: Return 200 OK even on error to prevent Square retries during testing
    // PROD MODE: Return 500 to signal Square to retry
    const statusCode = appConfig.env === 'qa' ? 200 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}
