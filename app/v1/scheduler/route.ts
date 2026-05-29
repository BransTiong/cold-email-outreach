import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { schedulerConfig } from '@/db/schema/index';
import { getSchedulerConfig, schedulerOpenNow } from '@/lib/scheduler-config';
import { parseHm, isValidTimezone } from '@/lib/time';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

function stripMeta(cfg: typeof schedulerConfig.$inferSelect) {
  const { id: _id, updatedAt, ...rest } = cfg;
  return { ...rest, updatedAt: updatedAt.toISOString() };
}

export async function GET(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const cfg = await getSchedulerConfig(getDb());
  return Response.json({ ...stripMeta(cfg), sendingOpenNow: schedulerOpenNow(cfg) });
}

interface Patch {
  enabled?: boolean;
  hourlyMax?: number;
  dailyMax?: number;
  minIntervalSeconds?: number;
  maxIntervalSeconds?: number;
  windowStart?: string;
  windowEnd?: string;
  timezone?: string;
}

export async function PATCH(req: Request) {
  const unauth = await requireSession(req);
  if (unauth) return unauth;
  const b = (await req.json().catch(() => ({}))) as Patch;

  if (b.windowStart !== undefined && parseHm(b.windowStart) === null) {
    return Response.json({ error: 'bad_window_start', expected: 'HH:MM' }, { status: 400 });
  }
  if (b.windowEnd !== undefined && parseHm(b.windowEnd) === null) {
    return Response.json({ error: 'bad_window_end', expected: 'HH:MM' }, { status: 400 });
  }
  if (b.timezone !== undefined && !isValidTimezone(b.timezone)) {
    return Response.json(
      { error: 'bad_timezone', hint: 'IANA name e.g. America/New_York' },
      { status: 400 },
    );
  }

  // Numeric fields must be real non-negative integers — otherwise a stray
  // string/float/NaN reaches the int columns, and a NaN interval would make
  // the sender's `now + NaN` cooldown never elapse, disabling pacing entirely.
  const intFields = ['hourlyMax', 'dailyMax', 'minIntervalSeconds', 'maxIntervalSeconds'] as const;
  for (const f of intFields) {
    const v = b[f];
    if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < 0)) {
      return Response.json({ error: 'bad_number', field: f }, { status: 400 });
    }
  }

  const db = getDb();
  const current = await getSchedulerConfig(db);
  const merged = { ...current, ...b };
  if (merged.maxIntervalSeconds < merged.minIntervalSeconds) {
    return Response.json({ error: 'max_interval_lt_min_interval' }, { status: 400 });
  }
  if (merged.hourlyMax < 1 || merged.dailyMax < 1 || merged.maxIntervalSeconds < 1) {
    return Response.json({ error: 'out_of_range' }, { status: 400 });
  }

  const [updated] = await db
    .update(schedulerConfig)
    .set({ ...b, updatedAt: new Date() })
    .where(eq(schedulerConfig.id, current.id))
    .returning();
  return Response.json(stripMeta(updated!));
}
