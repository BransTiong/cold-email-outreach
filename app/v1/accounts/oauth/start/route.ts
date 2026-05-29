import { randomBytes } from 'node:crypto';
import { buildConsentUrl } from '@/lib/google-oauth';
import { issueState } from '@/lib/oauth-state';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const state = randomBytes(16).toString('hex');
  issueState(state);
  return Response.redirect(buildConsentUrl(state), 302);
}
