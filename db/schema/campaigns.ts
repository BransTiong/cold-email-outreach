import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { leadList } from './leads';

/**
 * A send campaign: a subject + body template applied to every lead in a
 * list, dripped out across the connected Gmail accounts. The template uses
 * {{fieldName}} placeholders resolved against each lead's `fields`.
 */
export const campaign = pgTable('campaign', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  listId: uuid('list_id')
    .notNull()
    .references(() => leadList.id, { onDelete: 'restrict' }),
  subjectTemplate: text('subject_template').notNull(),
  // HTML body template. Plaintext alternative is auto-derived at send time.
  bodyTemplate: text('body_template').notNull(),
  // draft | sending | paused | done
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * The atomic send unit: one lead × one campaign. Created when a campaign is
 * launched. The sender worker walks rows where status='queued' and
 * scheduledAt <= now, renders the template, sends via the assigned account,
 * then records the Gmail message/thread id for open + reply matching.
 *
 * `trackToken` is the opaque id embedded in the open-pixel URL and the
 * unsubscribe link — keeps the recipient row id out of public URLs.
 */
export const recipient = pgTable(
  'recipient',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').notNull(),
    email: text('email').notNull(),
    // queued | sending | sent | failed | unsubscribed | skipped
    status: text('status').notNull().default('queued'),
    // Account chosen at send time (null until then). Lets us trace which
    // inbox a message went out from for reply syncing.
    accountId: uuid('account_id'),
    trackToken: text('track_token').notNull().unique(),
    scheduledAt: timestamp('scheduled_at'),
    sentAt: timestamp('sent_at'),
    // Gmail identifiers, populated on successful send. threadId is the key
    // for reply detection.
    gmailMessageId: text('gmail_message_id'),
    gmailThreadId: text('gmail_thread_id'),
    // First-open + first-reply timestamps, denormalised for cheap stats.
    openedAt: timestamp('opened_at'),
    repliedAt: timestamp('replied_at'),
    lastError: text('last_error'),
  },
  (t) => [
    index('recipient_campaign_idx').on(t.campaignId),
    index('recipient_status_sched_idx').on(t.status, t.scheduledAt),
    index('recipient_thread_idx').on(t.gmailThreadId),
  ],
);
