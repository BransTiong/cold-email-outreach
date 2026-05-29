import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { campaign } from '@/db/schema/index';
import { campaignStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [c] = await db.select().from(campaign).where(eq(campaign.id, id));
  if (!c) return Response.json({ error: 'not_found' }, { status: 404 });

  const stats = await campaignStats(db, c.id);
  return Response.json({ id: c.id, name: c.name, status: c.status, ...stats });
}
