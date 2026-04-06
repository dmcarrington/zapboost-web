# ZapBoost ⚡

Creator analytics for Nostr, powered by Lightning zaps.

ZapBoost ingests NIP-57 zap receipts (kind 9735) from public Nostr relays, persists them to PostgreSQL, and surfaces rich analytics for creators — revenue charts, supporter leaderboards, post performance, and embeddable widgets for third-party clients.

## What's here

- **Public trending feed** (`/`) — real-time sats-per-hour leaderboard across the network
- **Creator dashboard** (`/dashboard`) — NIP-07 authenticated analytics for your own npub: revenue over time, top posts, top supporters, zap-size distribution, hour-of-day heatmap, date range filters
- **Subscriptions** (`/dashboard/settings`) — Free, Creator, and Pro tiers paid via Lightning invoice
- **Public API** (`/api/v1/*`) — API-key authenticated endpoints for stats, leaderboards, and per-pubkey aggregates, with tier-based rate limits
- **Embeddable widget** (`/embed/[pubkey]`) — drop-in iframe analytics card for Nostr clients to embed
- **API docs** (`/docs`) — reference for the public API

## Tech stack

- **Next.js 14** (App Router) — frontend + API routes
- **PostgreSQL** + **Drizzle ORM** — persistent zap store, daily aggregates, users, API keys, subscriptions
- **nostr-tools** — relay subscriptions, NIP-07 auth, NIP-57 zap parsing
- **jose** — JWT sessions after NIP-07 challenge/verify
- **Recharts** — dashboard charts
- **@getalby/sdk** — Alby / NWC wallet integration
- **LNbits** (optional) — real Lightning invoices for subscription billing; simulated in dev

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Set at minimum:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — `openssl rand -base64 32`

Optional (for real Lightning billing):
- `LNBITS_URL`, `LNBITS_API_KEY` — omit to use simulated payments in dev

### 3. Database

```bash
npm run db:push      # apply schema
npm run db:studio    # inspect data (optional)
```

### 4. Run

```bash
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run db:generate`, `npm run db:migrate`.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router)                                 │
│  ─ / (trending feed)      ─ /dashboard (creator UI)      │
│  ─ /docs                  ─ /embed/[pubkey]              │
│  ─ /api/auth/*            ─ /api/stats/* ─ /api/zaps/*   │
│  ─ /api/subscribe/*       ─ /api/v1/*    (public API)    │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │  Ingestion service       │   Nostr relays
    │  (src/lib/ingestion.ts)  │◀──(Damus, Primal,
    │  kind 9735 subscriber    │   nos.lol, nostr.band)
    └────────────┬────────────┘
                 │
         ┌───────┴───────┐
         │  PostgreSQL   │
         │  (Drizzle)    │
         └───────────────┘
```

### Key files

- `src/lib/nostr.ts` — legacy client-side `ZapBoostClient` (powers the public trending feed on `/`)
- `src/lib/nostr-utils.ts` — shared NIP-57 parsing helpers (client + server)
- `src/lib/ingestion.ts` — server-side relay aggregator; writes zaps to Postgres
- `src/lib/db/` — Drizzle schema + connection
- `src/lib/auth.ts`, `src/lib/auth-client.ts` — NIP-07 challenge/verify flow + JWT sessions
- `src/lib/api-auth.ts`, `src/lib/api-keys.ts` — API key issuance and verification for `/api/v1/*`
- `src/lib/billing.ts`, `src/lib/tiers.ts` — subscription tiers, LNbits integration, feature gating
- `src/app/dashboard/` — authenticated creator UI
- `src/components/dashboard/` — charts, leaderboards, stat cards, date picker

## Pricing tiers

| Tier | Price | Target | Features |
|------|-------|--------|----------|
| Free | 0 | Casual creators | Single npub, 7-day history, basic stats |
| Creator | 10,000 sats/mo | Active creators | Full history, supporter analytics, exports, alerts |
| Pro | 50,000 sats/mo | Power users / agencies | Multi-npub, API access, webhooks |
| Platform | Custom | Nostr clients (Primal, Damus, …) | White-label widgets, bulk API, SLA |

See `src/lib/tiers.ts` for the source of truth.

## Public API

API keys are issued via the dashboard settings page and sent as `Authorization: Bearer <key>`.

- `GET /api/v1/stats/:pubkey` — aggregate stats for a pubkey
- `GET /api/v1/leaderboard` — trending creators by zap velocity
- `GET /api/v1/keys` — manage your API keys

See `/docs` for full request/response schemas.

## Embedding

Any Nostr client can embed a creator's analytics card via iframe:

```html
<iframe
  src="https://zapboost.app/embed/<pubkey-hex>"
  width="400"
  height="520"
  style="border:0;border-radius:12px">
</iframe>
```

## Velocity badges (trending feed)

| Badge | Threshold | Color |
|-------|-----------|-------|
| 🔥 | 10k+ sats/hr | Gold |
| ⚡ | 1k+ sats/hr  | Orange |
| 💧 | <1k sats/hr  | Blue |

## Deployment

ZapBoost is designed to run on a **fully free, persistent infrastructure stack** suitable for demo projects and hobby deployments. There is no long-running worker process, no paid database, and no trial-clock to worry about. The recommended topology uses **Neon** for Postgres and **Vercel** for the app + scheduled ingestion.

### Why this stack

The hard constraint for a free-forever deployment is **persistent state**. Most "free" plans either delete databases after 30 days (Render free Postgres) or require a credit card and ongoing credits (Railway, Fly). Long-running worker processes are the other trap — Render Background Workers are paid-only, and holding WebSocket subscriptions open on a free web service doesn't survive auto-sleep.

ZapBoost sidesteps both:

- **Neon's free tier is genuinely persistent.** Projects are never deleted for inactivity; only the compute auto-suspends after ~5 minutes idle and wakes on the next query. Storage is 0.5 GB, more than enough for a demo's zap history.
- **Ingestion is stateless and pull-based.** `src/lib/ingestion.ts` has no long-running process. Each run connects to Nostr relays, queries with a bounded `since` filter, writes to Postgres via `onConflictDoNothing` (so dedup is free), and disconnects. This fits inside a Vercel serverless function and is driven by Vercel Cron.

Net result: Next.js app on Vercel Hobby, DB on Neon, cron on Vercel — all three free, all persistent.

### Infrastructure requirements

| Piece | What it does | Host | Cost |
|-------|--------------|------|------|
| Next.js app | Landing page, dashboard, all `/api/*` routes, `/api/cron/ingest` | **Vercel Hobby** | Free |
| PostgreSQL | Source of truth for users, zaps, posts, subscriptions, API keys, sessions, backfill jobs | **Neon free tier** | Free, persistent |
| Scheduled ingestion | Periodic pull of kind-9735 zap receipts + drain of `backfill_jobs` queue | **Vercel Cron** (built into Vercel Hobby) | Free |

**Verify free-tier terms yourself before committing**, since platform terms change. At the time of writing:

- **Neon Free** — 0.5 GB storage, 1 project, compute auto-suspends when idle, no automatic deletion of inactive projects. https://neon.tech/pricing
- **Vercel Hobby** — free personal use, serverless functions up to 60s (`maxDuration`), Cron Jobs included. Hobby historically limited cron frequency to **once per day**; if you need more frequent ingestion than that, skip ahead to the *Alternative scheduler* section. https://vercel.com/pricing

Required environment variables:

- `DATABASE_URL` — Neon connection string **(required)**
- `JWT_SECRET` — session signing key; generate with `openssl rand -base64 32` **(required)**
- `CRON_SECRET` — shared secret for `/api/cron/ingest`; generate with `openssl rand -base64 32` **(required on Vercel for cron to be authenticated)**
- `LNBITS_URL`, `LNBITS_API_KEY` — optional, enables real Lightning invoices. Without them, subscriptions run in simulated/dev mode.

### Step 1 — Provision Postgres on Neon

1. Sign up at https://neon.tech (GitHub login, no card required).
2. Create a new project. Pick the region closest to your Vercel region (e.g. Frankfurt to match the `fra1` pin in `vercel.json`).
3. From the project dashboard, copy the **connection string** (the pooled variant is fine).

### Step 2 — Run migrations

From your laptop, with the Neon connection string:

```bash
DATABASE_URL="postgres://…neon.tech/…?sslmode=require" npm run db:generate
DATABASE_URL="postgres://…neon.tech/…?sslmode=require" npm run db:migrate
```

This creates all tables including `backfill_jobs`, which `/api/auth/verify` uses to queue historical zap pulls for new signups and `/api/cron/ingest` drains on each tick.

### Step 3 — Deploy to Vercel

1. Import the repo into Vercel (Hobby plan is sufficient). It auto-detects Next.js.
2. Set environment variables in **Project Settings → Environment Variables**:
   - `DATABASE_URL` — Neon connection string
   - `JWT_SECRET` — your generated secret
   - `CRON_SECRET` — your generated cron secret
   - `LNBITS_URL`, `LNBITS_API_KEY` — optional
3. Deploy. The included `vercel.json` pins the region to `fra1`, sets security headers, and registers the cron job (`/api/cron/ingest` on `0 * * * *`).

Vercel will automatically send `Authorization: Bearer $CRON_SECRET` on every cron invocation; the route rejects anything else.

### Step 4 — Verify the cron job

After the first deploy:

1. In the Vercel dashboard, go to **Project → Cron Jobs**. You should see `/api/cron/ingest` registered with the configured schedule.
2. Click **Run** to trigger it manually. The response JSON should look like:
   ```json
   { "ok": true, "recentPulled": 0, "backfillsRun": 0, "backfillsFailed": 0, "skippedNoUsers": true, "durationMs": 1234 }
   ```
   `skippedNoUsers: true` just means no one has signed in yet — expected on a fresh deploy.
3. Sign in on your deployment with a Nostr extension. This inserts a `backfill_jobs` row.
4. Manually trigger the cron again. You should see `backfillsRun: 1` and your dashboard populate with historical zaps. On subsequent scheduled runs, `recentPulled` will increment as new zaps arrive.

### Cron frequency and the Vercel Hobby limit

`vercel.json` ships with `0 * * * *` (hourly), which works on Vercel Hobby if hourly crons are available on the free plan at the time you deploy. Historically Vercel Hobby has limited cron frequency to **once per day**; check your plan's current limit in the Vercel dashboard. Two options:

**Option A — accept the limit.** Change the schedule to `0 0 * * *` (daily). Users will see zaps arrive in batches at most 24h after they happen. Fine for a demo.

**Option B — alternative scheduler (free, no frequency limit).** Disable the Vercel cron entry and use **GitHub Actions** as an external scheduler. Create `.github/workflows/ingest.yml`:

```yaml
name: Ingest zaps
on:
  schedule:
    - cron: '*/10 * * * *'  # every 10 minutes
  workflow_dispatch:
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Hit ingest endpoint
        run: |
          curl -fsS -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://<your-vercel-domain>/api/cron/ingest
```

Add `CRON_SECRET` to the repo's **Settings → Secrets and variables → Actions**, matching the value you set on Vercel. GitHub Actions gives you 2000 free minutes/month on private repos (unlimited on public); a 10-minute ingest schedule that takes ~5 seconds per run uses roughly 4 minutes/month.

### Known limitations

- **NIP-07 auth challenges are stored in process memory** with a 5-minute TTL (`src/lib/auth.ts`). On Vercel this mostly works because serverless functions keep instances warm briefly between requests, but occasional login failures are possible if the challenge and verify requests land on different cold starts. Fix before scaling seriously: move the challenge store into the `sessions` table or a `challenges` table in Postgres.
- **Ingestion latency equals the cron interval.** Hourly cron ⇒ up to ~1 hour lag between a zap being published and it appearing in a creator's dashboard. Daily cron ⇒ up to ~24 hours. This is the unavoidable trade-off for not running a worker.
- **Function timeout bounds per-tick work.** `/api/cron/ingest` sets `maxDuration = 60` and caps `MAX_BACKFILLS_PER_RUN = 3`. A newly-signed-up user with a huge zap history may need two or three cron ticks before their backfill fully completes.
- **Neon compute auto-suspends when idle.** The first request after a quiet period takes an extra ~1s while the compute resumes. Harmless, but noticeable on the first hit after a long idle.
- **The landing-page trending feed** (`/`) still uses the client-side `zapBoostClient` singleton with in-memory caches. `satsPerHour` / `zapsPerHour` there are all-time totals, not a true 1h window. The DB-backed `/api/stats` path is unaffected.

### Data flow summary

```
User signs in (NIP-07)
       │
       ▼
/api/auth/verify ──inserts──▶ backfill_jobs (pending)
                                     │
Vercel Cron (hourly)                  │
       │                              │
       ▼                              │
/api/cron/ingest ─────────────────────┘
       │                                            ┌───────────────┐
       ├─ pull recent zaps for all users ──────────▶│  zap_events   │
       │   (since = max(zap_events.timestamp))     │  posts        │
       │                                            │               │
       └─ drain backfill_jobs (up to 3/run) ───────▶│               │
                                                    └───────────────┘
```

## Related

- **ZapBoost (Android)** — github.com/dmcarrington/unfiltered
- **Nostr Oracle** — github.com/dmcarrington/nostr-oracle

## License

MIT
