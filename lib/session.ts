import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';

/** Server-component / page session lookup (validated against the DB). */
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

/** Route-handler session lookup — pass the request's headers. */
export async function getSessionFromRequest(req: Request) {
  return getAuth().api.getSession({ headers: req.headers });
}

/**
 * Guard for /v1 route handlers: returns a 401 Response if there's no valid
 * session, otherwise null (proceed). Usage:
 *   const unauth = await requireSession(req); if (unauth) return unauth;
 */
export async function requireSession(req: Request): Promise<Response | null> {
  const session = await getSessionFromRequest(req);
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}
