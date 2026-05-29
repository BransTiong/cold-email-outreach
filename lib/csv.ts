import { parse } from 'csv-parse/sync';
import { normalizeKey } from '@/lib/template';

export interface ParsedCsv {
  originalHeaders: string[];
  rows: Record<string, string>[];
}

/** Parse a CSV buffer into header-keyed row objects. */
export function parseCsv(buf: Buffer): ParsedCsv {
  const rows = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  const originalHeaders = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return { originalHeaders, rows };
}

/** Best-guess the email column: exact "email" wins, else first containing mail. */
export function detectEmailHeader(originalHeaders: string[]): string | null {
  const keys = originalHeaders.map(normalizeKey);
  let idx = keys.indexOf('email');
  if (idx === -1) idx = keys.findIndex((k) => k.includes('email') || k.includes('mail'));
  return idx === -1 ? null : originalHeaders[idx]!;
}

export function isValidEmail(v: string | undefined | null): boolean {
  return Boolean(v && v.includes('@') && v.includes('.'));
}
