import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { gmailAccount, lead } from '@/db/schema/index';
import { clientForAccount } from '@/lib/google-oauth';
import { sendRaw } from '@/lib/gmail';
import { buildRawMessage } from '@/lib/mime';
import { render } from '@/lib/template';
import { getEnv } from '@/lib/env';
import { requireSession } from '@/lib/session';
import { isValidEmail } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/**
 * Send a one-off TEST of a campaign's templates to an arbitrary address, with
 * merge fields filled from the FIRST lead in the chosen list — so a demo email
 * shows real rendered content. Sends from the first active connected account.
 * Does not create a campaign or recipient row.
 */
export async function POST(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;

  const body = (await req.json().catch(() => null)) as {
    to?: string;
    listId?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
  } | null;

  if (!body?.to || !isValidEmail(body.to)) {
    return Response.json({ error: 'bad_recipient_email' }, { status: 400 });
  }
  if (!body.subjectTemplate || !body.bodyTemplate) {
    return Response.json({ error: 'missing_template' }, { status: 400 });
  }

  const db = getDb();
  const [sender] = await db
    .select()
    .from(gmailAccount)
    .where(eq(gmailAccount.status, 'active'))
    .limit(1);
  if (!sender) return Response.json({ error: 'no_active_sending_account' }, { status: 400 });

  // Sample lead's fields drive the merge fields (if a list was chosen).
  let fields: Record<string, string | null> = {};
  let sampleLabel = '(no sample lead — fields blank)';
  if (body.listId) {
    const [sample] = await db.select().from(lead).where(eq(lead.listId, body.listId)).limit(1);
    if (sample) {
      fields = sample.fields;
      sampleLabel =
        [fields['firstname'], fields['lastname']].filter(Boolean).join(' ').trim() ||
        sample.email;
    }
  }

  const subject = `[TEST] ${render(body.subjectTemplate, fields).text}`;
  const html = render(body.bodyTemplate, fields).text;

  try {
    await sendRaw(
      clientForAccount(sender),
      buildRawMessage({
        fromName: sender.displayName,
        fromEmail: sender.email,
        to: body.to,
        subject,
        html,
        baseUrl: getEnv().PUBLIC_BASE_URL,
        trackToken: `test-${randomBytes(6).toString('hex')}`,
      }),
    );
  } catch (err) {
    return Response.json(
      { error: 'send_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  return Response.json({
    sentTo: body.to,
    from: sender.email,
    usedLead: sampleLabel,
    renderedSubject: subject,
  });
}
