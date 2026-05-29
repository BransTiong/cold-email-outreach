import type { WorkerHost } from '@/lib/worker-host';
import { and, eq, isNull, isNotNull, gte } from 'drizzle-orm';
import { recipient, gmailAccount, emailEvent } from '@/db/schema/index';
import { clientForAccount } from '@/lib/google-oauth';
import { findReplyInThread } from '@/lib/gmail';

/**
 * Polls sent-but-not-yet-replied recipients and checks their Gmail thread
 * for an inbound reply, using the same account the message was sent from.
 *
 * Polling (vs. Gmail Pub/Sub push) keeps the service self-contained — no
 * Google Cloud Pub/Sub topic + watch renewal to operate. Trade-off: replies
 * surface within one poll interval, not instantly. For higher volume, switch
 * to users.watch + a /webhooks/gmail receiver.
 */
export function startReplySync(app: WorkerHost): () => void {
  const tickMs = 60_000;
  let running = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (running || stopped) return;
    running = true;
    try {
      await runOnce(app);
    } catch (err) {
      app.log.error({ err }, 'reply-sync tick failed');
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), tickMs);
  timer.unref();
  app.log.info('reply-sync started');
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function runOnce(app: WorkerHost): Promise<void> {
  // Only look at recently-sent, unreplied messages with a known thread +
  // account. 14-day window keeps the polled set bounded.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const pending = await app.db
    .select({
      id: recipient.id,
      campaignId: recipient.campaignId,
      threadId: recipient.gmailThreadId,
      accountId: recipient.accountId,
    })
    .from(recipient)
    .where(
      and(
        eq(recipient.status, 'sent'),
        isNull(recipient.repliedAt),
        isNotNull(recipient.gmailThreadId),
        isNotNull(recipient.accountId),
        gte(recipient.sentAt, since),
      ),
    )
    .limit(50);

  if (pending.length === 0) return;

  // Cache account clients across the batch.
  const clientCache = new Map<
    string,
    { email: string; client: ReturnType<typeof clientForAccount> }
  >();

  for (const p of pending) {
    let entry = clientCache.get(p.accountId!);
    if (!entry) {
      const [acct] = await app.db
        .select()
        .from(gmailAccount)
        .where(eq(gmailAccount.id, p.accountId!));
      if (!acct) continue;
      entry = {
        email: acct.email,
        client: clientForAccount(acct),
      };
      clientCache.set(p.accountId!, entry);
    }

    try {
      const reply = await findReplyInThread(entry.client, p.threadId!, entry.email);
      if (!reply) continue;
      await app.db
        .update(recipient)
        .set({ repliedAt: reply.at })
        .where(eq(recipient.id, p.id));
      await app.db.insert(emailEvent).values({
        recipientId: p.id,
        campaignId: p.campaignId,
        type: 'reply',
        meta: { snippet: reply.snippet },
      });
      app.log.info({ recipientId: p.id }, 'reply detected');
    } catch (err) {
      app.log.warn({ err, recipientId: p.id }, 'reply check failed');
    }
  }
}
