import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { campaign, gmailAccount, seedMailbox, lead } from '@/db/schema/index';
import { clientForAccount } from '@/lib/google-oauth';
import { sendRaw } from '@/lib/gmail';
import { buildRawMessage } from '@/lib/mime';
import { render } from '@/lib/template';
import { getEnv } from '@/lib/env';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const { id } = await params;
  const db = getDb();

  // These three reads are independent — run them together.
  const [[c], [sender], seedRows] = await Promise.all([
    db.select().from(campaign).where(eq(campaign.id, id)),
    db.select().from(gmailAccount).where(eq(gmailAccount.status, 'active')).limit(1),
    db.select().from(seedMailbox),
  ]);
  if (!c) return Response.json({ error: 'campaign_not_found' }, { status: 404 });
  if (!sender) return Response.json({ error: 'no_active_sending_account' }, { status: 400 });
  if (seedRows.length === 0) return Response.json({ error: 'no_seeds' }, { status: 400 });

  const [sampleLead] = await db.select().from(lead).where(eq(lead.listId, c.listId)).limit(1);
  const fields = sampleLead?.fields ?? {};
  const marker = randomBytes(4).toString('hex');
  const subject = `${render(c.subjectTemplate, fields).text} [seedtest:${marker}]`;
  const html = render(c.bodyTemplate, fields).text;

  const senderClient = clientForAccount(sender);
  const results: { email: string; sent: boolean }[] = [];
  for (const seed of seedRows) {
    const raw = buildRawMessage({
      fromName: sender.displayName,
      fromEmail: sender.email,
      to: seed.email,
      subject,
      html,
      baseUrl: getEnv().PUBLIC_BASE_URL,
      trackToken: `seedtest-${marker}`,
    });
    try {
      await sendRaw(senderClient, raw);
      results.push({ email: seed.email, sent: true });
    } catch (err) {
      console.warn('[seed-test] send failed', seed.email, err);
      results.push({ email: seed.email, sent: false });
    }
  }

  return Response.json({
    campaignId: c.id,
    marker,
    subject,
    sentTo: results,
    next: `POST /v1/campaigns/${c.id}/seed-test/${marker}/check after ~60s`,
  });
}
