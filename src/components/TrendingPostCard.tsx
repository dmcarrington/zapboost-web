'use client';

import React from 'react';
import { VelocityBadge } from './VelocityBadge';

interface TrendingPostCardProps {
  postId: string;
  satsPerHour: number;
  zapsPerHour: number;
  velocityTrend?: 'rising' | 'falling' | 'stable';
  onZap?: (postId: string) => void;
}

export function TrendingPostCard({
  postId,
  satsPerHour,
  zapsPerHour,
  velocityTrend = 'stable',
  onZap,
}: TrendingPostCardProps) {
  const shortId = `${postId.slice(0, 12)}...${postId.slice(-8)}`;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <VelocityBadge
          satsPerHour={satsPerHour}
          zapsPerHour={zapsPerHour}
          trend={velocityTrend}
        />
      </div>

      <div
        style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          marginBottom: '16px',
          fontFamily: 'monospace',
        }}
      >
        Post ID: {shortId}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          {zapsPerHour} zaps in last hour
        </div>

        {onZap && (
          <button
            onClick={() => onZap(postId)}
            style={{
              backgroundColor: 'var(--zap-gold)',
              color: '#000000',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ⚡ Zap
          </button>
        )}
      </div>
    </div>
  );
}
