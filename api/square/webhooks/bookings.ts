/**
 * Square Webhooks - Bookings Endpoint (STUB - Phase A)
 * 
 * POST /api/square/webhooks/bookings
 * 
 * Receives webhook events from Square for booking.created and booking.updated events.
 * 
 * Phase A: Stub implementation that logs and acknowledges webhooks
 * Phase B: Will add signature verification
 * Phase C: Will add DynamoDB integration to create/update jobs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from '../../../lib/config';
import type { ApiResponse, SquareBookingWebhook } from '../../../lib/types';

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
    const config = getConfig();
    
    // Parse webhook payload
    const webhookEvent = req.body as SquareBookingWebhook;
    
    // Log webhook event (Phase A: basic logging only)
    console.log('[WEBHOOK RECEIVED]', {
      environment: config.env,
      eventId: webhookEvent.event_id,
      eventType: webhookEvent.type,
      merchantId: webhookEvent.merchant_id,
      timestamp: webhookEvent.created_at,
      bookingId: webhookEvent.data?.id,
    });

    // Phase A: Stub response - acknowledge receipt
    // Phase B: Will add signature verification
    // Phase C: Will add DynamoDB job creation/update

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Webhook received and acknowledged',
        eventId: webhookEvent.event_id,
        eventType: webhookEvent.type,
        processed: false, // Phase A: not yet processing
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
