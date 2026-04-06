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

ZapBoost is designed to run on a **fully free, persistent infrastructure stack** suitable for demo projects and hobby deployments. There is no long-running worker process, no paid database, and no trial-clock to worry about. The recommended topology is:

- **Neon** — Postgres (persistent free tier)
- **Vercel Hobby** — Next.js app and `/api/cron/ingest` HTTP endpoint
- **GitHub Actions** — scheduler that hits `/api/cron/ingest` on a cron

### Why this stack

The hard constraint for a free-forever deployment is **persistent state**. Most "free" plans either delete databases after 30 days (Render free Postgres) or require a credit card and ongoing credits (Railway, Fly). Long-running worker processes are the other trap — Render Background Workers are paid-only, and holding WebSocket subscriptions open on a free web service doesn't survive auto-sleep.

ZapBoost sidesteps both:

- **Neon's free tier is genuinely persistent.** Projects are never deleted for inactivity; only the compute auto-suspends after ~5 minutes idle and wakes on the next query. Storage is 0.5 GB, more than enough for a demo's zap history.
- **Ingestion is stateless and pull-based.** `src/lib/ingestion.ts` has no long-running process. Each run connects to Nostr relays, queries with a bounded `since` filter, writes to Postgres via `onConflictDoNothing` (so dedup is free), and disconnects. This fits inside a Vercel serverless function.
- **GitHub Actions handles the cron.** Vercel Cron does not work usefully on the Hobby plan, so we use an external scheduler. GitHub Actions gives unlimited minutes for public repos and 2,000 min/month for private — more than enough, since a single ingest run takes seconds.

### Infrastructure requirements

| Piece | What it does | Host | Cost |
|-------|--------------|------|------|
| Next.js app | Landing page, dashboard, all `/api/*` routes, `/api/cron/ingest` | **Vercel Hobby** | Free |
| PostgreSQL | Source of truth for users, zaps, posts, subscriptions, API keys, sessions, backfill jobs | **Neon free tier** | Free, persistent |
| Scheduled ingestion | Periodic pull of kind-9735 zap receipts + drain of `backfill_jobs` queue | **GitHub Actions** (`.github/workflows/ingest.yml`) | Free |

**Verify free-tier terms yourself before committing**, since platform terms change. At the time of writing:

- **Neon Free** — 0.5 GB storage, 1 project, compute auto-suspends when idle, no automatic deletion of inactive projects. https://neon.tech/pricing
- **Vercel Hobby** — free personal use, serverless functions up to 60s (`maxDuration`). Vercel Cron is *not* a reliable option on Hobby; GitHub Actions is used instead. https://vercel.com/pricing
- **GitHub Actions** — 2,000 minutes/month on private repos, unlimited on public repos; minimum cron interval is 5 minutes. https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration

Required environment variables:

- `DATABASE_URL` — Neon connection string **(required)**
- `JWT_SECRET` — session signing key; generate with `openssl rand -base64 32` **(required)**
- `CRON_SECRET` — shared secret for `/api/cron/ingest`; generate with `openssl rand -base64 32` **(required)**
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
3. Deploy. The included `vercel.json` pins the region to `fra1` and sets security headers.
4. Once deployed, note the URL of the cron endpoint — e.g. `https://<your-project>.vercel.app/api/cron/ingest`.

You can sanity-check the endpoint directly from your laptop:

```bash
curl -fsS -H "Authorization: Bearer <your CRON_SECRET>" \
  https://<your-project>.vercel.app/api/cron/ingest
```

Expected response on a fresh deploy:

```json
{ "ok": true, "recentPulled": 0, "backfillsRun": 0, "backfillsFailed": 0, "skippedNoUsers": true, "durationMs": 1234 }
```

`skippedNoUsers: true` just means no one has signed in yet.

### Step 4 — Enable the GitHub Actions scheduler

The repo ships with `.github/workflows/ingest.yml`, which runs every 10 minutes, curls the ingest endpoint with the cron secret, and completes in seconds.

1. Go to your repo's **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `INGEST_URL` — `https://<your-project>.vercel.app/api/cron/ingest`
   - `CRON_SECRET` — the same value you set on Vercel
2. Go to **Actions** in the repo and enable workflows if they're not already on.
3. Open the **Ingest zaps** workflow and click **Run workflow** to trigger a manual run. It should finish in well under a minute with a green check.
4. Sign in to the Vercel deployment with a Nostr extension. This enqueues a `backfill_jobs` row.
5. Re-run the workflow (or wait up to 10 minutes for the next scheduled tick). The workflow logs will show the JSON response with `backfillsRun: 1`, and your dashboard will populate with historical zaps.

If you want a different cadence, edit the `cron:` line in `.github/workflows/ingest.yml`. GitHub Actions enforces a **5-minute minimum** and schedules are best-effort — actual runs may lag by a few minutes under load.

### Known limitations

- **NIP-07 auth challenges are stored in process memory** with a 5-minute TTL (`src/lib/auth.ts`). On Vercel this mostly works because serverless functions keep instances warm briefly between requests, but occasional login failures are possible if the challenge and verify requests land on different cold starts. Fix before scaling seriously: move the challenge store into the `sessions` table or a `challenges` table in Postgres.
- **Ingestion latency equals the cron interval.** With the default 10-minute GitHub Actions schedule, a zap may take up to ~10 minutes to appear in a creator's dashboard. GitHub's scheduler is best-effort under load, so occasional runs may lag further. This is the unavoidable trade-off for not running a worker.
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
GitHub Actions (every 10 min)         │
       │                              │
       ▼                              │
curl → /api/cron/ingest ──────────────┘
          (Vercel Hobby)
          │                                         ┌───────────────┐
          ├─ pull recent zaps for all users ───────▶│  zap_events   │
          │   (since = max(zap_events.timestamp))  │  posts        │
          │                                         │   (Neon)      │
          └─ drain backfill_jobs (up to 3/run) ────▶│               │
                                                    └───────────────┘
```

## Related

- **ZapBoost (Android)** — github.com/dmcarrington/unfiltered
- **Nostr Oracle** — github.com/dmcarrington/nostr-oracle

## License

MIT
