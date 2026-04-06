# ZapBoost Deployment Plan

**Last updated:** 2026-04-06
**Status:** Not yet deployed. Two blockers before launch.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  zapboost-web (Next.js 14)                                       │
│  Vercel — all routes: /, /dashboard, /embed, /docs, /api/*      │
└────────────────────────────┬────────────────────────────────────┘
                             │ read/write
                  ┌──────────▼──────────┐
                  │   PostgreSQL        │
                  │   (Neon or Vercel   │
                  │    Postgres)         │
                  └──────────┬──────────┘
                             │ write-only
               ┌────────────▼────────────┐
               │  Ingestion Worker       │
               │  (Railway / DigitalOcean│
               │   droplet / Fly.io)    │
               │  Long-lived process    │
               │  TCP → Nostr relays    │
               └─────────────────────────┘
```

**Critical constraint:** The ingestion service holds persistent TCP connections to Nostr relays. It **cannot** run in Vercel's serverless functions (connections die between invocations). It must run as a separate long-lived process.

---

## Step 1 — Infrastructure Setup

### 1a. PostgreSQL Database

**Recommended: Neon** (serverless Postgres, generous free tier, scales for ingestion writes)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project: `zapboost`
3. Copy the connection string: `postgresql://user:pass@host/dbname`

**Alternative: Vercel Postgres** (tighter Vercel integration, works fine)

```bash
# If using Vercel Postgres
vercel env add DATABASE_URL
```

**What it needs:**
- ~1GB storage for 1M zap events (zaps are small)
- No special extensions required
- Drizzle schema: `zap_events`, `posts`, `users`, `subscriptions`, `api_keys`, `sessions`

### 1b. Ingestion Worker Host

**Recommended: Railway** (simplest, pays per usage, `railway run` keeps process alive)

**Alternative: DigitalOcean droplet** (~$4/mo, full control)

**What runs on it:**
- `ingestion.ts` — long-lived relay subscriber + DB writer
- Connects to same PostgreSQL DB (read: write only)
- No HTTP server, no Next.js — just the worker

**Railway setup:**
```bash
npm install -g @railway/cli
railway login
cd ~/.openclaw/workspace/zapboost-web
railway init
railway add --variable DATABASE_URL="postgresql://..."
railway up
```

---

## Step 2 — Refactor Ingestion (Required)

**Problem:** `ingestion.ts` is a singleton with in-memory `seenEventIds` that lives inside the Next.js process. It doesn't start itself — nothing calls it.

**Fix:** Make it a standalone entry point.

### 2a. Create `src/worker.ts`

```typescript
// Standalone worker entry point — run separately from Next.js
import { ingestionService } from './lib/ingestion';

const pubkeys = process.argv.slice(2); // optional: filter by pubkey

console.log('[worker] Starting ZapBoost ingestion worker...');
ingestionService.start(pubkeys).then(() => {
  console.log('[worker] Ingestion started');
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[worker] Shutting down...');
  ingestionService.stop();
  process.exit(0);
});
```

### 2b. Update `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker": "tsx src/worker.ts"
  }
}
```

### 2c. Compile for worker deployment

The worker needs compiled output. Add to `tsconfig.json` or use a separate build:

```json
{
  "scripts": {
    "build:worker": "tsc -p tsconfig.worker.json",
    "start:worker": "node dist/worker.js"
  }
}
```

**tsconfig.worker.json** (extends main tsconfig, excludes Next.js stuff):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "module": "commonjs"
  },
  "include": ["src/lib/ingestion.ts", "src/lib/db/**", "src/lib/nostr-utils.ts", "src/worker.ts"]
}
```

---

## Step 3 — Vercel Deployment

### 3a. Set environment variables

```bash
cd ~/.openclaw/workspace/zapboost-web
vercel env add DATABASE_URL
# → paste Neon connection string
vercel env add JWT_SECRET
# → openssl rand -base64 32
# Optional:
vercel env add LNBITS_URL        # only when real billing is enabled
vercel env add LNBITS_API_KEY
```

### 3b. Push schema to database

```bash
npm run db:push
```

### 3c. Deploy

```bash
vercel deploy --prod
```

**Expected URLs after deployment:**
- Public feed: `https://zapboost-web.vercel.app` (or custom domain)
- Dashboard: `https://zapboost-web.vercel.app/dashboard`
- Embed: `https://zapboost-web.vercel.app/embed/<pubkey>`
- API: `https://zapboost-web.vercel.app/api/v1/*`
- Docs: `https://zapboost-web.vercel.app/docs`

### 3d. Custom domain (optional but recommended)

```
zapboost.app  →  Vercel deployment
```

In Vercel dashboard: Settings → Domains → Add `zapboost.app`

---

## Step 4 — Start Ingestion Worker

```bash
# On Railway (or your host)
DATABASE_URL="postgresql://..." npm run worker
```

**What happens:**
1. Connects to 4 relays (Damus, Primal, nos.lol, nostr.band)
2. Subscribes to kind 9735 zaps from the last hour
3. Deduplicates via `seenEventIds` Set
4. Writes every zap to PostgreSQL
5. Backfills post content (kind 1) on demand

**To backfill a specific creator on signup:**
```bash
# Triggered from /api/auth/verify when a new user signs up
npm run worker <pubkey>
# or call ingestionService.backfillForPubkey(pubkey) from the API route
```

---

## Step 5 — Verify End-to-End

```bash
# 1. Check DB has data
curl https://zapboost-web.vercel.app/api/v1/leaderboard

# 2. Check dashboard loads (will be empty if no zaps yet)
curl https://zapboost-web.vercel.app/dashboard

# 3. Check embed widget
curl https://zapboost-web.vercel.app/embed/<test-npub>

# 4. Send a test zap to yourself and verify it appears in dashboard
```

**Debug ingestion:**
```bash
# On the worker host
tail -f logs | grep "[ingestion]"
```

---

## Step 6 — Pre-Launch Checklist

### Infrastructure
- [ ] Neon project created, connection string saved
- [ ] Schema pushed (`npm run db:push`)
- [ ] Vercel deployment live at `zapboost-web.vercel.app`
- [ ] Custom domain `zapboost.app` pointing to Vercel (or use vercel.app for now)
- [ ] Ingestion worker running on Railway/droplet
- [ ] `npm run worker` tested and staying alive

### Code Gaps (before launch)
- [ ] `ingestion.ts` refactored to standalone `worker.ts` entry point
- [ ] Backfill triggered on new user signup (`/api/auth/verify` → call `ingestionService.backfillForPubkey`)
- [ ] `JWT_SECRET` set in production (not default `dev-secret-change-me`)
- [ ] `vercel.json` — enable `maxDuration` for longer API calls if needed

### Product
- [ ] Landing page shows real trending data (not just empty state)
- [ ] Dashboard loads for authenticated user
- [ ] Subscription flow works (even in simulated/dev mode)
- [ ] Embed widget renders for a known pubkey

### Marketing
- [ ] Update all URLs in `zapboost-launch-announcements.md` to actual deployment URL
- [ ] Screenshot of trending feed ready for Post #3
- [ ] 10 high-value creators identified for DMs
- [ ] Post #1 (Tease) drafted in Buffer/Hootsuite

---

## URL Reference (After Deploy)

| Route | URL |
|-------|-----|
| Public feed | `https://zapboost.app` (or `.vercel.app`) |
| Creator dashboard | `https://zapboost.app/dashboard` |
| API docs | `https://zapboost.app/docs` |
| Embed widget | `https://zapboost.app/embed/<pubkey>` |
| Auth challenge | `POST /api/auth/challenge` |
| Auth verify | `POST /api/auth/verify` |
| Stats (authenticated) | `GET /api/stats/:pubkey` |
| Leaderboard (API key) | `GET /api/v1/leaderboard` |
| Subscribe | `POST /api/subscribe` |

---

## Known Gaps to Address Post-Launch

1. **Velocity on landing page** — `/` still uses in-memory `ZapBoostClient`, velocity is all-time not rolling 1h. DB-backed `/api/v1/leaderboard` is correct. Decide if landing page needs to call the API.

2. **LNbits billing** — Real invoices need a live LNbits instance. Without it, subscription upgrades are simulated. Set `LNBITS_URL` + `LNBITS_API_KEY` when ready.

3. **API key creation UI** — `/dashboard/settings` has API key creation. Verify it works end-to-end.

4. **Webhook tier** — Platform tier for white-label clients not implemented. Document as "contact us."

5. **Alerting** — No email/Zap alerts when hitting trending. Post-launch feature.

6. **NIP-07 challenge storage** — Challenges stored in-process, don't survive server restarts or multi-instance deploys. Use Redis or KV store for production at scale.
