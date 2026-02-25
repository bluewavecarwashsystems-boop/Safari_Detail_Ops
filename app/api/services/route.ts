/**
 * GET /api/services
 * 
 * Get all service types from Square Catalog for checklist template selection.
 * Returns service names from the configured location (Franklin in production).
 * 
 * Auth: All authenticated users
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { type ApiResponse } from '@/lib/types';
import * as catalogApi from '@/lib/square/catalog-api';

export interface ServiceTypeResponse {
  serviceTypes: string[];
}

/**
 * GET /api/services
 * Returns service type names from Square catalog (filtered by location in production)
 */
export const GET = requireAuth(
  async (request: NextRequest, session): Promise<NextResponse> => {
    try {
      // Fetch services from Square (location-filtered in production)
      const services = await catalogApi.listPhoneBookingServices();

      // Extract unique full service names
      const serviceNamesSet = new Set<string>();
      
      for (const service of services) {
        // Use the full service name as-is
        serviceNamesSet.add(service.name);
      }

      // Convert to sorted array
      const serviceTypes = Array.from(serviceNamesSet).sort();

      console.log('[Services API] Retrieved service types from Square', {
        total: services.length,
        unique: serviceTypes.length,
        serviceTypes,
      });

      const response: ApiResponse<ServiceTypeResponse> = {
        success: true,
        data: {
          serviceTypes,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Get service types error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get service types';
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: errorMessage,
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 500 });
    }
  }
);
