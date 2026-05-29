import { pgTable, uuid, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Global send scheduler — a single row governs the whole sending operation
 * (all accounts combined). Per-inbox protection still comes from the
 * DAILY_LIMIT_PER_ACCOUNT env ceiling; this shapes the aggregate flow:
 *
 *   - hourlyMax  : max emails sent in any rolling 60-minute window
 *   - dailyMax   : max emails sent per calendar day (resets at local midnight)
 *   - min/maxIntervalSeconds : random gap enforced between any two sends
 *   - windowStart/windowEnd  : "HH:MM" local clock window sends are allowed in
 *   - timezone   : IANA tz (e.g. "America/New_York") the window + daily reset
 *                  are evaluated in
 *
 * Singleton: the sender + API read/write the one row (seeded on first read).
 */
export const schedulerConfig = pgTable('scheduler_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  enabled: boolean('enabled').notNull().default(true),
  hourlyMax: integer('hourly_max').notNull().default(20),
  dailyMax: integer('daily_max').notNull().default(100),
  minIntervalSeconds: integer('min_interval_seconds').notNull().default(45),
  maxIntervalSeconds: integer('max_interval_seconds').notNull().default(120),
  windowStart: text('window_start').notNull().default('09:00'),
  windowEnd: text('window_end').notNull().default('17:00'),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
