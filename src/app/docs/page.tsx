'use client';

import { useState } from 'react';

const SECTIONS = [
  {
    id: 'auth',
    title: 'Authentication',
    content: `All v1 API endpoints require an API key. Pass it via:

**Header (recommended):**
\`\`\`
X-API-Key: zb_live_your_key_here
\`\`\`

**Query parameter:**
\`\`\`
GET /api/v1/stats/{pubkey}?api_key=zb_live_your_key_here
\`\`\`

API keys are available on the **Pro** and **Platform** tiers. Generate keys at /dashboard/settings.`,
  },
  {
    id: 'stats',
    title: 'GET /api/v1/stats/{pubkey}',
    content: `Fetch analytics for a specific Nostr creator.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| pubkey | path | required | Hex public key of the creator |
| days | query | 30 | History period (clamped to tier limit) |
| limit | query | 20 | Max top posts/supporters returned |

**Response:**
\`\`\`json
{
  "pubkey": "abc123...",
  "period": { "days": 30, "since": 1709251200 },
  "totals": {
    "sats": 150000,
    "zaps": 342,
    "avgZapSize": 438,
    "uniqueSupporters": 89
  },
  "topPosts": [
    { "postId": "event_id", "totalSats": 25000, "zapCount": 45 }
  ],
  "topSupporters": [
    { "senderPubkey": "hex_pubkey", "totalSats": 10000, "zapCount": 12 }
  ],
  "dailyStats": [
    { "day": "2025-03-15", "totalSats": 5000, "zapCount": 12 }
  ]
}
\`\`\``,
  },
  {
    id: 'leaderboard',
    title: 'GET /api/v1/leaderboard',
    content: `Fetch trending creators ranked by zap velocity.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | query | 7 | Ranking period |
| limit | query | 50 | Max results (max 100) |

**Response:**
\`\`\`json
{
  "period": { "days": 7, "since": 1709251200 },
  "count": 50,
  "leaderboard": [
    {
      "rank": 1,
      "pubkey": "abc123...",
      "totalSats": 500000,
      "totalZaps": 1200,
      "uniqueSupporters": 340,
      "satsPerHour": 2976,
      "zapsPerHour": 7.14
    }
  ]
}
\`\`\``,
  },
  {
    id: 'keys',
    title: 'API Key Management',
    content: `Manage your API keys programmatically. Requires session auth (JWT).

**GET /api/v1/keys** — List all active keys
**POST /api/v1/keys** — Create a new key
\`\`\`json
{ "name": "My Integration" }
\`\`\`
**DELETE /api/v1/keys** — Revoke a key
\`\`\`json
{ "keyId": "zb_live_..." }
\`\`\``,
  },
  {
    id: 'embed',
    title: 'Embeddable Widgets',
    content: `Embed ZapBoost analytics directly into your app via iframe.

**Basic embed:**
\`\`\`html
<iframe
  src="https://zapboost.app/embed/{pubkey}"
  width="400"
  height="350"
  frameborder="0"
></iframe>
\`\`\`

**Customization parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| bg | #000000 | Background color |
| card | #141414 | Card background color |
| text | #ffffff | Primary text color |
| accent | #ffd700 | Accent color (gold) |
| muted | #757575 | Muted text color |
| chart | true | Show revenue chart |
| posts | true | Show top posts |
| days | 30 | Data period |
| title | "Zap Analytics" | Widget title |

**Example with Primal-style theming:**
\`\`\`html
<iframe
  src="https://zapboost.app/embed/{pubkey}?bg=%23111111&accent=%23bc1888&title=Zap+Stats"
  width="400"
  height="350"
  frameborder="0"
></iframe>
\`\`\``,
  },
  {
    id: 'rate-limits',
    title: 'Rate Limits',
    content: `Rate limits are per API key, per minute.

| Tier | Requests/min |
|------|-------------|
| Pro | 100 |
| Platform | 1,000 |

Exceeding the limit returns \`429 Too Many Requests\`. Contact us for Platform tier custom limits.`,
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('auth');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 240, flexShrink: 0, padding: '24px 16px',
        borderRight: '1px solid var(--border-color)',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <a href="/" style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--zap-gold)' }}>
            ZapBoost
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
            API Documentation
          </span>
        </a>

        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', marginBottom: 4, borderRadius: 6,
              fontSize: 13, border: 'none',
              background: activeSection === section.id ? 'var(--bg-card)' : 'transparent',
              color: activeSection === section.id ? 'var(--zap-gold)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {section.title.startsWith('GET') || section.title.startsWith('API') || section.title.startsWith('Embed') || section.title.startsWith('Rate')
              ? section.title
              : section.title}
          </button>
        ))}

        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 16, paddingTop: 16 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Dashboard
          </a>
        </div>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: 800 }}>
        {SECTIONS.filter((s) => s.id === activeSection).map((section) => (
          <div key={section.id}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>
              {section.title}
            </h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8 }}>
              {section.content.split('\n').map((line, i) => {
                // Render code blocks
                if (line.startsWith('```')) {
                  return null; // handled by block logic below
                }

                // Bold
                const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                // Inline code
                const withCode = formatted.replace(/`([^`]+)`/g, '<code style="background:var(--bg-card);padding:1px 6px;border-radius:4px;font-size:13px;color:var(--zap-gold)">$1</code>');

                // Table rows
                if (line.startsWith('|')) {
                  const cells = line.split('|').filter(Boolean).map((c) => c.trim());
                  if (cells.every((c) => c.match(/^-+$/))) return null; // separator
                  const isHeader = i > 0 && section.content.split('\n')[i + 1]?.match(/^\|[\s-]+\|/);
                  return (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
                      gap: 8, padding: '6px 0',
                      borderBottom: '1px solid var(--border-color)',
                      fontWeight: isHeader ? 600 : 400,
                      fontSize: 13,
                    }}>
                      {cells.map((cell, j) => (
                        <span key={j} dangerouslySetInnerHTML={{ __html: cell.replace(/`([^`]+)`/g, '<code style="background:var(--bg-card);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>') }} />
                      ))}
                    </div>
                  );
                }

                if (line.trim() === '') return <br key={i} />;
                return <p key={i} style={{ marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: withCode }} />;
              })}

              {/* Render code blocks */}
              {section.content.match(/```[\s\S]*?```/g)?.map((block, i) => {
                const lines = block.split('\n');
                const lang = lines[0].replace('```', '').trim();
                const code = lines.slice(1, -1).join('\n');
                return (
                  <pre key={`code-${i}`} style={{
                    background: 'var(--bg-card)', borderRadius: 8,
                    padding: 16, marginBottom: 16, overflow: 'auto',
                    fontSize: 13, lineHeight: 1.5,
                    border: '1px solid var(--border-color)',
                  }}>
                    {lang && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>{lang}</div>}
                    <code style={{ color: 'var(--text-primary)' }}>{code}</code>
                  </pre>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
