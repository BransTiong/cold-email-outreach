import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { gmailAccount, seedMailbox, placementResult } from '@/db/schema/index';
import { clientForAccount } from '@/lib/google-oauth';
import { placementForQuery } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; marker: string }> },
) {
  const { id, marker } = await params;
  const db = getDb();
  const seedRows = await db.select().from(seedMailbox);
  const query = `subject:"[seedtest:${marker}]"`;
  const results: { email: string; provider: string; placement: string }[] = [];

  for (const seed of seedRows) {
    let placement = 'unknown';
    if (seed.provider === 'gmail' && seed.gmailAccountId) {
      const [acct] = await db
        .select()
        .from(gmailAccount)
        .where(eq(gmailAccount.id, seed.gmailAccountId));
      if (acct) {
        const client = clientForAccount(acct);
        placement = await placementForQuery(client, query);
      }
    }
    await db.insert(placementResult).values({ campaignId: id, seedMailboxId: seed.id, placement });
    results.push({ email: seed.email, provider: seed.provider, placement });
  }

  const readable = results.filter((r) => r.placement !== 'unknown');
  const inbox = readable.filter((r) => r.placement === 'inbox').length;
  const inboxPlacementPct =
    readable.length > 0 ? Math.round((inbox / readable.length) * 100) : null;

  return Response.json({ results, inboxPlacementPct });
}
