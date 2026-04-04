'use client';

import React from 'react';

interface VelocityBadgeProps {
  satsPerHour: number;
  zapsPerHour: number;
  trend?: 'rising' | 'falling' | 'stable';
}

export function VelocityBadge({ satsPerHour, zapsPerHour, trend = 'stable' }: VelocityBadgeProps) {
  const getBadgeColor = () => {
    if (satsPerHour >= 10000) return 'var(--zap-gold)';
    if (satsPerHour >= 1000) return 'var(--zap-orange)';
    return 'var(--zap-blue)';
  };

  const getLabel = () => {
    if (satsPerHour >= 10000) return `${(satsPerHour / 1000).toFixed(0)}k sats/hr`;
    if (satsPerHour >= 1000) return `${(satsPerHour / 1000).toFixed(1)}k sats/hr`;
    return `${satsPerHour} sats/hr`;
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'rising': return '📈';
      case 'falling': return '📉';
      default: return '';
    }
  };

  const getEmoji = () => {
    if (satsPerHour >= 10000) return '🔥';
    if (satsPerHour >= 1000) return '⚡';
    return '💧';
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: getBadgeColor(),
        borderRadius: '6px',
        fontWeight: 700,
        fontSize: '13px',
        color: '#000000',
      }}
    >
      <span>{getEmoji()}</span>
      <span>{getLabel()}</span>
      {trend !== 'stable' && <span>{getTrendIcon()}</span>}
    </div>
  );
}
