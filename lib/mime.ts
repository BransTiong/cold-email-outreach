/**
 * Builds an RFC 822 message, base64url-encoded for the Gmail API's
 * `users.messages.send` `raw` field. Produces a multipart/alternative with
 * a plaintext part (derived from the HTML) and the HTML part, and injects:
 *   - a 1x1 open-tracking pixel
 *   - an unsubscribe footer + List-Unsubscribe headers (CAN-SPAM hygiene)
 */

export interface BuildMessageArgs {
  fromName: string | null;
  fromEmail: string;
  to: string;
  subject: string;
  html: string;
  baseUrl: string;
  trackToken: string;
}

/** RFC 2047 encode a header value if it contains non-ASCII chars. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildRawMessage(args: BuildMessageArgs): string {
  const { fromName, fromEmail, to, subject, html: bodyHtml, baseUrl, trackToken } = args;

  // Cold 1:1 outreach: no visible unsubscribe footer and no List-Unsubscribe
  // header — those make a message read as bulk/newsletter and hurt the personal
  // feel + deliverability. Opt-out is reply-based. (The /t/u route still exists
  // if you ever want to re-enable a one-click unsubscribe.) The open pixel stays.
  const pixel = `<img src="${baseUrl}/t/o/${trackToken}.gif" width="1" height="1" alt="" style="display:none" />`;
  const html = `${bodyHtml}${pixel}`;
  const text = htmlToText(bodyHtml);

  const from = fromName ? `${encodeHeader(fromName)} <${fromEmail}>` : fromEmail;
  const boundary = `b_${trackToken}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n');

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    `--${boundary}--`,
  ].join('\r\n');

  const raw = `${headers}\r\n\r\n${body}`;
  // Gmail API wants base64url (RFC 4648 §5), no padding issues.
  return Buffer.from(raw, 'utf8').toString('base64url');
}
