/**
 * GET /api/addons - Fetch all available add-ons from Square Catalog
 */

import { NextResponse } from 'next/server';
import { listAddons } from '@/lib/square/catalog-api';
import type { ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[API /addons] Fetching available add-ons');

    const addons = await listAddons();

    console.log('[API /addons] Success', {
      addonCount: addons.length,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        addons,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[API /addons] Error', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'ADDONS_FETCH_ERROR',
        message: error.message || 'Failed to fetch add-ons',
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
