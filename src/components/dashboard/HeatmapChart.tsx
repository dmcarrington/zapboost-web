'use client';

import { HourlyStats, formatSats } from './types';

interface HeatmapChartProps {
  hourlyStats: HourlyStats | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'var(--bg-surface)';
  const intensity = value / max;
  if (intensity > 0.75) return 'var(--zap-gold)';
  if (intensity > 0.5) return 'var(--zap-orange)';
  if (intensity > 0.25) return 'var(--zap-blue)';
  return 'rgba(66, 165, 245, 0.3)';
}

export function HeatmapChart({ hourlyStats }: HeatmapChartProps) {
  if (!hourlyStats || hourlyStats.heatmap.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
          Peak Zap Times
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
          Not enough data yet
        </p>
      </div>
    );
  }

  // Build lookup map
  const lookup = new Map<string, { totalSats: number; zapCount: number }>();
  let maxSats = 0;
  hourlyStats.heatmap.forEach((cell) => {
    lookup.set(`${cell.dow}-${cell.hour}`, { totalSats: cell.totalSats, zapCount: cell.zapCount });
    if (cell.totalSats > maxSats) maxSats = cell.totalSats;
  });

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-secondary)' }}>
        Peak Zap Times
      </h2>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(24, 1fr)`, gap: 2, minWidth: 600 }}>
          {/* Hour labels */}
          <div />
          {HOURS.map((h) => (
            <div key={h} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', padding: '2px 0' }}>
              {h.toString().padStart(2, '0')}
            </div>
          ))}

          {/* Rows */}
          {DAYS.map((day, dow) => (
            <>
              <div key={`label-${dow}`} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                {day}
              </div>
              {HOURS.map((h) => {
                const cell = lookup.get(`${dow}-${h}`);
                const sats = cell?.totalSats ?? 0;
                return (
                  <div
                    key={`${dow}-${h}`}
                    title={`${day} ${h}:00 — ${formatSats(sats)} sats, ${cell?.zapCount ?? 0} zaps`}
                    style={{
                      background: getColor(sats, maxSats),
                      borderRadius: 3,
                      aspectRatio: '1',
                      minHeight: 16,
                      cursor: 'default',
                      transition: 'opacity 0.15s',
                    }}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Less</span>
        {['var(--bg-surface)', 'rgba(66, 165, 245, 0.3)', 'var(--zap-blue)', 'var(--zap-orange)', 'var(--zap-gold)'].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  );
}
