import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Append-only event log, one row per tracked thing that happened to a
 * recipient. Denormalised summaries (openedAt, repliedAt) live on the
 * recipient row for fast stats; this table is the full audit trail and
 * supports repeat events (an email opened 5 times → 5 rows).
 *
 * type: sent | open | reply | bounce | unsubscribe | failed
 */
export const emailEvent = pgTable(
  'email_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    type: text('type').notNull(),
    // Arbitrary context: user-agent + ip for opens, snippet for replies, etc.
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('email_event_recipient_idx').on(t.recipientId),
    index('email_event_campaign_type_idx').on(t.campaignId, t.type),
  ],
);

/**
 * Seed mailboxes for spam-placement testing. Because no provider tells a
 * sender whether their mail landed in a recipient's spam folder, the only
 * honest signal is to BCC/CC a panel of inboxes we control across providers
 * and check folder placement there via the Gmail API (Gmail seeds only).
 * Non-Gmail seeds (Outlook/Yahoo) would need their own IMAP creds — left as
 * a documented extension point.
 */
export const seedMailbox = pgTable('seed_mailbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  provider: text('provider').notNull(), // gmail | outlook | yahoo | other
  // For gmail seeds we reuse a connected gmail_account's token to read
  // placement; this points at that account's id.
  gmailAccountId: uuid('gmail_account_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Result of one seed test for one campaign: where the seeded message landed
 * (inbox | spam | promotions | unknown) per seed mailbox. Aggregated into an
 * inbox-placement % which is our spam-rate PROXY — not per-real-recipient.
 */
export const placementResult = pgTable(
  'placement_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id').notNull(),
    seedMailboxId: uuid('seed_mailbox_id').notNull(),
    placement: text('placement').notNull(), // inbox | spam | promotions | unknown
    checkedAt: timestamp('checked_at').notNull().defaultNow(),
  },
  (t) => [index('placement_campaign_idx').on(t.campaignId)],
);
