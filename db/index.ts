import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index';

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Lazy singleton DB. Built on first use, not at import time, so `next build`
 * (which imports route modules to collect config) doesn't try to open a
 * connection without DATABASE_URL. idle_timeout closes sockets before a
 * pooler reaps them; max_lifetime recycles long-lived connections.
 */
let _pg: ReturnType<typeof postgres> | undefined;
let _db: Db | undefined;

export function getPg(): ReturnType<typeof postgres> {
  if (!_pg) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    _pg = postgres(url, { idle_timeout: 20, max_lifetime: 60 * 30 });
  }
  return _pg;
}

export function getDb(): Db {
  if (!_db) _db = drizzle(getPg(), { schema });
  return _db;
}
