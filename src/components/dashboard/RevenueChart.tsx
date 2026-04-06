'use client';

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useState } from 'react';
import { DailyStat, formatSats } from './types';

interface RevenueChartProps {
  dailyStats: DailyStat[];
}

const tooltipStyle = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 },
  labelStyle: { color: '#fff' },
};

export function RevenueChart({ dailyStats }: RevenueChartProps) {
  const [view, setView] = useState<'sats' | 'zaps'>('sats');

  if (dailyStats.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', padding: 40 }}>No data for this period</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
          Daily {view === 'sats' ? 'Revenue' : 'Zap Count'}
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sats', 'zaps'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                background: view === v ? 'var(--zap-gold)' : 'transparent',
                color: view === v ? '#000' : 'var(--text-muted)',
                border: view === v ? 'none' : '1px solid var(--border-color)',
                fontWeight: view === v ? 600 : 400,
              }}
            >
              {v === 'sats' ? 'Sats' : 'Zaps'}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        {view === 'sats' ? (
          <AreaChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#757575', fontSize: 11 }}
              tickFormatter={(val) => val.slice(5)}
            />
            <YAxis
              tick={{ fill: '#757575', fontSize: 11 }}
              tickFormatter={(val) => formatSats(val)}
              width={50}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value) => [`${Number(value).toLocaleString()} sats`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="totalSats"
              stroke="var(--zap-gold)"
              fill="var(--zap-gold)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        ) : (
          <BarChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#757575', fontSize: 11 }}
              tickFormatter={(val) => val.slice(5)}
            />
            <YAxis
              tick={{ fill: '#757575', fontSize: 11 }}
              width={40}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value) => [`${Number(value)} zaps`, 'Count']}
            />
            <Bar dataKey="zapCount" fill="var(--zap-orange)" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
