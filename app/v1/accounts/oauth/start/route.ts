import { randomBytes } from 'node:crypto';
import { buildConsentUrl } from '@/lib/google-oauth';
import { issueState } from '@/lib/oauth-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  issueState(state);
  return Response.redirect(buildConsentUrl(state), 302);
}
