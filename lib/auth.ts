import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/db/index';
import * as authSchema from '@/db/schema/auth';

/**
 * Lazy singleton Better Auth instance. Built on first use (not at import time)
 * so `next build` — which imports the auth route + pages — doesn't need a DB
 * connection or secrets present at build. Email + password only.
 */
function create() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET not set');
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.PUBLIC_BASE_URL,
    secret,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      // Lock new registrations once the owner account exists. Set
      // DISABLE_SIGNUP=true in the env after you've created your account.
      disableSignUp: process.env.DISABLE_SIGNUP === 'true',
    },
    // Same-origin UI; trust the app's public origin.
    trustedOrigins: [process.env.PUBLIC_BASE_URL ?? 'http://localhost:5050'],
  });
}

let _auth: ReturnType<typeof create> | undefined;

export function getAuth() {
  return (_auth ??= create());
}
