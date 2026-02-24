/**
 * PATCH /api/bookings/[id]/addons
 * 
 * Updates add-ons for an existing booking
 * Creates/updates the linked Square Order with add-on line items
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { UserRole } from '@/lib/types';
import type { ApiResponse } from '@/lib/types';
import { retrieveBooking } from '@/lib/square/bookings-api';
import { 
  retrieveOrder, 
  createOrder, 
  updateOrder, 
  extractNonAddonLineItems 
} from '@/lib/square/orders-api';
import type { OrderLineItem } from '@/lib/square/orders-api';
import { validateAddonVariation } from '@/lib/square/catalog-api';
import * as dynamodb from '@/lib/aws/dynamodb';
import { getConfig } from '@/lib/config';

interface UpdateAddonsRequest {
  addonItemVariationIds: string[];
}

interface UpdateAddonsResponse {
  bookingId: string;
  orderId: string;
  addons: string[];
}

export const PATCH = requireAuth(async (
  request: NextRequest,
  session,
  { params }: { params: { id: string } }
): Promise<NextResponse> => {
  try {
    const userRole = session.role as UserRole;
    
    // Only MANAGER can update bookings
    if (userRole !== UserRole.MANAGER) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can update booking add-ons',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    const bookingId = params.id;
    const body: UpdateAddonsRequest = await request.json();
    const requestedAddonIds = body.addonItemVariationIds || [];
    
    console.log('[UPDATE ADDONS] Starting update', {
      bookingId,
      addonCount: requestedAddonIds.length,
      addonIds: requestedAddonIds,
    });
    
    // Validate booking exists
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
    
    // Fetch job from DynamoDB
    const job = await dynamodb.getJob(bookingId);
    
    if (!job) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${bookingId} not found in database`,
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 404 });
    }
    
    const config = getConfig();
    const locationId = config.square.franklinLocationId;
    
    if (!locationId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Square location ID not configured',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 500 });
    }
    
    // Server-side validation: Ensure all add-on IDs are valid
    if (requestedAddonIds.length > 0) {
      console.log('[UPDATE ADDONS] Validating add-ons', {
        addonCount: requestedAddonIds.length,
      });
      
      const validationResults = await Promise.all(
        requestedAddonIds.map(async (addonId) => {
          const isValid = await validateAddonVariation(addonId);
          return { addonId, isValid };
        })
      );
      
      const invalidAddons = validationResults.filter(r => !r.isValid);
      
      if (invalidAddons.length > 0) {
        console.error('[UPDATE ADDONS] SECURITY: Invalid add-on variation IDs', {
          invalidAddons: invalidAddons.map(r => r.addonId),
          locationId,
        });
        
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_ADDONS',
            message: `Invalid add-on variation IDs: ${invalidAddons.map(r => r.addonId).join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
      
      console.log('[UPDATE ADDONS] Add-ons validated successfully');
    }
    
    let orderId: string;
    
    // Case 1: Job has existing order - update it
    if (job.orderId) {
      console.log('[UPDATE ADDONS] Updating existing order', {
        orderId: job.orderId,
      });
      
      const existingOrder = await retrieveOrder(job.orderId);
      
      if (!existingOrder) {
        console.error('[UPDATE ADDONS] Order not found, will create new', {
          orderId: job.orderId,
        });
        // Fall through to create new order
      } else {
        // Preserve non-add-on line items (e.g., deposits, fees)
        const nonAddonLineItems = extractNonAddonLineItems(existingOrder);
        
        // Build new add-on line items
        const addonLineItems: OrderLineItem[] = requestedAddonIds.map((addonId) => ({
          catalog_object_id: addonId,
          quantity: '1',
          metadata: {
            source: 'detail-ops-addon',
          },
        }));
        
        // Combine non-add-on items with new add-on items
        const updatedLineItems = [...nonAddonLineItems, ...addonLineItems];
        
        console.log('[UPDATE ADDONS] Updating order line items', {
          orderId: existingOrder.id,
          nonAddonCount: nonAddonLineItems.length,
          addonCount: addonLineItems.length,
          totalLineItems: updatedLineItems.length,
          version: existingOrder.version,
        });
        
        const updatedOrder = await updateOrder({
          orderId: existingOrder.id,
          version: existingOrder.version || 1,
          lineItems: updatedLineItems,
        });
        
        orderId = updatedOrder.id;
        
        console.log('[UPDATE ADDONS] Order updated', {
          orderId: updatedOrder.id,
          newVersion: updatedOrder.version,
        });
        
        const responseData: UpdateAddonsResponse = {
          bookingId,
          orderId: updatedOrder.id,
          addons: requestedAddonIds,
        };
        
        const response: ApiResponse<UpdateAddonsResponse> = {
          success: true,
          data: responseData,
          timestamp: new Date().toISOString(),
        };
        
        return NextResponse.json(response, { status: 200 });
      }
    }
    
    // Case 2: No existing order - create new order if add-ons are requested
    if (requestedAddonIds.length > 0) {
      console.log('[UPDATE ADDONS] Creating new order', {
        bookingId,
        addonCount: requestedAddonIds.length,
      });
      
      const lineItems: OrderLineItem[] = requestedAddonIds.map((addonId) => ({
        catalog_object_id: addonId,
        quantity: '1',
        metadata: {
          source: 'detail-ops-addon',
        },
      }));
      
      const newOrder = await createOrder({
        locationId: locationId,
        lineItems: lineItems,
        metadata: {
          booking_id: bookingId,
          source: 'phone-booking-update',
        },
      });
      
      orderId = newOrder.id;
      
      console.log('[UPDATE ADDONS] New order created', {
        orderId: newOrder.id,
        bookingId,
      });
      
      // Update job with new order ID
      await dynamodb.updateJob(bookingId, {
        orderId: newOrder.id,
        updatedAt: new Date().toISOString(),
        updatedBy: {
          userId: session.sub,
          name: session.name,
          role: userRole,
        },
      });
      
      console.log('[UPDATE ADDONS] Job updated with order ID', {
        jobId: bookingId,
        orderId: newOrder.id,
      });
      
      const responseData: UpdateAddonsResponse = {
        bookingId,
        orderId: newOrder.id,
        addons: requestedAddonIds,
      };
      
      const response: ApiResponse<UpdateAddonsResponse> = {
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      };
      
      return NextResponse.json(response, { status: 200 });
    } else {
      // Case 3: No add-ons requested and no existing order - nothing to do
      console.log('[UPDATE ADDONS] No add-ons requested, no action needed', {
        bookingId,
      });
      
      const responseData: UpdateAddonsResponse = {
        bookingId,
        orderId: job.orderId || '',
        addons: [],
      };
      
      const response: ApiResponse<UpdateAddonsResponse> = {
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      };
      
      return NextResponse.json(response, { status: 200 });
    }
  } catch (error: any) {
    console.error('[UPDATE ADDONS ERROR]', {
      error: error.message,
      stack: error.stack,
    });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'ADDON_UPDATE_ERROR',
        message: error.message || 'Failed to update add-ons',
      },
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response, { status: 500 });
  }
});
