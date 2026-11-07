import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'minienginescreations@gmail.com';

async function isTokenValid(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    // Decode base64 URL-safe payload
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadBase64);
    const payload = JSON.parse(decoded);

    // Fast preliminary checks: valid exp and matching email
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return false;
    }
    if (payload.email && payload.email !== ADMIN_EMAIL) {
      return false;
    }

    // Cryptographic signature check via Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        return false;
      }

      const user = await res.json();
      return user && user.email === ADMIN_EMAIL;
    }

    // Fail closed if cryptographic verification cannot be completed
    return false;
  } catch (e) {
    console.error('Error parsing token in proxy:', e);
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('sb-session')?.value;

  const isValid = token ? await isTokenValid(token) : false;

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
