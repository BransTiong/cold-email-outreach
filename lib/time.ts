/**
 * Timezone-aware helpers for the send scheduler. Uses only Intl (no deps).
 *
 * The core trick: to map a wall-clock time in an IANA zone to a UTC instant,
 * we ask Intl what that UTC instant looks like in the zone, diff it against
 * the same fields interpreted as UTC, and that difference is the zone's
 * offset at that instant (DST-correct).
 */

/** Offset (ms) of `tz` from UTC at the given UTC instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  // 'hour' can come back as 24 at midnight on some engines; normalise.
  const hour = parts.hour === 24 ? 0 : parts.hour!;
  const asIfUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    hour,
    parts.minute!,
    parts.second!,
  );
  return asIfUtc - utcMs;
}

/** Current local wall-clock minutes-since-midnight in `tz`. */
export function localMinutesOfDay(tz: string, now: Date = new Date()): number {
  const off = tzOffsetMs(now.getTime(), tz);
  const local = new Date(now.getTime() + off);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** UTC Date of the most recent local-midnight in `tz` (today's day boundary). */
export function localMidnightUtc(tz: string, now: Date = new Date()): Date {
  const off = tzOffsetMs(now.getTime(), tz);
  const local = new Date(now.getTime() + off);
  // Midnight of the local calendar day, expressed as if-UTC...
  const midnightAsIfUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  // ...then convert that wall-clock midnight back to a real UTC instant using
  // the offset *at that midnight* (handles DST shifts across the boundary).
  const provisional = midnightAsIfUtc - off;
  const refinedOff = tzOffsetMs(provisional, tz);
  return new Date(midnightAsIfUtc - refinedOff);
}

/** Parse "HH:MM" → minutes since midnight. Returns null if malformed. */
export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Is `now` within the daily send window [start, end] in `tz`? Supports windows
 * that cross midnight (start > end, e.g. 22:00–06:00).
 */
export function withinWindow(
  startHm: string,
  endHm: string,
  tz: string,
  now: Date = new Date(),
): boolean {
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start === null || end === null) return false;
  const cur = localMinutesOfDay(tz, now);
  if (start === end) return false; // zero-width window = never send
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // wraps past midnight
}

/** True iff `tz` is a valid IANA timezone Intl accepts. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
