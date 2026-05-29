/**
 * {{merge_field}} templating against a lead's row.
 *
 * Field matching is forgiving: a CSV header "First Name", "first_name" and a
 * template token {{firstName}} all normalise to the same key `firstname`, so
 * users don't have to match the sheet's exact casing/spacing. Use
 * `normalizeKey` both when ingesting CSV headers and when resolving tokens.
 */

export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Every distinct field name referenced by a template, normalised. */
export function referencedFields(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(TOKEN_RE)) out.add(normalizeKey(m[1]!));
  return [...out];
}

/**
 * Render a template against a lead's normalised `fields` map. A token with
 * no matching field is replaced with `fallback` (default empty string) and
 * its normalised name is collected into `missing` so the caller can decide
 * whether to skip the lead (e.g. don't email "Hi  ," with a blank name).
 */
export function render(
  template: string,
  fields: Record<string, string>,
  fallback = '',
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = template.replace(TOKEN_RE, (_full, name: string) => {
    const key = normalizeKey(name);
    const val = fields[key];
    if (val === undefined || val === '') {
      missing.push(key);
      return fallback;
    }
    return val;
  });
  return { text, missing };
}
