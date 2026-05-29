import type { Db } from '@/db/index';
import { schedulerConfig } from '@/db/schema/index';
import { withinWindow } from '@/lib/time';

export type SchedulerConfig = typeof schedulerConfig.$inferSelect;

/** Whether the scheduler would send right now (enabled AND inside the window). */
export function schedulerOpenNow(cfg: SchedulerConfig): boolean {
  return cfg.enabled && withinWindow(cfg.windowStart, cfg.windowEnd, cfg.timezone);
}

/**
 * Read the singleton scheduler row, inserting the default row on first use.
 * Both the API and the sender call this, so they always agree on the active
 * policy without a separate seed step.
 */
export async function getSchedulerConfig(db: Db): Promise<SchedulerConfig> {
  const existing = await db.select().from(schedulerConfig).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(schedulerConfig).values({}).returning();
  return created!;
}
