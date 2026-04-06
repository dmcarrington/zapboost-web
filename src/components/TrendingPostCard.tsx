'use client';

import React from 'react';
import * as nip19 from 'nostr-tools/nip19';
import { VelocityBadge } from './VelocityBadge';
import { TrendingPost } from '@/lib/nostr';

interface TrendingPostCardProps {
  post: TrendingPost;
}

export function TrendingPostCard({ post }: TrendingPostCardProps) {
  const { postId, satsPerHour, zapsPerHour, velocityTrend, content } = post;
  const shortId = `${postId.slice(0, 12)}...${postId.slice(-8)}`;

  const openInPrimal = () => {
    // Primal's /e/ route expects a NIP-19 bech32 identifier, not raw hex.
    try {
      const note = nip19.noteEncode(postId);
      window.open(`https://primal.net/e/${note}`, '_blank');
    } catch {
      // Shouldn't happen for valid event ids, but fail soft rather than throw.
    }
  };

  return (
    <div
      onClick={openInPrimal}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid var(--border-color)',
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <VelocityBadge
          satsPerHour={satsPerHour}
          zapsPerHour={zapsPerHour}
          trend={velocityTrend}
        />
      </div>

      {/* Post content */}
      {content && (
        <div style={{ marginBottom: '16px' }}>
          {/* Author */}
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginBottom: '8px',
            }}
          >
            @{content.authorNpub.slice(0, 8)}...
          </div>

          {/* Text content */}
          {content.content && (
            <div
              style={{
                color: 'var(--text-primary)',
                fontSize: '15px',
                lineHeight: 1.5,
                marginBottom: content.imageUrls ? '12px' : 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {content.content.length > 280
                ? `${content.content.slice(0, 280)}...`
                : content.content}
            </div>
          )}

          {/* Image preview */}
          {content.imageUrls && content.imageUrls.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <img
                src={content.imageUrls[0]}
                alt="Post attachment"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Fallback if no content */}
      {!content && (
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
      )}

      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
        {zapsPerHour} zaps total
      </div>
    </div>
  );
}
