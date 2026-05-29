import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge guard (Next 16 "proxy", formerly middleware) so the app can be exposed
 * through a tunnel for the open-tracking pixel WITHOUT exposing the
 * unauthenticated UI/API.
 *
 * Public from anywhere: the tracking endpoints (`/t/*` — open pixel +
 * unsubscribe) and `/healthz`. Everything else (the UI and `/v1/*`, which can
 * send mail, connect accounts, read data) is served only when the request's
 * Host is local. A tunnel forwards the public hostname in the Host header, so a
 * non-local Host ⇒ the request came from the internet ⇒ 404 for anything
 * outside the public surface.
 */
const PUBLIC_PREFIXES = ['/t/'];
const PUBLIC_EXACT = new Set(['/healthz']);

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || PUBLIC_EXACT.has(pathname)) {
    return NextResponse.next();
  }
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const isLocal =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  return isLocal ? NextResponse.next() : new NextResponse('Not found', { status: 404 });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
