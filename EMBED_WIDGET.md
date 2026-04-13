# ZapBoost Embed Widget

**Embeddable analytics cards for Nostr creators**

The ZapBoost embed widget is an iframe-based analytics card that Nostr clients (Primal, Damus, etc.) or creators can embed to display real-time zap statistics.

---

## Quick Start

### Basic Embed

```html
<iframe
  src="https://zapboost-web.vercel.app/embed/{pubkey}"
  width="400"
  height="520"
  style="border:0;border-radius:12px"
></iframe>
```

Replace `{pubkey}` with the creator's **hex public key** (not npub format).

---

## What It Displays

The widget shows:

| Metric | Description |
|--------|-------------|
| **Sats** | Total sats received in the time period |
| **Zaps** | Total number of zap receipts |
| **Avg Size** | Average zap size in sats |
| **Supporters** | Unique zappers (supporters) |
| **Chart** | Daily zap volume over time (area chart) |
| **Top Posts** | Top 5 posts by total sats received |

---

## Customization

The widget supports extensive white-label customization via URL query parameters:

### Theme Colors

```html
<iframe
  src="https://zapboost-web.vercel.app/embed/{pubkey}?bg=ffffff&card=f5f5f5&text=000000&accent=ff9900&muted=999999"
  width="400"
  height="520"
></iframe>
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `bg` | `#000000` | Background color (hex) |
| `card` | `#141414` | Card/panel background color |
| `text` | `#ffffff` | Primary text color |
| `accent` | `#ffd700` | Accent color (stats, chart stroke) |
| `muted` | `#757575` | Muted/secondary text color |

### Feature Toggles

| Parameter | Default | Description |
|-----------|---------|-------------|
| `chart` | `true` | Show/hide the daily stats chart |
| `posts` | `true` | Show/hide top posts section |
| `days` | `30` | Time window (e.g., `7`, `30`, `90`) |
| `title` | `"Zap Analytics"` | Custom widget title |

### Examples

**Compact widget (stats only):**
```html
<iframe
  src="https://zapboost-web.vercel.app/embed/{pubkey}?chart=false&posts=false"
  width="400"
  height="180"
></iframe>
```

**7-day view with custom branding:**
```html
<iframe
  src="https://zapboost-web.vercel.app/embed/{pubkey}?days=7&title=My Zap Stats&accent=00ff00"
  width="400"
  height="520"
></iframe>
```

**Dark theme (default):**
```html
<iframe
  src="https://zapboost-web.vercel.app/embed/{pubkey}"
  width="400"
  height="520"
></iframe>
```

**Light theme:**
```html
<iframe
  src="https://zapboost-web.vercel.app/embed/{pubkey}?bg=ffffff&card=f0f0f0&text=000000&muted=666666"
  width="400"
  height="520"
></iframe>
```

---

## Technical Details

### Architecture

```
┌──────────────────────────────────────┐
│  Nostr Client / Website              │
│  Embeds iframe                       │
└─────────────────┬────────────────────┘
                  │
                  │ GET /embed/{pubkey}
                  ▼
┌──────────────────────────────────────┐
│  ZapBoost (Vercel)                   │
│  Client-side React app               │
│  Fetches /api/stats/:pubkey          │
└─────────────────┬────────────────────┘
                  │
                  │ SELECT FROM zap_events
                  │ WHERE recipient_pubkey = ?
                  ▼
┌──────────────────────────────────────┐
│  Neon PostgreSQL                     │
│  Aggregated zap stats                │
└──────────────────────────────────────┘
```

### Key Files

- `src/app/embed/[pubkey]/page.tsx` — Main embed page component
- `src/app/embed/[pubkey]/layout.tsx` — Embed layout (minimal chrome)
- `src/app/api/stats/[pubkey]/route.ts` — API endpoint for stats

### API Endpoint

The widget fetches data from:

```
GET /api/stats/:pubkey?days=30
```

Response:

```json
{
  "totals": {
    "sats": 1250000,
    "zaps": 342,
    "avgZapSize": 3655,
    "uniqueSupporters": 89
  },
  "dailyStats": [
    { "day": "2026-04-01", "totalSats": 45000, "zapCount": 12 },
    ...
  ],
  "topPosts": [
    { "postId": "abc123...", "totalSats": 500000, "zapCount": 85 },
    ...
  ]
}
```

**No API key required** — embed data is public.

---

## Use Cases

### 1. Nostr Client Integration

Nostr clients can embed the widget on creator profile pages:

```html
<!-- Primal, Damus, etc. embed on creator profile -->
<iframe 
  src="https://zapboost-web.vercel.app/embed/npub146yqcf2n4zrkuzs0dg6q0swp2z4ls3956f87ywewhcdeax9t5fksjk6rju"
  width="100%"
  height="520"
  style="border:0"
></iframe>
```

### 2. Creator Personal Websites

Creators can add the widget to their Linktree, personal site, or blog:

```html
<!-- Creator's personal site -->
<iframe 
  src="https://zapboost.app/embed/me?title=My Zap Earnings"
  width="350"
  height="520"
></iframe>
```

### 3. White-Label for Platforms

Platform-tier subscribers can remove ZapBoost branding:

```html
<iframe 
  src="https://zapboost.app/embed/{pubkey}?title=&accent=brand_color"
  width="400"
  height="520"
></iframe>
```

---

## Monetization Tiers

| Tier | Embed Features |
|------|----------------|
| **Free** | Basic widget with "Powered by ZapBoost" branding |
| **Creator** | Custom title, remove branding option |
| **Pro** | Full white-label, custom domains |
| **Platform** | Bulk embeds, SLA, custom integrations |

---

## Viral Growth Strategy

Every embedded widget is a **distribution channel**:

1. **Social proof** — Shows creators' earnings publicly
2. **Brand exposure** — "Powered by ZapBoost" visible on every embed
3. **Click-through** — Users can click to ZapBoost dashboard
4. **Network effects** — More creators → more embeds → more signups

---

## Development

### Local Testing

```bash
cd ~/.openclaw/workspace/zapboost-web
npm run dev
# Visit http://localhost:3000/embed/{pubkey}
```

### Adding New Features

1. Add new query params in `src/app/embed/[pubkey]/page.tsx`
2. Update API response in `src/app/api/stats/[pubkey]/route.ts`
3. Test with various theme combinations
4. Update this documentation

---

## Notes

- **Pubkey format:** Use hex pubkey, not npub (bech32)
- **CORS:** Widget is iframe-based, no CORS issues
- **Performance:** Widget loads asynchronously, non-blocking
- **Mobile:** Responsive design, adapts to iframe width
- **Accessibility:** Basic ARIA labels, keyboard navigation

---

## Related

- [API Documentation](/docs)
- [Deployment Guide](DEPLOY.md)
- [README](README.md)
