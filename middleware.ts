/**
 * Next.js Middleware for authentication and route protection
 * Runs on Vercel Edge Runtime
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/auth/session';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/square/webhooks', // Square webhook endpoints
];

// Static assets and Next.js internals
const PUBLIC_FILE_PATTERNS = [
  /^\/favicon\.ico$/,
  /^\/manifest\.json$/,
  /^\/.*\.(png|jpg|jpeg|gif|svg|ico|webp)$/,
  /^\/_next\//,
  /^\/api\/_next\//,
];

/**
 * Check if a path is public (doesn't require auth)
 */
function isPublicPath(pathname: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return true;
  }

  // Check file patterns
  if (PUBLIC_FILE_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return true;
  }

  return false;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    // No session token
    return handleUnauthorized(request, pathname);
  }

  // Verify session token
  const session = await verifySessionToken(token);

  if (!session) {
    // Invalid or expired token
    return handleUnauthorized(request, pathname);
  }

  // Session is valid, allow request to proceed
  // Add user info to request headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.sub);
  requestHeaders.set('x-user-role', session.role);
  requestHeaders.set('x-user-email', session.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Handle unauthorized access
 */
function handleUnauthorized(request: NextRequest, pathname: string): NextResponse {
  // For API routes, return 401 JSON
  if (pathname.startsWith('/api/')) {
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

  // For page routes, redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Middleware configuration
 * See: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
