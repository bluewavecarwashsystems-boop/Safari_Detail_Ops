/**
 * Square Bookings API Client
 * 
 * Fetches bookings from Square Bookings API for reconciliation.
 */

import { getConfig } from '../config';

/**
 * Square booking appointment segment
 */
export interface BookingSegment {
  duration_minutes?: number;
  service_variation_id?: string;
  service_variation_version?: number;
  team_member_id?: string;
}

/**
 * Square booking object from API
 */
export interface SquareBooking {
  id: string;
  version?: number;
  status?: string;
  created_at?: string;
  location_id?: string;
  customer_id?: string;
  customer_note?: string;
  seller_note?: string;
  appointment_segments?: BookingSegment[];
  start_at?: string;
  location_type?: string;
  creator_details?: {
    creator_type?: string;
  };
  source?: string;
}

/**
 * List bookings response from Square API
 */
export interface ListBookingsResponse {
  bookings?: SquareBooking[];
  cursor?: string;
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
}

/**
 * Options for listing bookings
 */
export interface ListBookingsOptions {
  /**
   * Return bookings scheduled after this time (RFC 3339 format)
   */
  startAtMin?: string;
  
  /**
   * Return bookings scheduled before this time (RFC 3339 format)
   */
  startAtMax?: string;
  
  /**
   * Filter by location ID
   */
  locationId?: string;
  
  /**
   * Filter by customer ID
   */
  customerId?: string;
  
  /**
   * Maximum number of results to return (1-100)
   */
  limit?: number;
  
  /**
   * Pagination cursor from previous response
   */
  cursor?: string;
}

/**
 * Fetch bookings from Square Bookings API
 * 
 * @param options - Filtering and pagination options
 * @returns List of bookings
 */
export async function listBookings(
  options: ListBookingsOptions = {}
): Promise<ListBookingsResponse> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    throw new Error('Square access token not configured');
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/bookings`;
    
    // Build query parameters
    const params: Record<string, string> = {};
    if (options.startAtMin) params.start_at_min = options.startAtMin;
    if (options.startAtMax) params.start_at_max = options.startAtMax;
    if (options.locationId) params.location_id = options.locationId;
    if (options.customerId) params.customer_id = options.customerId;
    if (options.limit) params.limit = options.limit.toString();
    if (options.cursor) params.cursor = options.cursor;

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    console.log('[SQUARE BOOKINGS API] Listing bookings', {
      startAtMin: options.startAtMin,
      startAtMax: options.startAtMax,
      locationId: options.locationId,
    });
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SQUARE BOOKINGS API] List bookings failed', {
        status: response.status,
        error: errorText,
      });
      
      throw new Error(`Failed to list bookings: ${response.status} ${errorText}`);
    }

    const data = await response.json() as ListBookingsResponse;
    
    console.log('[SQUARE BOOKINGS API] Bookings fetched', {
      count: data.bookings?.length || 0,
      hasCursor: !!data.cursor,
      hasErrors: !!data.errors?.length,
    });
    
    return data;
  } catch (error: any) {
    console.error('[SQUARE BOOKINGS API] List bookings error', {
      error: error.message,
    });
    
    throw error;
  }
}

/**
 * Fetch all bookings for a time range (handles pagination automatically)
 * 
 * @param options - Filtering options
 * @returns All bookings in the time range
 */
export async function listAllBookings(
  options: ListBookingsOptions = {}
): Promise<SquareBooking[]> {
  const allBookings: SquareBooking[] = [];
  let cursor: string | undefined = options.cursor;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 10; // Safety limit to prevent infinite loops

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    
    const response = await listBookings({
      ...options,
      cursor,
      limit: options.limit || 100,
    });

    if (response.bookings && response.bookings.length > 0) {
      allBookings.push(...response.bookings);
    }

    // Check if there are more results
    if (response.cursor) {
      cursor = response.cursor;
    } else {
      hasMore = false;
    }
  }

  console.log('[SQUARE BOOKINGS API] Fetched all bookings', {
    totalCount: allBookings.length,
    pageCount,
  });

  return allBookings;
}

/**
 * Fetch a single booking by ID
 * 
 * @param bookingId - Square booking ID
 * @returns Booking details or null if not found
 */
export async function retrieveBooking(bookingId: string): Promise<SquareBooking | null> {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    throw new Error('Square access token not configured');
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/bookings/${bookingId}`;
    
    console.log('[SQUARE BOOKINGS API] Retrieving booking', { bookingId });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[SQUARE BOOKINGS API] Booking not found', { bookingId });
        return null;
      }
      
      const errorText = await response.text();
      console.error('[SQUARE BOOKINGS API] Retrieve booking failed', {
        bookingId,
        status: response.status,
        error: errorText,
      });
      
      throw new Error(`Failed to retrieve booking: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const booking = data.booking as SquareBooking;
    
    console.log('[SQUARE BOOKINGS API] Booking retrieved', {
      bookingId,
      status: booking.status,
    });
    
    return booking;
  } catch (error: any) {
    console.error('[SQUARE BOOKINGS API] Retrieve booking error', {
      bookingId,
      error: error.message,
    });
    
    throw error;
  }
}
