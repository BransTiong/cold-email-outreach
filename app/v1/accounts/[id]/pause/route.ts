import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { gmailAccount } from '@/db/schema/index';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean };
  const status = body.paused ? 'paused' : 'active';
  const updated = await getDb()
    .update(gmailAccount)
    .set({ status })
    .where(eq(gmailAccount.id, id))
    .returning({ id: gmailAccount.id });
  if (updated.length === 0) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ id, status });
}
