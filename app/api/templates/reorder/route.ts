/**
 * PUT /api/templates/reorder
 * 
 * Reorder checklist template items using drag-and-drop.
 * 
 * Auth: Manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import {
  UserRole,
  ChecklistType,
  type ApiResponse,
  type ReorderTemplateItemsRequest,
  type ReorderTemplateItemsResponse,
} from '@/lib/types';
import * as checklistTemplateService from '@/lib/services/checklist-template-service';

/**
 * PUT /api/templates/reorder
 * Request body: { serviceType, type, itemIds: string[] }
 */
export const PUT = requireRole(
  [UserRole.MANAGER],
  async (request: NextRequest, session): Promise<NextResponse> => {
    try {
      const body: ReorderTemplateItemsRequest = await request.json();
      const { serviceType, type, itemIds } = body;

      // Validation
      if (!serviceType || !type || !itemIds || !Array.isArray(itemIds)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'serviceType, type, and itemIds (array) are required',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      if (!Object.values(ChecklistType).includes(type)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'type must be TECH or QC',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Reorder items
      const template = await checklistTemplateService.reorderTemplateItems(
        serviceType,
        type,
        itemIds,
        {
          userId: session.sub,
          name: session.name,
          role: session.role as UserRole,
        }
      );

      const response: ApiResponse<ReorderTemplateItemsResponse> = {
        success: true,
        data: {
          template,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Reorder template items error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to reorder template items';
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
