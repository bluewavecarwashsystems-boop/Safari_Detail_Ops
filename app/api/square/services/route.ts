/**
 * GET /api/square/services
 * 
 * Lists all available services from Square Catalog FOR PHONE BOOKING ONLY
 * RESTRICTED to location L9ZMZD9TTTTZJ
 * Used by phone booking form to populate service dropdown
 */

import { NextResponse } from 'next/server';
import { listPhoneBookingServices } from '@/lib/square/catalog-api';
import type { ApiResponse } from '@/lib/types';

export async function GET() {
  try {
    console.log('[SERVICES API] Fetching phone booking services (location-filtered)');
    
    const services = await listPhoneBookingServices();
    
    // Add diagnostic info to response in development/debug
    console.log('[SERVICES API] Services fetched', {
      count: services.length,
      serviceIds: services.map(s => s.id).slice(0, 3),
    });
    
    const response: ApiResponse = {
      success: true,
      data: {
        services,
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[SERVICES API ERROR]', {
      error: error.message,
      stack: error.stack,
    });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVICES_FETCH_ERROR',
        message: error.message || 'Failed to fetch services',
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 500 });
  }
}
