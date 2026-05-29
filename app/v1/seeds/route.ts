import { getDb } from '@/db/index';
import { seedMailbox } from '@/db/schema/index';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const seeds = await getDb().select().from(seedMailbox);
  return Response.json({ seeds });
}

const PROVIDERS = ['gmail', 'outlook', 'yahoo', 'other'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    provider?: 'gmail' | 'outlook' | 'yahoo' | 'other';
    gmailAccountId?: string;
  } | null;
  if (!body?.email || !body.provider) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!body.email.includes('@')) {
    return Response.json({ error: 'bad_email' }, { status: 400 });
  }
  if (!PROVIDERS.includes(body.provider)) {
    return Response.json({ error: 'bad_provider', expected: PROVIDERS }, { status: 400 });
  }
  // Non-uuid would otherwise throw a Postgres cast error (500) at insert.
  if (body.gmailAccountId !== undefined && !UUID_RE.test(body.gmailAccountId)) {
    return Response.json({ error: 'bad_gmail_account_id' }, { status: 400 });
  }
  const [row] = await getDb()
    .insert(seedMailbox)
    .values({ email: body.email, provider: body.provider, gmailAccountId: body.gmailAccountId })
    .onConflictDoUpdate({
      target: seedMailbox.email,
      set: { provider: body.provider, gmailAccountId: body.gmailAccountId },
    })
    .returning();
  return Response.json({ id: row!.id, email: row!.email }, { status: 201 });
}
