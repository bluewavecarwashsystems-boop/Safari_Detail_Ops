/**
 * Check Square Business Booking Profile
 * 
 * Standalone script to check if the connected Square seller account
 * supports seller-level write operations for the Bookings API.
 * 
 * Usage:
 *   ts-node scripts/check-booking-profile.ts
 * 
 * Or with explicit environment:
 *   APP_ENV=qa SQUARE_ACCESS_TOKEN=xxx ts-node scripts/check-booking-profile.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface BusinessBookingProfile {
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

interface RetrieveBusinessBookingProfileResponse {
  business_booking_profile?: BusinessBookingProfile;
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
    field?: string;
  }>;
}

async function checkBookingProfile() {
  console.log('='.repeat(80));
  console.log('SQUARE BUSINESS BOOKING PROFILE CHECK');
  console.log('='.repeat(80));
  console.log();

  // Validate environment variables
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const squareEnv = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
  
  if (!accessToken) {
    console.error('❌ ERROR: SQUARE_ACCESS_TOKEN environment variable not set');
    console.error('   Please set your Square access token in .env file');
    process.exit(1);
  }

  const baseUrl = squareEnv === 'sandbox' 
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
  
  const url = `${baseUrl}/v2/bookings/business-booking-profile`;
  
  console.log('Configuration:');
  console.log(`  Environment: ${squareEnv}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Access Token: ${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 4)}`);
  console.log();
  
  console.log('Making API request...');
  console.log(`  GET ${url}`);
  console.log();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2025-01-16',
      },
    });

    const responseBody = await response.text();
    let data: RetrieveBusinessBookingProfileResponse;
    
    try {
      data = JSON.parse(responseBody);
    } catch (parseError) {
      console.error('❌ ERROR: Failed to parse response as JSON');
      console.error(`   HTTP Status: ${response.status}`);
      console.error(`   Response Body: ${responseBody}`);
      process.exit(1);
    }

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log();

    if (!response.ok) {
      console.error('❌ API REQUEST FAILED');
      console.error();
      console.error('Error Details:');
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error, index) => {
          console.error(`  Error ${index + 1}:`);
          console.error(`    Category: ${error.category}`);
          console.error(`    Code: ${error.code}`);
          console.error(`    Detail: ${error.detail || 'N/A'}`);
          if (error.field) {
            console.error(`    Field: ${error.field}`);
          }
        });
      }
      console.error();
      console.error('Diagnostics:');
      console.error(getDiagnostics(response.status, data));
      console.error();
      console.error('Full Response:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    // Success!
    const profile = data.business_booking_profile;
    const supportSellerLevelWrites = profile?.support_seller_level_writes ?? false;
    
    console.log('✅ SUCCESS - Business Booking Profile Retrieved');
    console.log();
    console.log('='.repeat(80));
    console.log('KEY FIELD:');
    console.log('='.repeat(80));
    console.log();
    console.log(`  support_seller_level_writes = ${supportSellerLevelWrites}`);
    console.log();
    
    if (supportSellerLevelWrites) {
      console.log('✅ Seller account SUPPORTS seller-level Bookings API write operations');
    } else {
      console.log('⚠️  Seller account DOES NOT support seller-level Bookings API write operations');
      console.log('    You may need to use location-scoped endpoints or complete onboarding');
    }
    console.log();
    
    console.log('='.repeat(80));
    console.log('PROFILE SUMMARY:');
    console.log('='.repeat(80));
    console.log();
    console.log(`  Seller ID: ${profile?.seller_id || 'N/A'}`);
    console.log(`  Created At: ${profile?.created_at || 'N/A'}`);
    console.log(`  Booking Enabled: ${profile?.booking_enabled ?? 'N/A'}`);
    console.log(`  Booking Policy: ${profile?.booking_policy || 'N/A'}`);
    console.log(`  Customer Timezone Choice: ${profile?.customer_timezone_choice || 'N/A'}`);
    console.log(`  Allow User Cancel: ${profile?.allow_user_cancel ?? 'N/A'}`);
    console.log();
    
    if (profile?.business_appointment_settings) {
      const settings = profile.business_appointment_settings;
      console.log('  Appointment Settings:');
      console.log(`    Location Types: ${settings.location_types?.join(', ') || 'N/A'}`);
      console.log(`    Alignment Time: ${settings.alignment_time || 'N/A'}`);
      console.log(`    Min Booking Lead Time: ${settings.min_booking_lead_time_seconds ? `${settings.min_booking_lead_time_seconds}s` : 'N/A'}`);
      console.log(`    Max Booking Lead Time: ${settings.max_booking_lead_time_seconds ? `${settings.max_booking_lead_time_seconds}s` : 'N/A'}`);
      console.log(`    Any Team Member Booking: ${settings.any_team_member_booking_enabled ?? 'N/A'}`);
      console.log(`    Multiple Service Booking: ${settings.multiple_service_booking_enabled ?? 'N/A'}`);
      console.log(`    Cancellation Window: ${settings.cancellation_window_seconds ? `${settings.cancellation_window_seconds}s` : 'N/A'}`);
      console.log();
    }
    
    console.log('='.repeat(80));
    console.log('FULL PROFILE JSON:');
    console.log('='.repeat(80));
    console.log();
    console.log(JSON.stringify(profile, null, 2));
    console.log();
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ UNEXPECTED ERROR');
    console.error();
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
    } else {
      console.error(`  ${String(error)}`);
    }
    process.exit(1);
  }
}

function getDiagnostics(status: number, data: RetrieveBusinessBookingProfileResponse): string {
  const errorCodes = data.errors?.map(e => e.code).join(', ') || 'UNKNOWN';
  
  switch (status) {
    case 401:
      return `  Authentication failed (401). Possible causes:
    - Invalid or expired access token
    - Token is for wrong environment (check SQUARE_ENVIRONMENT: sandbox vs production)
    - Token doesn't have required permissions
    Error codes: ${errorCodes}`;
    
    case 403:
      return `  Access forbidden (403). Possible causes:
    - Token lacks APPOINTMENTS_READ permission
    - Seller hasn't completed Square Appointments/Bookings onboarding
    - Feature not available for this seller account type
    Error codes: ${errorCodes}`;
    
    case 404:
      return `  Business booking profile not found (404). Possible causes:
    - Seller hasn't set up Square Appointments/Bookings yet
    - Need to complete onboarding at https://squareupsandbox.com/dashboard/appointments
    - Bookings feature not activated for this seller account
    Error codes: ${errorCodes}`;
    
    case 500:
    case 502:
    case 503:
      return `  Square API server error (${status}). Possible causes:
    - Temporary Square API issue
    - Retry the request after a short delay
    Error codes: ${errorCodes}`;
    
    default:
      return `  HTTP ${status} error. Check Square API documentation for error codes: ${errorCodes}`;
  }
}

// Run the check
checkBookingProfile().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
