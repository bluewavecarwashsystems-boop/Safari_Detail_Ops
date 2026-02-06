/**
 * Square Webhooks - Bookings Endpoint (Phase C - With DynamoDB Integration)
 * 
 * POST /api/square/webhooks/bookings
 * 
 * Receives webhook events from Square for booking.created and booking.updated events.
 * 
 * Phase B: Signature verification and booking parsing ✓
 * Phase C: DynamoDB integration to create/update jobs ✓
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig, validateConfig } from '../../../lib/config';
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
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST requests
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
    
    // Validate Square configuration is present
    try {
      validateConfig(appConfig, ['square.webhookSignatureKey']);
    } catch (configError: any) {
      console.warn('[WEBHOOK CONFIG WARNING]', configError.message);
      // Continue without validation in development
      if (appConfig.env === 'prod') {
        throw configError;
      }
    }

    // Read raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Parse webhook payload
    const webhookEvent: SquareBookingWebhook = JSON.parse(rawBody);
    
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
          eventId: webhookEvent.event_id,
          url,
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
      
      console.log('[WEBHOOK SIGNATURE VALID]', {
        eventId: webhookEvent.event_id,
      });
    } else {
      console.warn('[WEBHOOK SIGNATURE SKIPPED]', {
        hasSignature: !!signature,
        hasKey: !!appConfig.square.webhookSignatureKey,
        environment: appConfig.env,
      });
    }

    // Phase B: Parse booking data
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

    // Log parsed booking
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
      },
    });

    // Phase C: Create or update job in DynamoDB
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
        processed: true, // Phase C: fully processed with DynamoDB
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
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };
    
    // Return 500 to signal Square to retry
    res.status(500).json(response);
  }
}
