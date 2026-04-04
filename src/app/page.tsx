'use client';

import React, { useEffect, useState } from 'react';
import { zapBoostClient, TrendingPost } from '@/lib/nostr';
import { VelocityBadge } from '@/components/VelocityBadge';
import { TrendingPostCard } from '@/components/TrendingPostCard';

export default function HomePage() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Connect to Nostr relays
    zapBoostClient.connect().then(() => {
      setIsConnected(zapBoostClient.getIsConnected());
      setIsLoading(false);
    });

    // Subscribe to updates
    const unsubscribe = zapBoostClient.subscribe((posts) => {
      setTrendingPosts(posts);
      setIsConnected(zapBoostClient.getIsConnected());
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      zapBoostClient.disconnect();
    };
  }, []);

  const handleZap = async (postId: string) => {
    // For demo: show alert with post ID
    // In production: integrate with Alby or NWC wallet
    alert(`Zap initiated for post: ${postId}\n\nWallet integration coming soon!`);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      {/* Header */}
      <header
        style={{
          marginBottom: '32px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '8px',
            background: 'linear-gradient(135deg, var(--zap-gold), var(--zap-orange))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          ⚡ ZapBoost
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          Real-time Nostr zap velocity feed
        </p>

        {/* Connection status */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            padding: '6px 12px',
            backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
            borderRadius: '20px',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#4CAF50' : '#F44336',
            }}
          />
          <span style={{ color: isConnected ? '#4CAF50' : '#F44336' }}>
            {isConnected ? 'Connected to relays' : isLoading ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Stats */}
      {trendingPosts.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--zap-gold)' }}>
              {trendingPosts.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Trending Posts
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--zap-orange)' }}>
              {trendingPosts.reduce((sum, p) => sum + p.satsPerHour, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Total Sats/Hour
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--zap-blue)' }}>
              {trendingPosts.reduce((sum, p) => sum + p.zapsPerHour, 0)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Total Zaps/Hour
            </div>
          </div>
        </div>
      )}

      {/* Feed */}
      <main style={{ maxWidth: '600px', margin: '0 auto' }}>
        {isLoading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 20px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <p>Connecting to Nostr relays...</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Listening for zap receipts (NIP-57)
            </p>
          </div>
        ) : trendingPosts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 20px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💧</div>
            <p>No zaps yet</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Be the first to zap something!
            </p>
          </div>
        ) : (
          trendingPosts.map((post) => (
            <TrendingPostCard
              key={post.postId}
              postId={post.postId}
              satsPerHour={post.satsPerHour}
              zapsPerHour={post.zapsPerHour}
              velocityTrend={post.velocityTrend}
              onZap={handleZap}
            />
          ))
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: '64px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          padding: '20px',
        }}
      >
        <p>Built on Nostr + Lightning Network</p>
        <p style={{ marginTop: '8px' }}>
          <a
            href="https://github.com/dmcarrington/zapboost-web"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)' }}
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
