import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { recipient, emailEvent } from '@/db/schema/index';

export const dynamic = 'force-dynamic';

const PAGE =
  '<html><body style="font-family:sans-serif;text-align:center;padding:60px">' +
  "<h2>You're unsubscribed.</h2><p>You won't receive further emails. Sorry for the intrusion.</p>" +
  '</body></html>';

async function unsubscribe(token: string): Promise<void> {
  const db = getDb();
  const [r] = await db.select().from(recipient).where(eq(recipient.trackToken, token));
  if (!r) return;
  await db.update(recipient).set({ status: 'unsubscribed' }).where(eq(recipient.id, r.id));
  await db
    .insert(emailEvent)
    .values({ recipientId: r.id, campaignId: r.campaignId, type: 'unsubscribe' });
}

// Link click in the email body.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await unsubscribe(token);
  return new Response(PAGE, { headers: { 'Content-Type': 'text/html' } });
}

// RFC 8058 one-click: Gmail/Outlook POST here when the native "Unsubscribe"
// button is used (advertised via the List-Unsubscribe-Post header in mime.ts).
// Without this the button would 405 and the recipient would never be removed.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await unsubscribe(token);
  return new Response(null, { status: 204 });
}
