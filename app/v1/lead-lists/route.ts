import { parse } from 'csv-parse/sync';
import { getDb } from '@/db/index';
import { leadList, lead } from '@/db/schema/index';
import { normalizeKey } from '@/lib/template';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: 'expected_multipart_form' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });
  const listName = String(form.get('name') ?? file.name ?? 'Untitled list');

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Record<string, string>[];
  try {
    rows = parse(buf, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (e) {
    return Response.json({ error: 'csv_parse_failed', detail: String(e) }, { status: 400 });
  }
  if (rows.length === 0) return Response.json({ error: 'empty_csv' }, { status: 400 });

  const originalHeaders = Object.keys(rows[0]!);
  const headers = originalHeaders.map(normalizeKey);

  // Locate the email column: exact 'email' wins, else first containing mail.
  const emailIdx =
    headers.indexOf('email') !== -1
      ? headers.indexOf('email')
      : headers.findIndex((h) => h.includes('email') || h.includes('mail'));
  if (emailIdx === -1) {
    return Response.json({ error: 'no_email_column', headers: originalHeaders }, { status: 400 });
  }
  const emailHeaderOriginal = originalHeaders[emailIdx]!;

  const db = getDb();
  const [list] = await db.insert(leadList).values({ name: listName, headers }).returning();

  const toInsert: (typeof lead.$inferInsert)[] = [];
  let skipped = 0;
  for (const row of rows) {
    const email = (row[emailHeaderOriginal] ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      skipped++;
      continue;
    }
    const fields: Record<string, string> = {};
    for (const orig of originalHeaders) fields[normalizeKey(orig)] = row[orig] ?? '';
    toInsert.push({ listId: list!.id, email, fields });
  }
  if (toInsert.length > 0) await db.insert(lead).values(toInsert);

  return Response.json(
    { id: list!.id, name: list!.name, fields: headers, imported: toInsert.length, skipped },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const lists = await getDb().select().from(leadList);
  return Response.json({ lists });
}
