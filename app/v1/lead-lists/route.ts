import { getDb } from '@/db/index';
import { leadList, lead } from '@/db/schema/index';
import { normalizeKey } from '@/lib/template';
import { parseCsv, detectEmailHeader, isValidEmail } from '@/lib/csv';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Import a CSV into a lead list.
 * Form fields:
 *  - file        the CSV
 *  - name        list name
 *  - columns     JSON array of ORIGINAL header names to import (optional → all)
 *  - emailColumn the ORIGINAL header to treat as email (optional → auto-detect)
 *
 * Behavior: only the selected columns are stored (keyed by merge-field key);
 * empty cells become null; rows with no valid email are skipped and reported.
 */
export async function POST(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: 'expected_multipart_form' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });
  const listName = String(form.get('name') ?? file.name ?? 'Untitled list');

  let parsed;
  try {
    parsed = parseCsv(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return Response.json({ error: 'csv_parse_failed', detail: String(e) }, { status: 400 });
  }
  if (parsed.rows.length === 0) return Response.json({ error: 'empty_csv' }, { status: 400 });
  const { originalHeaders, rows } = parsed;

  // Which column is the email.
  const emailColumn = (form.get('emailColumn') as string | null) || detectEmailHeader(originalHeaders);
  if (!emailColumn || !originalHeaders.includes(emailColumn)) {
    return Response.json({ error: 'no_email_column', headers: originalHeaders }, { status: 400 });
  }

  // Which columns to import (default: all). The email column is always kept.
  let selected: string[];
  const raw = form.get('columns');
  if (typeof raw === 'string' && raw.trim()) {
    try {
      selected = (JSON.parse(raw) as string[]).filter((h) => originalHeaders.includes(h));
    } catch {
      return Response.json({ error: 'bad_columns_json' }, { status: 400 });
    }
  } else {
    selected = originalHeaders;
  }
  if (!selected.includes(emailColumn)) selected = [emailColumn, ...selected];
  const headerKeys = [...new Set(selected.map(normalizeKey))];

  const db = getDb();
  const [list] = await db.insert(leadList).values({ name: listName, headers: headerKeys }).returning();

  const toInsert: (typeof lead.$inferInsert)[] = [];
  const skippedRows: string[] = [];
  rows.forEach((row, i) => {
    const email = (row[emailColumn] ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      skippedRows.push(
        [row['First Name'], row['Last Name']].filter(Boolean).join(' ').trim() ||
          selected.map((h) => row[h]).find((v) => v && v.trim()) ||
          `Row ${i + 2}`,
      );
      return;
    }
    const fields: Record<string, string | null> = {};
    for (const orig of selected) {
      const v = (row[orig] ?? '').trim();
      fields[normalizeKey(orig)] = v === '' ? null : v; // empty cell → null
    }
    toInsert.push({ listId: list!.id, email, fields });
  });
  if (toInsert.length > 0) await db.insert(lead).values(toInsert);

  return Response.json(
    {
      id: list!.id,
      name: list!.name,
      fields: headerKeys,
      imported: toInsert.length,
      skipped: skippedRows.length,
      skippedSample: skippedRows.slice(0, 25),
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const lists = await getDb().select().from(leadList);
  return Response.json({ lists });
}
