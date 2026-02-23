/**
 * POST /api/templates/items
 * 
 * Add a new item to a checklist template.
 * 
 * Auth: Manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireAuth';
import {
  UserRole,
  ChecklistType,
  type ApiResponse,
  type AddTemplateItemRequest,
  type AddTemplateItemResponse,
} from '@/lib/types';
import * as checklistTemplateService from '@/lib/services/checklist-template-service';

/**
 * POST /api/templates/items
 * Request body: { serviceType, type, label, isRequired }
 */
export const POST = requireRole(
  [UserRole.MANAGER],
  async (request: NextRequest, session): Promise<NextResponse> => {
    try {
      const body: AddTemplateItemRequest = await request.json();
      const { serviceType, type, label, isRequired = false } = body;

      // Validation
      if (!serviceType || !type || !label) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'serviceType, type, and label are required',
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

      // Add item
      const template = await checklistTemplateService.addTemplateItem(
        serviceType,
        type,
        label.trim(),
        isRequired,
        {
          userId: session.sub,
          name: session.name,
          role: session.role as UserRole,
        }
      );

      const response: ApiResponse<AddTemplateItemResponse> = {
        success: true,
        data: {
          template,
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Add template item error:', error);
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add template item',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 500 });
    }
  }
);
