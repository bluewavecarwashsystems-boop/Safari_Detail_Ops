/**
 * GET /api/bookings/[id]
 * 
 * Retrieves a booking with its add-ons (from linked order)
 * Used for viewing/editing existing bookings with add-on support
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { UserRole } from '@/lib/types';
import type { ApiResponse } from '@/lib/types';
import { retrieveBooking } from '@/lib/square/bookings-api';
import { retrieveOrder, extractAddonLineItems } from '@/lib/square/orders-api';
import * as dynamodb from '@/lib/aws/dynamodb';
import { fetchCatalogObject } from '@/lib/square/catalog-api';

interface BookingWithAddonsResponse {
  booking: any; // Square booking object
  addons: Array<{
    id: string;
    name: string;
    priceMoney?: {
      amount: number;
      currency: string;
    };
  }>;
  job?: any; // Internal job record
}

export const GET = requireAuth(async (
  request: NextRequest,
  session,
  { params }: { params: { id: string } }
): Promise<NextResponse> => {
  try {
    const userRole = session.role as UserRole;
    
    // Only MANAGER can access booking details
    if (userRole !== UserRole.MANAGER) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can access booking details',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    const bookingId = params.id;
    
    console.log('[GET BOOKING] Fetching booking', { bookingId });
    
    // Fetch booking from Square
    const booking = await retrieveBooking(bookingId);
    
    if (!booking) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: `Booking ${bookingId} not found`,
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 404 });
    }
    
    // Fetch job from DynamoDB to get order ID
    const job = await dynamodb.getJob(bookingId);
    
    let addons: Array<{
      id: string;
      name: string;
      priceMoney?: {
        amount: number;
        currency: string;
      };
    }> = [];
    
    // If job has an order ID, fetch the order and extract add-ons
    if (job?.orderId) {
      console.log('[GET BOOKING] Fetching order for add-ons', {
        bookingId,
        orderId: job.orderId,
      });
      
      try {
        const order = await retrieveOrder(job.orderId);
        
        if (order) {
          const addonLineItems = extractAddonLineItems(order);
          
          console.log('[GET BOOKING] Found add-on line items', {
            count: addonLineItems.length,
          });
          
          // Fetch catalog details for each add-on to get full name
          for (const lineItem of addonLineItems) {
            if (lineItem.catalog_object_id) {
              const catalogObject = await fetchCatalogObject(lineItem.catalog_object_id);
              
              addons.push({
                id: lineItem.catalog_object_id,
                name: lineItem.name || catalogObject?.item_variation_data?.name || lineItem.catalog_object_id,
                priceMoney: lineItem.base_price_money,
              });
            }
          }
        }
      } catch (orderError: any) {
        console.error('[GET BOOKING] Failed to fetch order', {
          orderId: job.orderId,
          error: orderError.message,
        });
        // Continue without add-ons if order fetch fails
      }
    }
    
    const responseData: BookingWithAddonsResponse = {
      booking,
      addons,
      job,
    };
    
    const response: ApiResponse<BookingWithAddonsResponse> = {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[GET BOOKING ERROR]', {
      error: error.message,
      stack: error.stack,
    });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'BOOKING_FETCH_ERROR',
        message: error.message || 'Failed to fetch booking',
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 500 });
  }
});
