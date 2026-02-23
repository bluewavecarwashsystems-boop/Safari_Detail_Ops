/**
 * Square Business Booking Profile API Route
 * 
 * Retrieves the business booking profile to check if the seller account
 * supports seller-level write operations for the Bookings API.
 * 
 * Endpoint: GET /api/square/booking-profile
 * 
 * Returns:
 * - support_seller_level_writes: boolean
 * - Full business booking profile for debugging
 */

import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

/**
 * Square Business Booking Profile
 */
export interface BusinessBookingProfile {
  seller_id?: string;
  created_at?: string;
  booking_enabled?: boolean;
  customer_timezone_choice?: 'BUSINESS_LOCATION_TIMEZONE' | 'CUSTOMER_CHOICE';
  booking_policy?: 'ACCEPT_ALL' | 'REQUIRES_ACCEPTANCE';
  allow_user_cancel?: boolean;
  business_appointment_settings?: {
    location_types?: Array<'BUSINESS_LOCATION' | 'CUSTOMER_LOCATION' | 'PHONE'>;
    alignment_time?: 'SERVICE_DURATION' | 'QUARTER_HOURLY' | 'HALF_HOURLY' | 'HOURLY';
    min_booking_lead_time_seconds?: number;
    max_booking_lead_time_seconds?: number;
    any_team_member_booking_enabled?: boolean;
    multiple_service_booking_enabled?: boolean;
    max_appointments_per_day_limit_type?: 'PER_TEAM_MEMBER' | 'PER_LOCATION';
    max_appointments_per_day_limit?: number;
    cancellation_window_seconds?: number;
    cancellation_fee_money?: {
      amount?: number;
      currency?: string;
    };
    cancellation_policy?: 'CANCELLATION_TREATED_AS_NO_SHOW' | 'CUSTOM_POLICY';
    cancellation_policy_text?: string;
    skip_booking_flow_staff_selection?: boolean;
  };
  support_seller_level_writes?: boolean;
}

/**
 * Response from Square Retrieve Business Booking Profile API
 */
export interface RetrieveBusinessBookingProfileResponse {
  business_booking_profile?: BusinessBookingProfile;
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
    field?: string;
  }>;
}

/**
 * GET /api/square/booking-profile
 * 
 * Retrieves the business booking profile from Square
 */
export async function GET() {
  const config = getConfig();
  
  if (!config.square.accessToken) {
    console.error('[BOOKING PROFILE] Square access token not configured');
    return NextResponse.json(
      { 
        error: 'Square access token not configured',
        diagnostics: 'Check SQUARE_ACCESS_TOKEN environment variable'
      },
      { status: 500 }
    );
  }

  try {
    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/bookings/business-booking-profile`;
    
    console.log('[BOOKING PROFILE] Retrieving business booking profile', {
      environment: config.square.environment,
      url
    });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-01-16', // Recent stable version
      },
    });

    // Read response body
    const responseBody = await response.text();
    let data: RetrieveBusinessBookingProfileResponse;
    
    try {
      data = JSON.parse(responseBody);
    } catch (parseError) {
      console.error('[BOOKING PROFILE] Failed to parse response as JSON', {
        status: response.status,
        body: responseBody
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid JSON response from Square API',
          status: response.status,
          body: responseBody,
          diagnostics: 'Response body is not valid JSON'
        },
        { status: 500 }
      );
    }

    // Handle HTTP error responses
    if (!response.ok) {
      console.error('[BOOKING PROFILE] Retrieve booking profile failed', {
        status: response.status,
        statusText: response.statusText,
        errors: data.errors,
        body: data
      });
      
      // Provide helpful diagnostics
      const diagnostics = getDiagnostics(response.status, data);
      
      return NextResponse.json(
        { 
          error: 'Failed to retrieve business booking profile',
          status: response.status,
          statusText: response.statusText,
          errors: data.errors,
          response: data,
          diagnostics
        },
        { status: response.status }
      );
    }

    // Success - extract the key field
    const profile = data.business_booking_profile;
    const supportSellerLevelWrites = profile?.support_seller_level_writes ?? false;
    
    console.log('[BOOKING PROFILE] Profile retrieved successfully', {
      seller_id: profile?.seller_id,
      booking_enabled: profile?.booking_enabled,
      support_seller_level_writes: supportSellerLevelWrites,
      created_at: profile?.created_at
    });
    
    // Return clear result with full profile for debugging
    return NextResponse.json({
      success: true,
      support_seller_level_writes: supportSellerLevelWrites,
      profile: profile,
      summary: {
        seller_id: profile?.seller_id,
        booking_enabled: profile?.booking_enabled,
        support_seller_level_writes: supportSellerLevelWrites,
        booking_policy: profile?.booking_policy,
        customer_timezone_choice: profile?.customer_timezone_choice,
        created_at: profile?.created_at
      }
    });

  } catch (error) {
    console.error('[BOOKING PROFILE] Unexpected error', error);
    
    return NextResponse.json(
      { 
        error: 'Unexpected error retrieving business booking profile',
        message: error instanceof Error ? error.message : String(error),
        diagnostics: 'Check server logs for full error details'
      },
      { status: 500 }
    );
  }
}

/**
 * Provide helpful diagnostic messages based on error status codes
 */
function getDiagnostics(status: number, data: RetrieveBusinessBookingProfileResponse): string {
  const errorCodes = data.errors?.map(e => e.code).join(', ') || 'UNKNOWN';
  
  switch (status) {
    case 401:
      return `Authentication failed (401). Possible causes:
        - Invalid or expired access token
        - Token is for wrong environment (check SQUARE_ENVIRONMENT: sandbox vs production)
        - Token doesn't have required permissions
        Error codes: ${errorCodes}`;
    
    case 403:
      return `Access forbidden (403). Possible causes:
        - Token lacks APPOINTMENTS_READ permission
        - Seller hasn't completed Square Appointments/Bookings onboarding
        - Feature not available for this seller account type
        Error codes: ${errorCodes}`;
    
    case 404:
      return `Business booking profile not found (404). Possible causes:
        - Seller hasn't set up Square Appointments/Bookings yet
        - Need to complete onboarding at https://squareupsandbox.com/dashboard/appointments
        - Bookings feature not activated for this seller account
        Error codes: ${errorCodes}`;
    
    case 500:
    case 502:
    case 503:
      return `Square API server error (${status}). Possible causes:
        - Temporary Square API issue
        - Retry the request after a short delay
        Error codes: ${errorCodes}`;
    
    default:
      return `HTTP ${status} error. Check Square API documentation for error codes: ${errorCodes}`;
  }
}
