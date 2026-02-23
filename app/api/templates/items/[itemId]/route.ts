/**
 * PUT /api/templates/items/[itemId]
 * DELETE /api/templates/items/[itemId]
 * 
 * Update or delete a checklist template item.
 * 
 * Auth: Manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import {
  UserRole,
  ChecklistType,
  type ApiResponse,
  type UpdateTemplateItemRequest,
  type UpdateTemplateItemResponse,
  type DeleteTemplateItemRequest,
  type DeleteTemplateItemResponse,
} from '@/lib/types';
import * as checklistTemplateService from '@/lib/services/checklist-template-service';

/**
 * PUT /api/templates/items/[itemId]
 * Request body: { serviceType, type, itemId, label?, isRequired? }
 */
export const PUT = requireRole(
  [UserRole.MANAGER],
  async (
    request: NextRequest,
    session,
    { params }: { params: { itemId: string } }
  ): Promise<NextResponse> => {
    try {
      const body: UpdateTemplateItemRequest = await request.json();
      const { serviceType, type, label, isRequired } = body;
      const itemId = params.itemId;

      // Validation
      if (!serviceType || !type || !itemId) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'serviceType, type, and itemId are required',
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

      if (label === undefined && isRequired === undefined) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'At least one of label or isRequired must be provided',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Update item
      const updates: { label?: string; isRequired?: boolean } = {};
      if (label !== undefined) updates.label = label.trim();
      if (isRequired !== undefined) updates.isRequired = isRequired;

      const template = await checklistTemplateService.updateTemplateItem(
        serviceType,
        type,
        itemId,
        updates,
        {
          userId: session.sub,
          name: session.name,
          role: session.role as UserRole,
        }
      );

      const response: ApiResponse<UpdateTemplateItemResponse> = {
        success: true,
        data: {
          template,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Update template item error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update template item';
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

/**
 * DELETE /api/templates/items/[itemId]
 * Request body: { serviceType, type, itemId }
 */
export const DELETE = requireRole(
  [UserRole.MANAGER],
  async (
    request: NextRequest,
    session,
    { params }: { params: { itemId: string } }
  ): Promise<NextResponse> => {
    try {
      const body: DeleteTemplateItemRequest = await request.json();
      const { serviceType, type } = body;
      const itemId = params.itemId;

      // Validation
      if (!serviceType || !type || !itemId) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'serviceType, type, and itemId are required',
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

      // Soft delete item
      const template = await checklistTemplateService.deleteTemplateItem(
        serviceType,
        type,
        itemId,
        {
          userId: session.sub,
          name: session.name,
          role: session.role as UserRole,
        }
      );

      const response: ApiResponse<DeleteTemplateItemResponse> = {
        success: true,
        data: {
          template,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Delete template item error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete template item';
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
