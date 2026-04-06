# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # Install dependencies
npm run dev         # Start dev server at http://localhost:3000
npm run build       # Production build
npm start           # Run production build
npm run lint        # Run ESLint

npm run db:generate # Generate Drizzle migrations from schema.ts
npm run db:migrate  # Apply migrations
npm run db:push     # Push schema directly (dev)
npm run db:studio   # Open Drizzle Studio
```

There are no tests.

## Architecture

**Next.js 14 App Router** full-stack app with a PostgreSQL backend. The app has both a client-side live feed (for the anonymous landing page) and a server-side ingestion + API layer powering authenticated dashboards and the public API.

### Backend: database + ingestion

- **DB:** PostgreSQL via `drizzle-orm` + `postgres`. Connection in `src/lib/db/index.ts`, schema in `src/lib/db/schema.ts`. `DATABASE_URL` env var required.
- **Tables:** `users` (pubkey PK, tier), `zap_events` (nostr event id PK, indexed by recipient+timestamp, post, sender, ts), `posts` (kind-1 note cache), `subscriptions` (Lightning-paid tier upgrades), `api_keys` (`zb_live_…`/`zb_test_…` tokens), `sessions` (JWT jti records).
- **Ingestion:** `src/lib/ingestion.ts` — server-side `IngestionService` connects to relays, deduplicates kind-9735 zap receipts via `seenEventIds`, persists them to `zap_events`, and backfills kind-1 post content into `posts`. Shares parsing helpers with the client via `src/lib/nostr-utils.ts` (`DEFAULT_RELAYS`, `parseZapReceipt`, `parsePostEvent`).

### Auth: NIP-07 + JWT

`src/lib/auth.ts` implements challenge/response login using a user's Nostr extension:

1. `GET /api/auth/challenge` → returns a random UUID (kept in-memory, 5 min TTL)
2. Client signs it as a kind-27235 event via NIP-07
3. `POST /api/auth/verify` → server verifies signature, upserts `users`, creates a `sessions` row, returns a 7-day JWT (signed with `JWT_SECRET`)
4. `GET /api/auth/me` → returns current session
5. `src/lib/auth-client.ts` holds the browser-side helpers

API routes call `authenticateRequest()` from `src/lib/api-auth.ts`, which accepts either a JWT session cookie/header or an API key (see `src/lib/api-keys.ts`) and returns `{ pubkey, tier, tierConfig }`.

### Tiers + feature gating

`src/lib/tiers.ts` defines four tiers (`free`, `creator`, `pro`, `platform`) with per-tier limits (`maxHistoryDays`, `maxTopPosts`, `maxTopSupporters`) and feature flags (`hourlyHeatmap`, `sizeDistribution`, `customDateRange`, `csvExport`, `apiAccess`, `webhooks`, `multiNpub`). API routes call `clampDays(tier, requestedDays)` before querying and use `hasFeature()` to gate responses. Unauthenticated requests get `free` limits.

### Billing

`src/lib/billing.ts` — Lightning subscriptions via LNbits. Set `LNBITS_URL` and `LNBITS_API_KEY` to enable real invoice generation; without them, runs in manual/dev mode (payment hash only). Subscriptions are 30 days. `/api/subscribe` creates an invoice; `/api/subscribe/confirm` marks it paid and upgrades the user's tier.

### API routes

Under `src/app/api/`:

- `auth/challenge`, `auth/verify`, `auth/me` — NIP-07 login
- `stats/[pubkey]` — internal dashboard stats (session-authed, tier-clamped)
- `zaps/[pubkey]` — raw zap event list
- `subscribe`, `subscribe/confirm` — Lightning tier upgrades
- `v1/stats/[pubkey]`, `v1/leaderboard`, `v1/keys` — public API (API-key-authed, requires `apiAccess` feature flag = pro+)

### Frontend pages

- `src/app/page.tsx` — live zap feed landing page. Still uses the client-side `zapBoostClient` singleton from `src/lib/nostr.ts` (in-memory only, no DB writes). Auto-detects pubkey via NIP-07, falls back to manual npub input. Filter via `setMyNpub()` + `restart()`.
- `src/app/dashboard/page.tsx` — authenticated analytics dashboard (charts from `recharts`). Calls `/api/stats/[pubkey]`.
- `src/app/dashboard/settings/page.tsx` — tier/subscription management, API key creation.
- `src/app/docs/page.tsx` — public API documentation.
- `src/app/embed/[pubkey]/` — embeddable public widget.

### Key files

- `src/lib/nostr.ts` — client-side `ZapBoostClient` for the live feed (unchanged from the original anonymous UX). In-memory `zapCache`/`velocityCache`/`postCache`.
- `src/lib/nostr-utils.ts` — shared relay list + parsers used by both client and server ingestion.
- `src/lib/ingestion.ts` — server-side zap persistence.
- `src/lib/db/schema.ts` — Drizzle schema (source of truth for DB shape).
- `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/api-auth.ts` — auth stack.
- `src/lib/api-keys.ts` — `zb_live_…`/`zb_test_…` generation + lookup.
- `src/lib/tiers.ts` — tier config and feature gating helpers.
- `src/lib/billing.ts` — LNbits Lightning billing.
- `src/lib/alby.ts` — Alby extension + NWC helpers (`sendZap`, `connectAlby`, `getAlbyNpub`).
- `src/components/TrendingPostCard.tsx`, `VelocityBadge.tsx` — landing-page feed UI.
- `src/components/dashboard/` — `StatCards`, `RevenueChart`, `HeatmapChart`, `SizeDistribution`, `PostPerformance`, `SupporterLeaderboard`, `DateRangePicker` (all `recharts`-based).

### Env vars

- `DATABASE_URL` — Postgres connection string (required)
- `JWT_SECRET` — session signing key (defaults to `dev-secret-change-me`)
- `LNBITS_URL`, `LNBITS_API_KEY` — optional; enables real Lightning invoices

### CSS conventions

Inline `style` props with CSS variables defined in `src/app/globals.css` (OLED black theme: `--bg-primary`, `--zap-gold`, etc.). No CSS modules or Tailwind.

### Known quirks

- The landing-page `zapBoostClient` still treats `satsPerHour`/`zapsPerHour` on `TrendingPost` as **all-time totals** rather than a real 1h window — see `updateVelocityCache()` in `src/lib/nostr.ts`. The DB-backed `/api/stats` path is not affected.
- NIP-07 auth challenges are stored in-process; they don't survive server restarts and won't work across multiple server instances without a shared store.
