import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { leadList, lead } from '@/db/schema/index';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const { id } = await params;
  const db = getDb();
  const [list] = await db.select().from(leadList).where(eq(leadList.id, id));
  if (!list) return Response.json({ error: 'not_found' }, { status: 404 });

  const [sample, [count]] = await Promise.all([
    db.select().from(lead).where(eq(lead.listId, list.id)).limit(3),
    db.select({ c: sql<number>`count(*)::int` }).from(lead).where(eq(lead.listId, list.id)),
  ]);
  return Response.json({
    id: list.id,
    name: list.name,
    fields: list.headers,
    leadCount: count?.c ?? 0,
    sample: sample.map((l) => l.fields),
  });
}
