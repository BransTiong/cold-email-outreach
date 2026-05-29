import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { campaign } from '@/db/schema/index';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean };
  const status = body.paused ? 'paused' : 'sending';
  const updated = await getDb()
    .update(campaign)
    .set({ status })
    .where(eq(campaign.id, id))
    .returning({ id: campaign.id });
  if (updated.length === 0) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ id, status });
}
