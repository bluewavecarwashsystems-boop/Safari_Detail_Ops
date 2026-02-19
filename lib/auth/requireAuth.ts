/**
 * API route protection utilities
 * Provides helpers to enforce authentication and authorization in API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSession, type SessionPayload } from './session';
import type { UserRole } from '../types';

/**
 * Wrapper for API routes that require authentication
 * Usage:
 *   export const GET = requireAuth(async (req, session) => {
 *     // Your handler code here
 *   });
 */
export function requireAuth<T extends any[]>(
  handler: (
    request: NextRequest,
    session: SessionPayload,
    ...args: T
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const session = await requireSession();
      return await handler(request, session, ...args);
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
          },
          { status: 401 }
        );
      }

      // Unexpected error
      console.error('Auth error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrapper for API routes that require specific role(s)
 * Usage:
 *   export const POST = requireRole(['MANAGER'], async (req, session) => {
 *     // Your handler code here
 *   });
 */
export function requireRole<T extends any[]>(
  allowedRoles: UserRole[],
  handler: (
    request: NextRequest,
    session: SessionPayload,
    ...args: T
  ) => Promise<NextResponse> | NextResponse
) {
  return requireAuth<T>(async (request, session, ...args) => {
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        },
        { status: 403 }
      );
    }

    return await handler(request, session, ...args);
  });
}
