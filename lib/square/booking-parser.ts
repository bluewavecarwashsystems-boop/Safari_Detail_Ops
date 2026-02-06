/**
 * Square Booking Parser
 * 
 * Parses Square booking webhook events and extracts relevant job information.
 */

import type { SquareBookingWebhook } from '../types';

/**
 * Parsed booking data for job creation
 */
export interface ParsedBooking {
  bookingId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceType?: string;
  appointmentTime?: string;
  status: string;
  notes?: string;
  locationId?: string;
  sellerId?: string;
  version?: number;
}

/**
 * Parse Square booking webhook event
 * 
 * @param event - Square booking webhook event
 * @returns Parsed booking data
 */
export function parseBookingEvent(event: SquareBookingWebhook): ParsedBooking {
  const booking = event.data?.object?.booking;
  
  if (!booking) {
    throw new Error('Invalid booking webhook: missing booking object');
  }

  // Extract customer information
  const customer = booking.customer_note || {};
  const customerDetails = booking.customer || {};
  
  // Parse appointment time
  const startAt = booking.start_at;
  
  // Extract service information from appointment segments
  const segments = booking.appointment_segments || [];
  const serviceType = segments.length > 0 
    ? segments[0].service_variation_id 
    : undefined;

  return {
    bookingId: booking.id,
    customerId: booking.customer_id,
    customerName: customerDetails.given_name && customerDetails.family_name
      ? `${customerDetails.given_name} ${customerDetails.family_name}`.trim()
      : customerDetails.given_name || undefined,
    customerEmail: customerDetails.email_address,
    customerPhone: customerDetails.phone_number,
    serviceType,
    appointmentTime: startAt,
    status: booking.status || 'PENDING',
    notes: booking.customer_note,
    locationId: booking.location_id,
    sellerId: booking.seller_id,
    version: booking.version,
  };
}

/**
 * Determine if booking event should create or update a job
 * 
 * @param eventType - Webhook event type
 * @returns Action to take ('create' | 'update' | 'skip')
 */
export function determineBookingAction(eventType: string): 'create' | 'update' | 'skip' {
  switch (eventType) {
    case 'booking.created':
      return 'create';
    case 'booking.updated':
      return 'update';
    default:
      return 'skip';
  }
}

/**
 * Validate parsed booking has required fields
 * 
 * @param booking - Parsed booking data
 * @returns true if valid, false otherwise
 */
export function isValidBooking(booking: ParsedBooking): boolean {
  return !!(
    booking.bookingId &&
    booking.appointmentTime &&
    booking.status
  );
}
