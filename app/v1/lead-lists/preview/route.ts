import { normalizeKey } from '@/lib/template';
import { parseCsv, detectEmailHeader, isValidEmail } from '@/lib/csv';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Inspect a CSV before import: returns its columns (original name + the
 * merge-field key they'd become), the auto-detected email column, and how many
 * rows are missing a valid email (those get skipped at import). No DB writes.
 */
export async function POST(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });

  let parsed;
  try {
    parsed = parseCsv(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return Response.json({ error: 'csv_parse_failed', detail: String(e) }, { status: 400 });
  }
  if (parsed.rows.length === 0) return Response.json({ error: 'empty_csv' }, { status: 400 });

  const { originalHeaders, rows } = parsed;
  const emailHeader = detectEmailHeader(originalHeaders);

  // Count + sample the rows that would be skipped (no valid email).
  const noEmail: string[] = [];
  if (emailHeader) {
    rows.forEach((row, i) => {
      if (!isValidEmail(row[emailHeader]?.trim())) {
        // Identify by name/first-non-empty so the user knows who's dropped.
        const label =
          [row['First Name'], row['Last Name']].filter(Boolean).join(' ').trim() ||
          originalHeaders.map((h) => row[h]).find((v) => v && v.trim()) ||
          `Row ${i + 2}`;
        noEmail.push(label);
      }
    });
  }

  return Response.json({
    rowCount: rows.length,
    columns: originalHeaders.map((h) => ({ original: h, key: normalizeKey(h) })),
    detectedEmailHeader: emailHeader,
    withoutEmail: emailHeader ? noEmail.length : rows.length,
    withEmail: emailHeader ? rows.length - noEmail.length : 0,
    noEmailSample: noEmail.slice(0, 10),
    sample: rows.slice(0, 3),
  });
}
