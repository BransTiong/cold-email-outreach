import { OAuth2Client } from 'google-auth-library';
import { decrypt } from '@/lib/crypto';

/**
 * Gmail scopes we request per connected account:
 *  - gmail.send     → send mail as the user
 *  - gmail.readonly → read threads/history for reply detection + seed
 *                     placement checks
 * userinfo.email lets us learn which address just authorised so we can key
 * the account row by it.
 */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function makeOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  });
}

/**
 * URL the user visits to grant access. `access_type: offline` +
 * `prompt: consent` forces Google to return a refresh token even on
 * re-authorisation — without it, repeat connects yield only short-lived
 * access tokens and we can't send later. `state` round-trips CSRF/context.
 */
export function buildConsentUrl(state: string): string {
  return makeOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  });
}

export interface ExchangedTokens {
  email: string;
  refreshToken: string;
}

/**
 * Exchange the OAuth callback `code` for tokens and resolve the granting
 * email. Throws if Google didn't return a refresh token (happens when the
 * account previously consented and `prompt: consent` was omitted).
 */
export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Revoke the app at myaccount.google.com/permissions and reconnect.',
    );
  }
  client.setCredentials(tokens);
  // id_token carries the email claim; verify + read it.
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const email = ticket.getPayload()?.email;
  if (!email) throw new Error('Could not resolve email from Google id_token');
  return { email, refreshToken: tokens.refresh_token };
}

/**
 * Build an authenticated client for a connected account from its stored
 * refresh token. google-auth-library transparently mints a fresh access
 * token on demand and on 401, so callers never handle access tokens.
 */
export function clientForRefreshToken(refreshToken: string): OAuth2Client {
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/**
 * Authenticated Gmail client for a connected account, decrypting its stored
 * refresh token. Single place that couples the encrypted column to the client
 * builder — callers don't repeat the decrypt step.
 */
export function clientForAccount(acct: { refreshTokenEnc: string }): OAuth2Client {
  return clientForRefreshToken(decrypt(acct.refreshTokenEnc));
}
