import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * One row per connected Gmail account used for sending. The OAuth refresh
 * token is stored encrypted (AES-256-GCM, see lib/crypto.ts) — never in
 * plaintext. Daily send counters live here so the rotation logic can pick
 * the next account that's still under its quota without a separate table.
 */
export const gmailAccount = pgTable(
  'gmail_account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    // Display name to put in the From header, e.g. "Branson". Optional —
    // falls back to whatever Gmail has on the account.
    displayName: text('display_name'),
    // Encrypted Google OAuth refresh token (base64 of iv:tag:ciphertext).
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    // active | paused | revoked. paused = user-disabled; revoked = Google
    // rejected the refresh token (re-auth needed).
    status: text('status').notNull().default('active'),
    // Sends counted toward today's quota + the UTC date that count is for.
    // Reset lazily by the sender when sentDateUtc rolls over.
    sentToday: integer('sent_today').notNull().default(0),
    sentDateUtc: text('sent_date_utc'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastSentAt: timestamp('last_sent_at'),
  },
  (t) => [index('gmail_account_status_idx').on(t.status)],
);
