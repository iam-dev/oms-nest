import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

// Define the shape of our JWT payload
interface JwtPayload {
  exp?: number;
  role?: string | string[] | { name?: string };
  roles?: string[];
  type?: string;
  userId?: string;
  id?: string | number;
  [key: string]: unknown;
}

// Import jose for Edge Runtime compatible JWT handling
import { jwtVerify, decodeJwt } from 'jose';

// JWT verification function that works in Edge Runtime
async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as JwtPayload;
  } catch (error) {
    logger.error('Failed to verify JWT:', error);
    return null;
  }
}

// Decode JWT without signature verification (for role checking when verification is bypassed)
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    return decodeJwt(token) as JwtPayload;
  } catch {
    return null;
  }
}

// Define which roles are allowed per route
const roleMap: Record<string, string[]> = {
  '/reports': ['admin', 'supervisor'],
  '/my-views': ['admin', 'supervisor'],
  '/dashboard': ['admin', 'user', 'supervisor', 'fitter'],
  '/orders': ['admin', 'user', 'supervisor', 'fitter'],
  '/my-saddle-stock': ['fitter'],
  '/available-saddle-stock': ['fitter'],
  '/saddle-stock': ['admin', 'supervisor'],
  '/repairs': ['admin', 'user', 'supervisor', 'fitter'],
  '/models': ['admin', 'user', 'supervisor'],
  '/customers': ['admin', 'user', 'supervisor', 'fitter'],
  '/fitters': ['admin', 'user', 'supervisor'],
  '/brands': ['admin', 'user', 'supervisor'],
  '/leathertypes': ['admin', 'user', 'supervisor'],
  '/options': ['admin', 'user', 'supervisor'],
  '/extras': ['admin', 'user', 'supervisor'],
  '/order-items': ['admin', 'user', 'supervisor'],
  '/presets': ['admin', 'user', 'supervisor'],
  '/product-stocks': ['admin', 'user', 'supervisor'],
  '/products': ['admin', 'user', 'supervisor'],
  '/factories': ['admin', 'supervisor'],
  '/find-saddle': ['admin', 'user', 'supervisor', 'fitter'],
};

const JWT_SECRET = process.env.JWT_SECRET || '';

export async function middleware(request: NextRequest) {
  // --- CSP header generation ---
  const isDev = process.env.NODE_ENV === 'development';
  const connectSrc = isDev
    ? "connect-src 'self' http://localhost:3001 https://*.ordermysaddle.com"
    : "connect-src 'self' https://*.ordermysaddle.com";

  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Token is stored as httpOnly cookie by the backend
  const token = request.cookies.get('token')?.value;

  const { pathname } = request.nextUrl;

  logger.log('Middleware: path:', pathname, '| token:', token ? 'present' : 'absent');

  // Public routes that don't require authentication
  const publicPaths = ['/login', '/api/login', '/favicon.ico', '/public', '/password-change'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    logger.log('Middleware: public path, allowing');
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  // Handle client-side routing - if this is a navigation request and no token in cookie,
  // but we might have one in localStorage, we need a special check
  const isClientNavigation = request.headers.get('sec-fetch-dest') === 'document';

  if (isClientNavigation && !token) {
    // For client navigation without cookie token, allow the request to proceed
    // The client-side AuthContext will handle the redirect if needed
    logger.log('Middleware: client navigation without cookie, deferring to client auth');
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  // Only check for protected routes
  const protectedPath = Object.keys(roleMap).find(path => pathname.startsWith(path));
  logger.log('Middleware: protected path:', protectedPath || 'none');
  
  if (protectedPath) {
    // Verify token signature and extract role
    let payload: JwtPayload | null = null;
    if (token) {
      if (JWT_SECRET) {
        payload = await verifyJwt(token);
        if (!payload) {
          logger.log('Middleware: JWT verification failed, redirecting to login');
          return NextResponse.redirect(new URL('/login', request.url));
        }
      } else {
        // Fallback to decode-only when JWT_SECRET is not configured (dev without env)
        logger.log('Middleware: JWT_SECRET not set, falling back to decode-only');
        payload = decodeJwtPayload(token);
      }
    }
    const userRole = typeof payload?.role === 'object' && payload.role && !Array.isArray(payload.role)
      ? (payload.role as { name?: string }).name?.toLowerCase()
      : undefined;

    logger.log('Middleware: role:', userRole || 'none');

    const allowedRoles = roleMap[protectedPath];
    if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
      logger.log('Middleware: access denied for path:', protectedPath);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    requestHeaders.set('x-user-id', payload?.id?.toString() || 'unknown');
    requestHeaders.set('x-user-role', userRole || 'unknown');

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', cspHeader);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
