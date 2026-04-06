'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TopSupporter, formatSats, truncateNpub } from './types';
import { hexToNpub } from '@/lib/nostr-utils';

interface SupporterLeaderboardProps {
  supporters: TopSupporter[];
}

export function SupporterLeaderboard({ supporters }: SupporterLeaderboardProps) {
  if (supporters.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
          Top Supporters
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
          No supporters yet
        </p>
      </div>
    );
  }

  // Prepare chart data for top 10
  const chartData = supporters.slice(0, 10).map((s, i) => ({
    name: s.senderPubkey ? truncateNpub(hexToNpub(s.senderPubkey)) : 'Anon',
    sats: s.totalSats,
    zaps: s.zapCount,
  }));

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
        Top Supporters
      </h2>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical">
          <XAxis
            type="number"
            tick={{ fill: '#757575', fontSize: 11 }}
            tickFormatter={(val) => formatSats(val)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#bdbdbd', fontSize: 11 }}
            width={110}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
            formatter={(value) => [`${Number(value).toLocaleString()} sats`, 'Total']}
          />
          <Bar dataKey="sats" fill="var(--zap-orange)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed list */}
      <div style={{ marginTop: 16 }}>
        {supporters.slice(0, 20).map((supporter, i) => {
          const npub = supporter.senderPubkey ? hexToNpub(supporter.senderPubkey) : null;
          const avgZap = supporter.zapCount > 0 ? Math.round(supporter.totalSats / supporter.zapCount) : 0;

          return (
            <div key={supporter.senderPubkey || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: i < 3 ? 'var(--zap-gold)' : 'var(--bg-surface)',
                  color: i < 3 ? '#000' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {npub ? truncateNpub(npub) : 'Anonymous'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {supporter.zapCount} zaps &middot; avg {formatSats(avgZap)} sats
                  </p>
                </div>
              </div>
              <span style={{ color: 'var(--zap-gold)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
                {formatSats(supporter.totalSats)} sats
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
