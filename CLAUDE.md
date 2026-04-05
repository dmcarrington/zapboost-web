# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm start         # Run production build
npm run lint      # Run ESLint
```

There are no tests.

## Architecture

This is a **Next.js 14 App Router** app — fully client-side (no server-side API routes). All logic runs in the browser.

### Data flow

1. `zapBoostClient` (singleton exported from `src/lib/nostr.ts`) connects to 3 public Nostr relays on mount
2. It subscribes to **kind 9735** (NIP-57 zap receipts) and also runs a historical sync (`syncHistoricalZaps`) looking back 3 months
3. Zaps are stored in `zapCache` (Map of postId → ZapEvent[]). When a new post ID is encountered, `fetchPostContent` fetches the **kind 1** note content from relays
4. `updateVelocityCache` runs every 30s, aggregates totals, sorts by sats descending, and pushes updates to all registered listeners
5. `page.tsx` subscribes via `zapBoostClient.subscribe()` and renders the feed

### Npub filtering

When a user sets their npub (via Alby connect or the manual input field), `zapBoostClient.setMyNpub()` is called. The client then only processes zaps where the `p` tag matches that npub. Without an npub set, all zaps from the relays are captured.

**Note:** `satsPerHour` and `zapsPerHour` on `TrendingPost` are actually **all-time totals** (not a real 1h window) — the velocity window logic is a planned improvement.

### Key files

- `src/lib/nostr.ts` — `ZapBoostClient` class; all relay/subscription/cache logic
- `src/lib/alby.ts` — Alby browser extension + NWC wallet integration (`sendZap`, `connectAlby`)
- `src/app/page.tsx` — Single-page app; manages all state, handles npub input, renders feed
- `src/components/TrendingPostCard.tsx` — Card component; clicking opens post on `primal.net`
- `src/components/VelocityBadge.tsx` — Color-coded badge (gold ≥10k, orange ≥1k, blue <1k sats)
- `src/app/globals.css` — CSS variables for the OLED black theme (`--bg-primary`, `--zap-gold`, etc.)

### CSS conventions

All styling uses inline `style` props with CSS variables defined in `globals.css`. No CSS modules or Tailwind.

### Known limitations

- In-memory cache only — resets on page refresh
- No backend; client-side only
