'use client';

import { formatSats } from './types';

interface StatCardsProps {
  sats: number;
  zaps: number;
  avgZapSize: number;
  uniqueSupporters: number;
}

export function StatCards({ sats, zaps, avgZapSize, uniqueSupporters }: StatCardsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
      <Card label="Total Sats" value={formatSats(sats)} icon="⚡" color="var(--zap-gold)" />
      <Card label="Total Zaps" value={formatSats(zaps)} icon="🔔" color="var(--zap-orange)" />
      <Card label="Avg Zap Size" value={`${formatSats(avgZapSize)} sats`} icon="📊" color="var(--zap-blue)" />
      <Card label="Unique Supporters" value={uniqueSupporters.toString()} icon="👥" color="var(--text-primary)" />
    </div>
  );
}

function Card({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      padding: '20px 16px',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
