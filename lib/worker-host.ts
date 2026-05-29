import type { Db } from '@/db/index';
import type { Env } from '@/lib/env';

/**
 * Minimal context the background workers need, replacing the Fastify instance
 * they used to hang off. `log` is pino-shaped (object, msg) so the worker call
 * sites are unchanged; a console-backed logger satisfies it.
 */
export interface WorkerHost {
  db: Db;
  env: Env;
  log: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
}

export function consoleLogger(): WorkerHost['log'] {
  // Pino-shaped: usually (obj, msg). When called with just a string message
  // (e.g. log.info('sender started')), print it as the message, not in the
  // object slot.
  const line =
    (label: string, method: 'log' | 'warn' | 'error') => (obj: unknown, msg?: string) =>
      msg === undefined && typeof obj === 'string'
        ? console[method](`[${label}]`, obj)
        : console[method](`[${label}]`, msg ?? '', obj);
  return { info: line('info', 'log'), warn: line('warn', 'warn'), error: line('error', 'error') };
}
