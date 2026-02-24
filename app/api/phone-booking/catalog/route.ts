/**
 * GET /api/phone-booking/catalog
 * 
 * Fetches catalog data for phone booking (services + add-ons separately)
 * RESTRICTED to location L9ZMZD9TTTTZJ
 * 
 * Returns:
 * - services: Square Booking Services (service variation IDs)
 * - addons: Square Item Variations in category "Add-on's"
 */

import { NextResponse } from 'next/server';
import { listPhoneBookingServices, listAddons } from '@/lib/square/catalog-api';
import type { ApiResponse } from '@/lib/types';

export async function GET() {
  try {
    console.log('[PHONE BOOKING CATALOG] Fetching services and add-ons');
    
    // Fetch services and add-ons in parallel
    const [services, addons] = await Promise.all([
      listPhoneBookingServices(),
      listAddons(),
    ]);
    
    console.log('[PHONE BOOKING CATALOG] Catalog fetched', {
      servicesCount: services.length,
      addonsCount: addons.length,
    });
    
    const response: ApiResponse = {
      success: true,
      data: {
        services,
        addons,
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[PHONE BOOKING CATALOG ERROR]', {
      error: error.message,
      stack: error.stack,
    });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CATALOG_FETCH_ERROR',
        message: error.message || 'Failed to fetch catalog data',
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}
