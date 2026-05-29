/**
 * Next runs `register()` once per server start. We use it to boot the in-process
 * drip sender + reply-sync workers so `npm run dev` is all you need — no separate
 * worker process. Guarded against (a) the edge runtime and (b) dev hot-reload
 * re-invoking register and stacking duplicate intervals.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const g = globalThis as typeof globalThis & { __coldmailWorkers?: boolean };
  if (g.__coldmailWorkers) return;
  g.__coldmailWorkers = true;

  try {
    const { getDb } = await import('@/db/index');
    const { getEnv } = await import('@/lib/env');
    const { consoleLogger } = await import('@/lib/worker-host');
    const { startSender } = await import('@/services/sender');
    const { startReplySync } = await import('@/services/reply-sync');

    const host = { db: getDb(), env: getEnv(), log: consoleLogger() };
    startSender(host);
    startReplySync(host);
    console.log('[coldmail] background workers started');
  } catch (err) {
    // Don't crash the server if env/DB isn't ready yet — log and carry on.
    console.error('[coldmail] workers not started:', err);
  }
}
