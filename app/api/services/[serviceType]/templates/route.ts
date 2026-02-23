/**
 * GET /api/services/[serviceType]/templates
 * 
 * Get checklist templates for a specific service type.
 * Used by Manager UI to load and edit templates.
 * 
 * Auth: Manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import { UserRole, type ApiResponse, type GetTemplatesResponse } from '@/lib/types';
import * as checklistTemplateService from '@/lib/services/checklist-template-service';

/**
 * GET /api/services/[serviceType]/templates
 * Returns both TECH and QC templates for the service
 */
export const GET = requireRole(
  [UserRole.MANAGER],
  async (
    request: NextRequest,
    session,
    { params }: { params: { serviceType: string } }
  ): Promise<NextResponse> => {
    try {
      const serviceType = decodeURIComponent(params.serviceType);

      if (!serviceType) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_SERVICE_TYPE',
            message: 'Service type is required',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Get both TECH and QC templates
      const templates = await checklistTemplateService.getTemplatesByService(serviceType);

      const response: ApiResponse<GetTemplatesResponse> = {
        success: true,
        data: {
          templates,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Get templates error:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get templates',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 500 });
    }
  }
);
