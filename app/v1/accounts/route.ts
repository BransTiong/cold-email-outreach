import { getDb } from '@/db/index';
import { gmailAccount } from '@/db/schema/index';

export const dynamic = 'force-dynamic';

export async function GET() {
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
