import type { WorkerHost } from '@/lib/worker-host';
import { eq, gte, sql } from 'drizzle-orm';
import {
  gmailAccount,
  campaign,
  recipient,
  lead,
  emailEvent,
} from '@/db/schema/index';
import { clientForAccount } from '@/lib/google-oauth';
import { sendRaw, type SentMessage } from '@/lib/gmail';
import { buildRawMessage } from '@/lib/mime';
import { render } from '@/lib/template';
import { getSchedulerConfig } from '@/lib/scheduler-config';
import { withinWindow, localMidnightUtc } from '@/lib/time';

/**
 * In-process drip sender, governed by the global scheduler (scheduler_config).
 * Each eligible tick sends AT MOST ONE email, then arms a random global
 * cooldown — that single paced stream is what "a random interval between
 * every email" means. Gating order per tick:
 *
 *   1. scheduler enabled?                       2. inside the send window (tz)?
 *   3. global cooldown elapsed?                 4. under hourly cap (rolling 60m)?
 *   5. under daily cap (since local midnight)?  6. an account under its own
 *                                                  daily ceiling is available?
 *   7. a queued recipient to claim?             → send, then arm cooldown.
 *
 * The global cooldown clock is in-memory (resets to "ready" on restart) —
 * single-process only.
 */
let globalNextAllowedAt = 0;

/**
 * Delivery seam. The default builds an OAuth client from the account's stored
 * token and sends via the Gmail API. Tests inject a fake to drive the full
 * loop against a real DB without any network; it's also the natural swap
 * point for an alternative transport (e.g. SMTP) later.
 */
export interface SenderDeps {
  deliver: (acct: typeof gmailAccount.$inferSelect, rawBase64Url: string) => Promise<SentMessage>;
}

const defaultDeps: SenderDeps = {
  deliver: (acct, raw) => sendRaw(clientForAccount(acct), raw),
};

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Reset the in-memory cooldown clock — used by tests to force eligibility. */
export function resetCooldown(): void {
  globalNextAllowedAt = 0;
}

export function startSender(app: WorkerHost, deps: SenderDeps = defaultDeps): () => void {
  const tickMs = 5_000;
  let running = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (running || stopped) return;
    running = true;
    try {
      await runOnce(app, deps);
    } catch (err) {
      app.log.error({ err }, 'sender tick failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), tickMs);
  timer.unref();
  app.log.info('sender started');
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * One scheduler-gated pass: sends at most one email. Exported for tests so the
 * full loop can run deterministically against a real DB with an injected
 * `deps.deliver`. Returns the recipient id it sent to, or null if it idled.
 */
export async function runOnce(
  app: WorkerHost,
  deps: SenderDeps = defaultDeps,
): Promise<string | null> {
  const cfg = await getSchedulerConfig(app.db);
  if (!cfg.enabled) return null;

  // (2) Send window — only mail during the configured local-time hours.
  if (!withinWindow(cfg.windowStart, cfg.windowEnd, cfg.timezone)) return null;

  // (3) Global inter-email cooldown.
  const now = Date.now();
  if (globalNextAllowedAt > now) return null;

  // (4) Rolling-hour cap.
  const hourCount = await countSentSince(app, new Date(now - 60 * 60 * 1000));
  if (hourCount >= cfg.hourlyMax) return null;

  // (5) Daily cap, reset at local midnight in the configured timezone.
  const dayCount = await countSentSince(app, localMidnightUtc(cfg.timezone));
  if (dayCount >= cfg.dailyMax) return null;

  // (6) Pick a sending account still under its per-inbox daily ceiling.
  const today = utcDateString();
  const picked = await pickAccount(app, today);
  if (!picked) return null;

  // (7) Claim one due recipient. If none, don't arm the cooldown.
  const rcpt = await claimRecipient(app);
  if (!rcpt) return null;

  await sendToRecipient(app, picked.acct, rcpt, today, picked.sentToday, deps);

  // Arm the next global send time.
  const delaySec =
    cfg.minIntervalSeconds + Math.random() * (cfg.maxIntervalSeconds - cfg.minIntervalSeconds);
  globalNextAllowedAt = Date.now() + delaySec * 1000;
  return rcpt.id;
}

/** Count emails sent (recipient.sentAt) at or after `since`. */
async function countSentSince(app: WorkerHost, since: Date): Promise<number> {
  const rows = await app.db
    .select({ c: sql<number>`count(*)::int` })
    .from(recipient)
    .where(gte(recipient.sentAt, since));
  return rows[0]?.c ?? 0;
}

/**
 * Least-recently-used active account that's still under DAILY_LIMIT_PER_ACCOUNT
 * today. Returns the account plus its (date-rolled) count so the send path can
 * increment it. null when every account is paused/revoked or maxed out.
 */
async function pickAccount(
  app: WorkerHost,
  today: string,
): Promise<{ acct: typeof gmailAccount.$inferSelect; sentToday: number } | null> {
  const accounts = await app.db
    .select()
    .from(gmailAccount)
    .where(eq(gmailAccount.status, 'active'))
    .orderBy(sql`${gmailAccount.lastSentAt} asc nulls first`);

  const limit = app.env.DAILY_LIMIT_PER_ACCOUNT;
  for (const acct of accounts) {
    const sentToday = acct.sentDateUtc === today ? acct.sentToday : 0;
    if (sentToday < limit) return { acct, sentToday };
  }
  return null;
}

/**
 * Atomically claim one due, queued recipient whose campaign is still
 * 'sending'. FOR UPDATE SKIP LOCKED keeps it safe under concurrency.
 */
async function claimRecipient(
  app: WorkerHost,
): Promise<typeof recipient.$inferSelect | undefined> {
  // Raw execute returns DRIVER-shaped rows (snake_case keys), so we only read
  // the claimed id from it, then re-select through Drizzle to get a correctly
  // typed/camel-cased row the rest of the sender can use.
  const claimed = await app.db.execute(sql`
    update recipient set status = 'sending'
    where id = (
      select r.id from recipient r
      join campaign c on c.id = r.campaign_id
      where r.status = 'queued'
        and (r.scheduled_at is null or r.scheduled_at <= now())
        and c.status = 'sending'
      order by r.scheduled_at asc
      for update skip locked
      limit 1
    )
    returning id
  `);
  const id = (claimed as unknown as { id: string }[])[0]?.id;
  if (!id) return undefined;
  const [row] = await app.db.select().from(recipient).where(eq(recipient.id, id));
  return row;
}

async function sendToRecipient(
  app: WorkerHost,
  acct: typeof gmailAccount.$inferSelect,
  rcpt: typeof recipient.$inferSelect,
  today: string,
  sentToday: number,
  deps: SenderDeps,
): Promise<void> {
  try {
    const [[c], [l]] = await Promise.all([
      app.db.select().from(campaign).where(eq(campaign.id, rcpt.campaignId)),
      app.db.select().from(lead).where(eq(lead.id, rcpt.leadId)),
    ]);
    if (!c || !l) throw new Error('campaign or lead missing');

    const subject = render(c.subjectTemplate, l.fields).text;
    const body = render(c.bodyTemplate, l.fields).text;

    const raw = buildRawMessage({
      fromName: acct.displayName,
      fromEmail: acct.email,
      to: rcpt.email,
      subject,
      html: body,
      baseUrl: app.env.PUBLIC_BASE_URL,
      trackToken: rcpt.trackToken,
    });

    const sent = await deps.deliver(acct, raw);

    await app.db
      .update(recipient)
      .set({
        status: 'sent',
        accountId: acct.id,
        sentAt: new Date(),
        gmailMessageId: sent.id,
        gmailThreadId: sent.threadId,
      })
      .where(eq(recipient.id, rcpt.id));

    await app.db
      .update(gmailAccount)
      .set({ sentToday: sentToday + 1, sentDateUtc: today, lastSentAt: new Date() })
      .where(eq(gmailAccount.id, acct.id));

    await app.db.insert(emailEvent).values({
      recipientId: rcpt.id,
      campaignId: rcpt.campaignId,
      type: 'sent',
      meta: { accountEmail: acct.email, gmailMessageId: sent.id },
    });

    app.log.info({ to: rcpt.email, from: acct.email }, 'sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    app.log.error({ err, to: rcpt.email }, 'send failed');
    // Mark failed (not re-queued) so a bad address doesn't loop forever.
    await app.db
      .update(recipient)
      .set({ status: 'failed', lastError: msg.slice(0, 500) })
      .where(eq(recipient.id, rcpt.id));
    await app.db.insert(emailEvent).values({
      recipientId: rcpt.id,
      campaignId: rcpt.campaignId,
      type: 'failed',
      meta: { error: msg.slice(0, 500) },
    });
    // A revoked token disables the account so we stop hammering it.
    if (/invalid_grant|unauthorized|invalid_token/i.test(msg)) {
      await app.db
        .update(gmailAccount)
        .set({ status: 'revoked' })
        .where(eq(gmailAccount.id, acct.id));
    }
  }
}
