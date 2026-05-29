import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Defer getAuth() to request time (it builds the DB-backed auth instance) so
// the build doesn't construct it. Better Auth's handler is a Web
// Request→Response function.
export async function GET(req: Request): Promise<Response> {
  return getAuth().handler(req);
}

export async function POST(req: Request): Promise<Response> {
  return getAuth().handler(req);
}
