/**
 * Receipt Presign API
 * 
 * POST /api/jobs/[jobId]/receipts/presign
 * 
 * Generate presigned URLs for receipt photo uploads (MANAGER only).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PresignReceiptRequest, PresignReceiptResponse } from '@/lib/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import { generatePresignedReceiptUrls } from '@/lib/services/job-service';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const POST = requireAuth(async (
  request: NextRequest,
  session,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
): Promise<NextResponse> => {
  try {
    // Await params in case it's a Promise (Next.js 15+)
    const params = await Promise.resolve(context.params);
    const jobId = params.jobId;

    if (!jobId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_JOB_ID',
          message: 'Job ID is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    const body: PresignReceiptRequest = await request.json();

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'files array is required',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate file count (max 10 receipts at once)
    if (body.files.length > 10) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Maximum 10 receipt files per upload',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate content types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    for (const file of body.files) {
      if (!validTypes.includes(file.contentType)) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Invalid content type: ${file.contentType}. Allowed: ${validTypes.join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 400 });
      }
    }

    // Only MANAGER can upload receipts
    const userRole = session.role as UserRole;
    if (userRole !== UserRole.MANAGER) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only MANAGER can upload receipt photos',
        },
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response, { status: 403 });
    }

    // Generate presigned URLs
    const uploads = await generatePresignedReceiptUrls(jobId, body.files);

    const responseData: PresignReceiptResponse = { uploads };

    const response: ApiResponse = {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[RECEIPT PRESIGN ERROR]', {
      error: error.message,
      stack: error.stack,
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PRESIGN_ERROR',
        message: error.message || 'Failed to generate presigned URLs for receipts',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 500 });
  }
});
