import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { recipient, emailEvent } from '@/db/schema/index';

export const dynamic = 'force-dynamic';

// 1x1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

/**
 * Open pixel. Records an open (fire-and-forget) and always returns the gif.
 * Caveat: Gmail image-proxy caching + Apple Mail Privacy Protection inflate
 * opens; image blockers miss them. Directional signal, not truth.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.gif$/i, '');
  void recordOpen(token, req.headers.get('user-agent'));

  return new Response(new Uint8Array(PIXEL), {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  });
}

async function recordOpen(token: string, ua: string | null): Promise<void> {
  try {
    const db = getDb();
    const [r] = await db.select().from(recipient).where(eq(recipient.trackToken, token));
    if (!r) return;
    await db.insert(emailEvent).values({
      recipientId: r.id,
      campaignId: r.campaignId,
      type: 'open',
      meta: { ua },
    });
    await db
      .update(recipient)
      .set({ openedAt: new Date() })
      .where(and(eq(recipient.id, r.id), isNull(recipient.openedAt)));
  } catch (err) {
    console.warn('[track] failed to record open', token, err);
  }
}
