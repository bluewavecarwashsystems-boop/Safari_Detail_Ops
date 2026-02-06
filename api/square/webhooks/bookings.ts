/**
 * Square Webhooks - Bookings Endpoint - Phase B
 * 
 * POST /api/square/webhooks/bookings
 * 
 * Receives webhook events from Square for booking.created, booking.updated, booking.canceled
 * 
 * Phase B: Full implementation with:
 * - Signature verification
 * - Booking parsing
 * - DynamoDB integration
 * - Idempotent job creation/updates
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from '../../../lib/config';
import type { ApiResponse, SquareBookingWebhook } from '../../../lib/types';
import { 
  validateWebhookSignature, 
  extractSignature, 
  buildWebhookUrl 
} from '../../../lib/square/webhook-validator';
import {
  parseBookingEvent,
  determineBookingAction,
  isValidBooking
} from '../../../lib/square/booking-parser';
import { 
  createJobFromBooking, 
  updateJobFromBooking 
} from '../../../lib/services/job-service';
import { getJobByBookingId } from '../../../lib/aws/dynamodb';

// Disable body parsing for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Read raw body from request stream
 */
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
    
    // Timeout protection
    setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST requests (Phase B)
  if (req.method !== 'POST') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed',
      },
      timestamp: new Date().toISOString(),
    };
    res.status(405).json(response);
    return;
  }

  try {
    // Get configuration
    const appConfig = getConfig();
    
    // Read raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Phase B: Signature Verification
    const signature = extractSignature(req.headers);
    
    if (signature && appConfig.square.webhookSignatureKey) {
      const host = req.headers.host || '';
      const url = buildWebhookUrl(host, req.url || '');
      
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
        
        res.status(401).json(response);
        return;
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
        res.status(401).json(response);
        return;
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
      
      res.status(200).json(response);
      return;
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
        
        res.status(200).json(response);
        return;
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
    res.status(200).json(response);
    
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
    
    // Return 500 to signal Square to retry
    res.status(500).json(response);
  }
}
