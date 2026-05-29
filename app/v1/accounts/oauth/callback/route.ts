import { getDb } from '@/db/index';
import { gmailAccount } from '@/db/schema/index';
import { exchangeCode } from '@/lib/google-oauth';
import { encrypt } from '@/lib/crypto';
import { pendingStates } from '@/lib/oauth-state';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return Response.json({ error }, { status: 400 });
  if (!code || !state || !pendingStates.has(state)) {
    return Response.json({ error: 'invalid_state_or_code' }, { status: 400 });
  }
  pendingStates.delete(state);

  const { email, refreshToken } = await exchangeCode(code);
  const refreshTokenEnc = encrypt(refreshToken);

  await getDb()
    .insert(gmailAccount)
    .values({ email, refreshTokenEnc, status: 'active' })
    .onConflictDoUpdate({
      target: gmailAccount.email,
      set: { refreshTokenEnc, status: 'active' },
    });

  // Bounce back to the UI with a success flag. Use PUBLIC_BASE_URL, NOT
  // url.origin — behind a TLS-terminating proxy (Caddy) req.url's origin is the
  // app's internal http://host:5050, which would send the browser to localhost.
  return Response.redirect(
    `${getEnv().PUBLIC_BASE_URL}/accounts?connected=${encodeURIComponent(email)}`,
    302,
  );
}
