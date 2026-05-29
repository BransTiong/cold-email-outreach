import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * A named CSV/sheet upload. `headers` preserves the column order from the
 * file so the UI can show available {{merge_fields}} in the same order the
 * user provided them.
 */
export const leadList = pgTable('lead_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Normalised header keys in file order, e.g. ["firstName","lastName","email"].
  headers: jsonb('headers').$type<string[]>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * One row per CSV row. The arbitrary columns are kept verbatim in `fields`
 * (JSONB) keyed by normalised header — this is what the template engine
 * reads for {{firstName}} etc. `email` is hoisted out as a real column
 * because we index + dedupe on it.
 */
export const lead = pgTable(
  'lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => leadList.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // All columns from the row, including a duplicate of email. Values are
    // strings as they came from the CSV.
    fields: jsonb('fields').$type<Record<string, string>>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('lead_list_id_idx').on(t.listId)],
);
