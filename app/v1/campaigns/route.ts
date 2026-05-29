import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { campaign, leadList } from '@/db/schema/index';
import { referencedFields } from '@/lib/template';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const rows = await getDb().select().from(campaign);
  return Response.json({ campaigns: rows });
}

export async function POST(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    listId?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
  } | null;
  if (!body?.name || !body.listId || !body.subjectTemplate || !body.bodyTemplate) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const db = getDb();
  const [list] = await db.select().from(leadList).where(eq(leadList.id, body.listId));
  if (!list) return Response.json({ error: 'unknown_list' }, { status: 400 });

  // Warn (don't block) on template fields the list doesn't have.
  const used = [
    ...new Set([
      ...referencedFields(body.subjectTemplate),
      ...referencedFields(body.bodyTemplate),
    ]),
  ];
  const unknownFields = used.filter((f) => !list.headers.includes(f));

  const [c] = await db
    .insert(campaign)
    .values({
      name: body.name,
      listId: body.listId,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
    })
    .returning();
  return Response.json({ id: c!.id, status: c!.status, unknownFields }, { status: 201 });
}
