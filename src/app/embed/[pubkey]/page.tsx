'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

interface EmbedStats {
  totals: { sats: number; zaps: number; avgZapSize: number; uniqueSupporters: number };
  dailyStats: Array<{ day: string; totalSats: number; zapCount: number }>;
  topPosts: Array<{ postId: string | null; totalSats: number; zapCount: number }>;
}

function formatSats(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function EmbedPage({ params }: { params: { pubkey: string } }) {
  const { pubkey } = params;
  const searchParams = useSearchParams();

  // Theme params (white-label support)
  const bgColor = searchParams.get('bg') || '#000000';
  const cardColor = searchParams.get('card') || '#141414';
  const textColor = searchParams.get('text') || '#ffffff';
  const accentColor = searchParams.get('accent') || '#ffd700';
  const mutedColor = searchParams.get('muted') || '#757575';
  const showChart = searchParams.get('chart') !== 'false';
  const showTopPosts = searchParams.get('posts') !== 'false';
  const days = parseInt(searchParams.get('days') || '30', 10);
  const title = searchParams.get('title') || 'Zap Analytics';

  const [stats, setStats] = useState<EmbedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stats/${pubkey}?days=${days}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pubkey, days]);

  if (loading) {
    return (
      <div style={{ background: bgColor, color: mutedColor, padding: 20, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        Loading...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ background: bgColor, color: mutedColor, padding: 20, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{
      background: bgColor, color: textColor, padding: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
    }}>
      {/* Title */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: accentColor, margin: 0 }}>
          {title}
        </h2>
        <span style={{ fontSize: 10, color: mutedColor }}>
          Powered by ZapBoost
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MiniStat label="Sats" value={formatSats(stats.totals.sats)} bg={cardColor} text={textColor} accent={accentColor} muted={mutedColor} />
        <MiniStat label="Zaps" value={formatSats(stats.totals.zaps)} bg={cardColor} text={textColor} accent={accentColor} muted={mutedColor} />
        <MiniStat label="Avg Size" value={formatSats(stats.totals.avgZapSize)} bg={cardColor} text={textColor} accent={accentColor} muted={mutedColor} />
        <MiniStat label="Supporters" value={stats.totals.uniqueSupporters.toString()} bg={cardColor} text={textColor} accent={accentColor} muted={mutedColor} />
      </div>

      {/* Mini chart */}
      {showChart && stats.dailyStats.length > 0 && (
        <div style={{ background: cardColor, borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={stats.dailyStats}>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: cardColor, border: `1px solid ${mutedColor}`, borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: textColor }}
                formatter={(value) => [`${Number(value).toLocaleString()} sats`]}
              />
              <Area
                type="monotone"
                dataKey="totalSats"
                stroke={accentColor}
                fill={accentColor}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top posts */}
      {showTopPosts && stats.topPosts.length > 0 && (
        <div style={{ background: cardColor, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: mutedColor, marginBottom: 8 }}>Top Posts</div>
          {stats.topPosts.slice(0, 5).map((post, i) => (
            <div key={post.postId || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0',
              borderBottom: i < Math.min(stats.topPosts.length, 5) - 1 ? `1px solid ${bgColor}` : 'none',
            }}>
              <span style={{ fontSize: 12, color: mutedColor }}>{post.zapCount} zaps</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: accentColor }}>
                {formatSats(post.totalSats)} sats
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, bg, text, accent, muted }: {
  label: string; value: string; bg: string; text: string; accent: string; muted: string;
}) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
