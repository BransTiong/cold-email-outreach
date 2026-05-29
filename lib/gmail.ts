import type { OAuth2Client } from 'google-auth-library';

/**
 * Thin wrapper over the Gmail REST API using an OAuth2Client. We call REST
 * endpoints via `client.request` rather than pulling in the full `googleapis`
 * package — the client auto-attaches a fresh access token and refreshes on
 * 401, so callers never touch access tokens.
 */

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface SentMessage {
  id: string;
  threadId: string;
}

/** Send a pre-built base64url RFC822 message. Returns Gmail's ids. */
export async function sendRaw(
  client: OAuth2Client,
  rawBase64Url: string,
): Promise<SentMessage> {
  const res = await client.request<{ id: string; threadId: string }>({
    url: `${API}/messages/send`,
    method: 'POST',
    data: { raw: rawBase64Url },
  });
  return { id: res.data.id, threadId: res.data.threadId };
}

interface ThreadMessage {
  id: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
  internalDate?: string;
  snippet?: string;
}

/**
 * Fetch a thread and detect whether the recipient replied. A reply is any
 * message in the thread NOT sent by us (no SENT label / From != our address).
 * Returns the first such message, or null.
 */
export async function findReplyInThread(
  client: OAuth2Client,
  threadId: string,
  ourEmail: string,
): Promise<{ snippet: string; at: Date } | null> {
  const res = await client.request<{ messages?: ThreadMessage[] }>({
    url: `${API}/threads/${threadId}?format=metadata&metadataHeaders=From`,
  });
  const messages = res.data.messages ?? [];
  const ours = ourEmail.toLowerCase();
  for (const m of messages) {
    const isSent = m.labelIds?.includes('SENT');
    const from = m.payload?.headers?.find((h) => h.name === 'From')?.value ?? '';
    // Compare the actual mailbox address, not a substring — a `From` of
    // "Acme <info@acme.com>" must not match our "jo@acme.com" by coincidence,
    // and a reply address that merely contains our address shouldn't be
    // misread as sent-by-us.
    const fromAddr = (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
    const fromUs = fromAddr === ours;
    if (!isSent && !fromUs) {
      const at = m.internalDate ? new Date(Number(m.internalDate)) : new Date();
      return { snippet: m.snippet ?? '', at };
    }
  }
  return null;
}

export type Placement = 'inbox' | 'spam' | 'promotions' | 'unknown';

/**
 * Look up where a message landed in a (seed) Gmail mailbox by its labels.
 * Used by spam-placement seed testing. Searches the mailbox for a message
 * matching `query` (e.g. a unique subject) and maps its labels to a bucket.
 */
export async function placementForQuery(
  client: OAuth2Client,
  query: string,
): Promise<Placement> {
  const list = await client.request<{ messages?: { id: string }[] }>({
    url: `${API}/messages?q=${encodeURIComponent(query)}&maxResults=1&includeSpamTrash=true`,
  });
  const id = list.data.messages?.[0]?.id;
  if (!id) return 'unknown';
  const msg = await client.request<ThreadMessage>({
    url: `${API}/messages/${id}?format=minimal`,
  });
  const labels = msg.data.labelIds ?? [];
  if (labels.includes('SPAM')) return 'spam';
  if (labels.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  if (labels.includes('INBOX')) return 'inbox';
  return 'unknown';
}
