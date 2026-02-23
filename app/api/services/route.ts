/**
 * GET /api/services
 * 
 * Get all service types from Square Catalog for checklist template selection.
 * Returns unique service names extracted from Square catalog items.
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
 * Returns unique service type names from Square catalog
 */
export const GET = requireAuth(
  async (request: NextRequest, session): Promise<NextResponse> => {
    try {
      // Fetch all services from Square
      const services = await catalogApi.listServices();

      // Extract unique service names (base names without variation suffixes)
      const serviceNamesSet = new Set<string>();
      
      for (const service of services) {
        // Extract base service name (before " - " if exists)
        const baseName = service.name.split(' - ')[0].trim();
        serviceNamesSet.add(baseName);
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
