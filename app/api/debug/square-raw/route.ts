import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to see raw Square Catalog API response
 * TEMPORARY - Remove after diagnosing phone booking issue
 */
export async function GET() {
  try {
    const config = getConfig();
    
    if (!config.square.accessToken) {
      return NextResponse.json(
        { error: 'Square access token not configured' },
        { status: 500 }
      );
    }

    const baseUrl = config.square.environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    const url = `${baseUrl}/v2/catalog/list?types=ITEM&limit=5`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.square.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
    });

    const data = await response.json();
    
    // Extract just the relevant fields for debugging
    const debugData = {
      environment: config.square.environment,
      franklinLocationId: config.square.franklinLocationId,
      responseStatus: response.status,
      itemCount: data.objects?.length || 0,
      items: data.objects?.map((obj: any) => ({
        id: obj.id,
        type: obj.type,
        name: obj.item_data?.name,
        present_at_all_locations: obj.item_data?.present_at_all_locations,
        present_at_location_ids: obj.item_data?.present_at_location_ids,
        variations: obj.item_data?.variations?.map((v: any) => ({
          id: v.id,
          name: v.item_variation_data?.name,
          present_at_all_locations: v.item_variation_data?.present_at_all_locations,
          present_at_location_ids: v.item_variation_data?.present_at_location_ids,
        })),
      })),
      fullResponse: data,
    };
    
    return NextResponse.json({
      success: true,
      data: debugData,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
