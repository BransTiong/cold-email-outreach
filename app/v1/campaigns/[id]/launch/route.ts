import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { campaign, recipient, lead } from '@/db/schema/index';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const { id } = await params;
  const db = getDb();

  const [c] = await db.select().from(campaign).where(eq(campaign.id, id));
  if (!c) return Response.json({ error: 'not_found' }, { status: 404 });
  if (c.status !== 'draft') {
    return Response.json({ error: 'already_launched', status: c.status }, { status: 409 });
  }

  const targets = await db
    .select({ id: lead.id, email: lead.email })
    .from(lead)
    .where(eq(lead.listId, c.listId));
  if (targets.length === 0) return Response.json({ error: 'empty_list' }, { status: 400 });

  const now = new Date();
  const rows: (typeof recipient.$inferInsert)[] = targets.map((t) => ({
    campaignId: c.id,
    leadId: t.id,
    email: t.email,
    status: 'queued',
    trackToken: randomBytes(16).toString('hex'),
    scheduledAt: now,
  }));

  // One transaction so recipients + the 'sending' flip commit together (a
  // crash between them would otherwise leave queued rows under a campaign the
  // sender never picks up). Chunk the insert to stay under Postgres'
  // 65535-bind-parameter limit (~6 params/row → ~10.9k rows max per statement).
  const CHUNK = 1000;
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx.insert(recipient).values(rows.slice(i, i + CHUNK));
    }
    await tx.update(campaign).set({ status: 'sending' }).where(eq(campaign.id, c.id));
  });

  return Response.json({ id: c.id, status: 'sending', queued: rows.length });
}
