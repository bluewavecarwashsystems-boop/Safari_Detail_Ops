/**
 * GET /api/square/services
 * 
 * Lists all available services from Square Catalog
 * Used by phone booking form to populate service dropdown
 */

import { NextResponse } from 'next/server';
import { listServices } from '@/lib/square/catalog-api';
import type { ApiResponse } from '@/lib/types';

export async function GET() {
  try {
    console.log('[SERVICES API] Fetching services from Square');
    
    const services = await listServices();
    
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
