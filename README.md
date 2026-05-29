# coldmail

Multi-account Gmail cold-email console — a single **Next.js** app (frontend +
API + background workers) you run locally. Upload a CSV lead list, write a
`{{firstName}}`-templated message, drip it across connected Gmail accounts, and
track **sent / opened / replied** plus a seed-based **spam-placement** estimate.

The API surface and tracking URLs are unchanged from the original Fastify
service (`/v1/...`, `/t/...`), so an existing Google OAuth redirect URI keeps
working. The drip **sender** and **reply-sync** workers start automatically with
the dev server via Next's `instrumentation.ts` — no separate process.

## Run it locally

```bash
# 1. Postgres (any local instance). One-time:
createdb coldmail            # or a docker postgres

# 2. Config — a .env.local is already created with a TOKEN_ENCRYPTION_KEY.
#    Edit DATABASE_URL if needed and fill GOOGLE_* once you have an OAuth client.

# 3. Schema + run
npm run db:migrate
npm run dev                  # → http://localhost:5050
```

Open `http://localhost:5050`:
- **Accounts** → "Connect Gmail" (OAuth consent) — connect one or more inboxes
- **Leads** → upload a CSV (email column auto-detected; other columns become merge fields)
- **New campaign** → pick a list, write subject/body with `{{fields}}`, create → **Launch**
- **Scheduler** → hourly/daily caps, random inter-email interval, send window + timezone
- **Dashboard** → live funnel per campaign

### Open tracking + OAuth need a public URL
The open pixel and Google's redirect must be reachable from outside localhost.
For real Gmail use, run `ngrok http 5050` and set `PUBLIC_BASE_URL` +
`GOOGLE_REDIRECT_URI` to the ngrok URL (and add that redirect URI to your OAuth
client). Plain `localhost` is fine for clicking through the UI, but opens won't
register and Google won't redirect back.

## Google OAuth setup
Cloud Console → enable **Gmail API** → **OAuth client ID** (Web application).
Consent-screen scopes: `gmail.send`, `gmail.readonly`, `userinfo.email`; add your
sending address as a **test user**. Put the client id/secret in `.env.local`.
> Restricted scopes need Google verification beyond a few test users, and
> testing-mode refresh tokens expire after 7 days.

## Layout
```
app/
  page.tsx, accounts/, leads/, campaigns/new, campaigns/[id], scheduler/   ← UI
  v1/...                         ← JSON API (accounts, lead-lists, campaigns, scheduler, seeds)
  t/o/[token], t/u/[token]       ← open pixel + unsubscribe (public)
db/schema/                       ← Drizzle tables (8 + scheduler_config)
lib/                             ← crypto, google-oauth, gmail, mime, template, time, scheduler-config
services/sender.ts, reply-sync.ts ← workers, started by instrumentation.ts
```

## Notes / intentional gaps
- **No auth on the app yet** — local use only; add an auth layer before exposing.
- In-process workers + in-memory OAuth state/cooldown → run a single instance.
- Per-inbox daily ceiling is `DAILY_LIMIT_PER_ACCOUNT` (env); the global caps,
  interval, window and timezone are edited in the UI and stored in the DB.
