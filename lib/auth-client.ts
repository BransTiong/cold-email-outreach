'use client';

import { createAuthClient } from 'better-auth/react';

// Same-origin: baseURL defaults to the current origin, so no config needed.
export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
