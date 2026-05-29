import { getDb } from '@/db/index';
import { gmailAccount } from '@/db/schema/index';
import { exchangeCode } from '@/lib/google-oauth';
import { encrypt } from '@/lib/crypto';
import { pendingStates } from '@/lib/oauth-state';

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

  // Bounce back to the UI with a success flag.
  return Response.redirect(
    new URL(`/accounts?connected=${encodeURIComponent(email)}`, url.origin).toString(),
    302,
  );
}
