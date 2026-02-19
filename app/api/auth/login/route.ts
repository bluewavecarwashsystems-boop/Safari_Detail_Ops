/**
 * POST /api/auth/login
 * Authenticates a user and creates a session
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { getUserByEmail, updateLastLogin, toSafeUser } from '@/lib/services/user-service';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionCookie } from '@/lib/auth/session';

interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
          },
        },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      // Use generic error to prevent email enumeration
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'This account has been disabled',
          },
        },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Create session cookie
    await createSessionCookie({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Update last login timestamp (fire and forget)
    updateLastLogin(user.userId).catch((error) => {
      console.error('Failed to update last login:', error);
    });

    // Return user data (without sensitive fields)
    return NextResponse.json({
      success: true,
      data: {
        user: toSafeUser(user),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        },
      },
      { status: 500 }
    );
  }
}
