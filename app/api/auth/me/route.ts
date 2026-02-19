/**
 * GET /api/auth/me
 * Returns the current user's session information
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    // Return user info from session
    return NextResponse.json({
      success: true,
      data: {
        user: {
          userId: session.sub,
          email: session.email,
          name: session.name,
          role: session.role,
        },
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
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
}
