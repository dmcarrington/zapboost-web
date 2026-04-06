'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HourlyStats, formatSats } from './types';

interface SizeDistributionProps {
  hourlyStats: HourlyStats | null;
}

const BUCKET_COLORS: Record<string, string> = {
  '<100': 'var(--zap-blue)',
  '100-999': 'var(--zap-blue)',
  '1k-9.9k': 'var(--zap-orange)',
  '10k-99k': 'var(--zap-gold)',
  '100k+': '#ff5252',
};

const BUCKET_ORDER = ['<100', '100-999', '1k-9.9k', '10k-99k', '100k+'];

export function SizeDistribution({ hourlyStats }: SizeDistributionProps) {
  if (!hourlyStats || hourlyStats.sizeDistribution.length === 0) return null;

  const sorted = [...hourlyStats.sizeDistribution].sort(
    (a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket)
  );

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
        Zap Size Distribution
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sorted}>
          <XAxis
            dataKey="bucket"
            tick={{ fill: '#757575', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: '#757575', fontSize: 11 }}
            width={40}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
            formatter={(value, name) => {
              if (name === 'zapCount') return [`${Number(value)} zaps`, 'Count'];
              return [`${formatSats(Number(value))} sats`, 'Total'];
            }}
          />
          <Bar dataKey="zapCount" radius={[4, 4, 0, 0]}>
            {sorted.map((entry) => (
              <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] || 'var(--zap-blue)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
