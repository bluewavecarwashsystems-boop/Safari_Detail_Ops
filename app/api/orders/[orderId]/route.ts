/**
 * Square Order Details API
 * 
 * GET /api/orders/[orderId]
 * 
 * Fetches order details and extracts add-ons
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';
import { retrieveOrder, extractAddonLineItems } from '@/lib/square/orders-api';
import { fetchCatalogObject } from '@/lib/square/catalog-api';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
): Promise<NextResponse<ApiResponse>> {
  const orderId = params.orderId;

  console.log('[GET ORDER] Fetching order', {
    orderId,
  });

  try {
    // Fetch order from Square
    const order = await retrieveOrder(orderId);

    if (!order) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Extract add-on line items
    const addonLineItems = extractAddonLineItems(order);

    console.log('[GET ORDER] Found add-on line items', {
      orderId,
      count: addonLineItems.length,
    });

    // Fetch catalog details for each add-on to get full name
    const addons: Array<{
      id: string;
      name: string;
      priceMoney?: { amount: number; currency: string };
    }> = [];

    for (const lineItem of addonLineItems) {
      if (lineItem.catalog_object_id) {
        try {
          const catalogObject = await fetchCatalogObject(lineItem.catalog_object_id);

          addons.push({
            id: lineItem.catalog_object_id,
            name: lineItem.name || catalogObject?.item_variation_data?.name || lineItem.catalog_object_id,
            priceMoney: lineItem.base_price_money,
          });
        } catch (catalogError) {
          console.error('[GET ORDER] Failed to fetch catalog object', {
            catalogObjectId: lineItem.catalog_object_id,
            error: catalogError,
          });
          
          // Fallback to line item name
          addons.push({
            id: lineItem.catalog_object_id,
            name: lineItem.name || lineItem.catalog_object_id,
            priceMoney: lineItem.base_price_money,
          });
        }
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        orderId: order.id,
        addons,
        totalMoney: order.total_money,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('[GET ORDER] Order details fetched successfully', {
      orderId,
      addonCount: addons.length,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[GET ORDER] Error fetching order', {
      orderId,
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'ORDER_FETCH_ERROR',
        message: error.message || 'Failed to fetch order',
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
