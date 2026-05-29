import { getDb } from '@/db/index';
import { gmailAccount } from '@/db/schema/index';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const rows = await getDb().select().from(gmailAccount);
  return Response.json({
    accounts: rows.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      sentToday: r.sentToday,
      lastSentAt: r.lastSentAt?.toISOString() ?? null,
    })),
  });
}
