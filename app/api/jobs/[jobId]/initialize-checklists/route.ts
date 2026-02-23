/**
 * POST /api/jobs/[jobId]/initialize-checklists
 * 
 * Initialize checklists from templates when job moves to CHECKED_IN.
 * Snapshots active template items into the job's checklist field.
 * Only runs once per job - won't overwrite existing checklists.
 * 
 * Auth: Manager or Tech
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import {
  UserRole,
  ChecklistType,
  type ApiResponse,
  type InitializeChecklistsResponse,
  type ChecklistItem,
} from '@/lib/types';
import * as checklistTemplateService from '@/lib/services/checklist-template-service';
import * as dynamodb from '@/lib/aws/dynamodb';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/jobs/[jobId]/initialize-checklists
 * Request body: { serviceType: string }
 * 
 * Creates checklist snapshots from templates.
 * Must be called before job can move to CHECKED_IN.
 */
export const POST = requireAuth(
  async (
    request: NextRequest,
    session,
    { params }: { params: { jobId: string } }
  ): Promise<NextResponse> => {
    try {
      const jobId = params.jobId;
      const body = await request.json();
      const { serviceType } = body;

      if (!serviceType) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'serviceType is required',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Get job
      const job = await dynamodb.getJob(jobId);
      if (!job) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Job ${jobId} not found`,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 404 });
      }

      // Check if checklists already exist
      if (job.checklist && (job.checklist.tech || job.checklist.qc)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CHECKLISTS_ALREADY_EXIST',
            message: 'Checklists have already been initialized for this job',
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // Get active template items for both TECH and QC
      const [techTemplateItems, qcTemplateItems] = await Promise.all([
        checklistTemplateService.getActiveTemplateItems(
          serviceType,
          ChecklistType.TECH
        ),
        checklistTemplateService.getActiveTemplateItems(
          serviceType,
          ChecklistType.QC
        ),
      ]);

      // Convert template items to checklist items
      const techChecklist: ChecklistItem[] = techTemplateItems.map((item) => ({
        id: uuidv4(),
        label: item.label,
        checked: false,
      }));

      const qcChecklist: ChecklistItem[] = qcTemplateItems.map((item) => ({
        id: uuidv4(),
        label: item.label,
        checked: false,
      }));

      // Update job with checklists
      const updatedJob = await dynamodb.updateJob(jobId, {
        checklist: {
          tech: techChecklist,
          qc: qcChecklist,
        },
        updatedBy: {
          userId: session.sub,
          name: session.name,
          role: session.role as UserRole,
        },
      });

      console.log(`[ChecklistInit] Initialized checklists for job ${jobId}:`, {
        techItems: techChecklist.length,
        qcItems: qcChecklist.length,
        serviceType,
      });

      const response: ApiResponse<InitializeChecklistsResponse> = {
        success: true,
        data: {
          checklists: {
            tech: {
              jobId,
              checklistId: uuidv4(),
              type: ChecklistType.TECH,
              templateId: `${serviceType}#${ChecklistType.TECH}`,
              templateVersion: 1, // TODO: Get from template
              items: techChecklist.map((item, index) => ({
                id: item.id,
                label: item.label,
                sortOrder: index,
                isCompleted: item.checked,
              })),
              createdAt: new Date().toISOString(),
            },
            qc: {
              jobId,
              checklistId: uuidv4(),
              type: ChecklistType.QC,
              templateId: `${serviceType}#${ChecklistType.QC}`,
              templateVersion: 1, // TODO: Get from template
              items: qcChecklist.map((item, index) => ({
                id: item.id,
                label: item.label,
                sortOrder: index,
                isCompleted: item.checked,
              })),
              createdAt: new Date().toISOString(),
            },
          },
        },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Initialize checklists error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize checklists';
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
