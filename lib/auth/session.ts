/**
 * Session management using JWT tokens stored in HTTP-only cookies
 * Uses Web Crypto API for Edge Runtime compatibility (Vercel middleware)
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from '../types';

export const SESSION_COOKIE_NAME = 'safari_session';
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Session payload stored in JWT
 */
export interface SessionPayload {
  sub: string; // userId
  email: string;
  name: string;
  role: UserRole;
  iat: number; // issued at
  exp: number; // expiration
}

/**
 * Get the secret key for JWT signing/verification
 * Uses Web Crypto API for Edge compatibility
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set');
  }
  if (secret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters long');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a JWT session token
 */
export async function createSessionToken(payload: {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}): Promise<string> {
  const secret = getSecretKey();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_DURATION / 1000;

  const token = await new SignJWT({
    sub: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Validate payload has required fields
    if (
      !payload.sub ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as unknown as SessionPayload;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Create and set session cookie (for API routes)
 */
export async function createSessionCookie(payload: {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

/**
 * Clear session cookie (for logout)
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current session from cookies (for API routes)
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Verify session and return user info (throws if invalid)
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
