import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode base64 URL-safe payload
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadBase64);
    const payload = JSON.parse(decoded);
    
    // Check if token expiration date is in the future
    if (payload.exp && payload.exp * 1000 > Date.now()) {
      return true;
    }
  } catch (e) {
    console.error('Error parsing token in proxy:', e);
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('sb-session')?.value;

  const isValid = token ? isTokenValid(token) : false;

  // If trying to access the login page
  if (pathname === '/admin/login') {
    if (isValid) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  // Protect all other /admin routes
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!isValid) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
