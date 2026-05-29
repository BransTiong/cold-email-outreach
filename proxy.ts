import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth gate (Next 16 "proxy"). Unauthenticated requests are redirected to
 * /login (pages) or rejected with 401 (API/data). Real session validation
 * happens in the pages/route handlers via getSession; here we only do the fast
 * optimistic cookie check Better Auth recommends for middleware.
 *
 * Public surface (no login):
 *  - /t/*                         open pixel + unsubscribe (recipients / Gmail)
 *  - /api/auth/*                  Better Auth endpoints
 *  - /login                       the login page
 *  - /healthz                     health check
 *  - /v1/accounts/oauth/callback  Google's OAuth redirect (carries no session)
 */
const PUBLIC_PREFIXES = ['/t/', '/api/auth/', '/login'];
const PUBLIC_EXACT = new Set(['/healthz', '/v1/accounts/oauth/callback']);

function hasSessionCookie(req: NextRequest): boolean {
  // Check both the secure-prefixed (https/prod, behind Caddy) and plain
  // (local http) cookie names so TLS-terminating proxies don't break the gate.
  return Boolean(
    req.cookies.get('__Secure-better-auth.session_token')?.value ??
      req.cookies.get('better-auth.session_token')?.value,
  );
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || PUBLIC_EXACT.has(pathname)) {
    return NextResponse.next();
  }
  if (hasSessionCookie(req)) return NextResponse.next();

  if (pathname.startsWith('/v1/') || pathname.startsWith('/api/')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
