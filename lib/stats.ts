import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/index';
import { recipient } from '@/db/schema/index';

/**
 * Campaign funnel columns, shared by the dashboard (grouped over all
 * campaigns) and the per-campaign views (filtered to one id). Defining the
 * `count(*) filter (...)` expressions once means a status rename only changes
 * here, not in three query sites.
 */
export const statColumns = {
  total: sql<number>`count(*)::int`,
  sent: sql<number>`count(*) filter (where ${recipient.sentAt} is not null)::int`,
  opened: sql<number>`count(*) filter (where ${recipient.openedAt} is not null)::int`,
  replied: sql<number>`count(*) filter (where ${recipient.repliedAt} is not null)::int`,
  failed: sql<number>`count(*) filter (where ${recipient.status} = 'failed')::int`,
  unsubscribed: sql<number>`count(*) filter (where ${recipient.status} = 'unsubscribed')::int`,
  queued: sql<number>`count(*) filter (where ${recipient.status} = 'queued')::int`,
};

export type CampaignStats = {
  [K in keyof typeof statColumns]: number;
};

/** Funnel counts for a single campaign. */
export async function campaignStats(db: Db, campaignId: string): Promise<CampaignStats> {
  const [row] = await db
    .select(statColumns)
    .from(recipient)
    .where(eq(recipient.campaignId, campaignId));
  return row!;
}
