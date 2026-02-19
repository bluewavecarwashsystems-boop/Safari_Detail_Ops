/**
 * Next.js Middleware for i18n, authentication and route protection
 * Runs on Vercel Edge Runtime
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/auth/session';
import { locales, defaultLocale, isValidLocale, type Locale } from './i18n';

const LOCALE_COOKIE_NAME = 'safari_locale';

// Public routes that don't require authentication (without locale prefix)
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
 * Extract locale from pathname
 */
function getLocaleFromPathname(pathname: string): { locale: Locale | null; pathnameWithoutLocale: string } {
  const segments = pathname.split('/');
  const potentialLocale = segments[1];

  if (potentialLocale && isValidLocale(potentialLocale)) {
    return {
      locale: potentialLocale as Locale,
      pathnameWithoutLocale: '/' + segments.slice(2).join('/'),
    };
  }

  return {
    locale: null,
    pathnameWithoutLocale: pathname,
  };
}

/**
 * Get preferred locale from cookie or header
 */
function getPreferredLocale(request: NextRequest): Locale {
  // Check cookie first
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale as Locale;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    for (const locale of locales) {
      if (acceptLanguage.toLowerCase().includes(locale)) {
        return locale;
      }
    }
  }

  return defaultLocale;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static files (before locale check)
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Extract locale from pathname
  const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname);

  // If no locale in path, redirect to preferred locale
  if (!locale) {
    const preferredLocale = getPreferredLocale(request);
    const redirectUrl = new URL(`/${preferredLocale}${pathname}`, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if the path without locale is public
  if (isPublicPath(pathnameWithoutLocale)) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    // No session token
    return handleUnauthorized(request, locale, pathnameWithoutLocale);
  }

  // Verify session token
  const session = await verifySessionToken(token);

  if (!session) {
    // Invalid or expired token
    return handleUnauthorized(request, locale, pathnameWithoutLocale);
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
function handleUnauthorized(request: NextRequest, locale: Locale, pathnameWithoutLocale: string): NextResponse {
  // For API routes, return 401 JSON
  if (pathnameWithoutLocale.startsWith('/api/')) {
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

  // For page routes, redirect to login with locale
  const loginUrl = new URL(`/${locale}/login`, request.url);
  loginUrl.searchParams.set('redirect', pathnameWithoutLocale);
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
