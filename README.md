# ZapBoost Web ⚡

Real-time Lightning zap velocity feed for Nostr — web demo deployed on Vercel.

## Live Demo

[Deploy to Vercel](https://vercel.com/new) — Coming soon

## What It Does

Aggregates public Nostr zap receipts (NIP-57, kind 9735) from multiple relays and ranks posts by **sats-per-hour**.

Think Hacker News, but ranked by real money flowing instead of upvotes.

## Features

- **Real-time monitoring** — Listens to zap receipts on 4+ public relays
- **Velocity ranking** — Posts sorted by sats/hour (1h rolling window)
- **Post content resolution** — Fetches and displays actual post text + images
- **Alby wallet integration** — One-tap zaps via Alby browser extension or NWC
- **Minimalist black theme** — OLED-friendly, white/gray accents with gold zap badges
- **Connection status** — Shows relay + wallet connectivity
- **Stats dashboard** — Total trending posts, sats/hour, zaps/hour

## Tech Stack

- **Next.js 14** — React framework with App Router
- **nostr-tools** — Nostr protocol client (relay connections, event parsing)
- **TypeScript** — Type-safe throughout
- **Vercel** — One-click deployment

## Getting Started

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000

### Build

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push to GitHub (done ✅)
2. Go to [vercel.com](https://vercel.com)
3. Import this repo
4. Deploy (no env vars needed)

## How It Works

1. **Connect** — Client connects to 4 public Nostr relays (Damus, Primal, nos.lol, nostr.band)
2. **Subscribe** — Listens for kind 9735 (zap receipts) from the last hour
3. **Parse** — Extracts e-tag (post ID), amount (sats), p-tag (recipient)
4. **Cache** — Stores zaps in memory, grouped by post
5. **Calculate** — Every 30s: sum sats/zaps per post in last hour
6. **Render** — Sort by sats/hour, display with velocity badges

## Velocity Badges

| Badge | Threshold | Color |
|-------|-----------|-------|
| 🔥 | 10k+ sats/hr | Gold |
| ⚡ | 1k+ sats/hr | Orange |
| 💧 | <1k sats/hr | Blue |

## Limitations (Demo)

- **In-memory cache** — Resets on page refresh (would use SQLite/Postgres in production)
- **Client-side only** — No backend API (would add server-side aggregation for scale)

## Production Roadmap

- [ ] Server-side aggregation (Node.js + PostgreSQL)
- [ ] Historical trend tracking (rising/falling/stable)
- [ ] Creator analytics dashboard
- [ ] 1% routing fee on zaps (monetization)

## Related

- **ZapBoost (Android)** — Unfiltered app integration: github.com/dmcarrington/unfiltered
- **Nostr Oracle** — Existing zap handling infrastructure: github.com/dmcarrington/nostr-oracle

## License

MIT
