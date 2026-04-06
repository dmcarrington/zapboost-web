'use client';

import { useState } from 'react';

interface DateRangePickerProps {
  days: number;
  onDaysChange: (days: number) => void;
  customRange: { from: string; to: string } | null;
  onCustomRangeChange: (range: { from: string; to: string } | null) => void;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
];

export function DateRangePicker({ days, onDaysChange, customRange, onCustomRangeChange }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const handlePreset = (d: number) => {
    onCustomRangeChange(null);
    onDaysChange(d);
    setShowCustom(false);
  };

  const handleApplyCustom = () => {
    if (fromDate && toDate) {
      onCustomRangeChange({ from: fromDate, to: toDate });
      // Calculate days for the API
      const diffMs = new Date(toDate).getTime() - new Date(fromDate).getTime();
      const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      onDaysChange(diffDays);
    }
  };

  const isCustom = customRange !== null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => handlePreset(p.days)}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: !isCustom && days === p.days ? 600 : 400,
            background: !isCustom && days === p.days ? 'var(--zap-gold)' : 'var(--bg-card)',
            color: !isCustom && days === p.days ? '#000' : 'var(--text-secondary)',
            border: !isCustom && days === p.days ? 'none' : '1px solid var(--border-color)',
          }}
        >
          {p.label}
        </button>
      ))}

      <button
        onClick={() => setShowCustom(!showCustom)}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: isCustom ? 600 : 400,
          background: isCustom ? 'var(--zap-gold)' : 'var(--bg-card)',
          color: isCustom ? '#000' : 'var(--text-secondary)',
          border: isCustom ? 'none' : '1px solid var(--border-color)',
        }}
      >
        Custom
      </button>

      {showCustom && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 13,
              colorScheme: 'dark',
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 13,
              colorScheme: 'dark',
            }}
          />
          <button
            onClick={handleApplyCustom}
            disabled={!fromDate || !toDate}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              background: fromDate && toDate ? 'var(--zap-gold)' : 'var(--bg-card)',
              color: fromDate && toDate ? '#000' : 'var(--text-muted)',
              border: 'none',
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
