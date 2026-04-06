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

## Related

- **ZapBoost (Android)** — github.com/dmcarrington/unfiltered
- **Nostr Oracle** — github.com/dmcarrington/nostr-oracle

## License

MIT
