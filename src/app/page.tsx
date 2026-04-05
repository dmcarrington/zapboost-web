'use client';

import React, { useEffect, useState } from 'react';
import { TrendingPost } from '@/lib/nostr';
import { VelocityBadge } from '@/components/VelocityBadge';
import { TrendingPostCard } from '@/components/TrendingPostCard';
import { getAlbyNpub } from '@/lib/alby';
import * as nip19 from 'nostr-tools/nip19';

import { zapBoostClient } from '@/lib/nostr';

export default function HomePage() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userNpub, setUserNpub] = useState<string | null>(null); // always hex
  const [userNpubDisplay, setUserNpubDisplay] = useState<string | null>(null);
  const [manualNpubInput, setManualNpubInput] = useState<string>('');
  const [manualNpubError, setManualNpubError] = useState<string | null>(null);
  const [albyDetecting, setAlbyDetecting] = useState(false);

  useEffect(() => {
    // Connect to Nostr relays
    zapBoostClient.connect().then(async () => {
      setIsConnected(zapBoostClient.getIsConnected());
      setIsLoading(false);
      console.log('Connected to', zapBoostClient.getRelayCount(), 'relays');

      // Auto-detect pubkey from NIP-07 extension (e.g. Alby)
      const hexPubkey = await getAlbyNpub();
      if (hexPubkey) {
        applyNpub(hexPubkey);
        console.log('Auto-detected npub from extension');
      }
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

  // Apply a hex pubkey: update state, set on client (hex), restart subscription
  const applyNpub = (hexPubkey: string) => {
    setUserNpub(hexPubkey);
    setUserNpubDisplay(nip19.npubEncode(hexPubkey));
    zapBoostClient.setMyNpub(hexPubkey);
    zapBoostClient.restart();
  };

  const handleConnectAlby = async () => {
    setAlbyDetecting(true);
    const hexPubkey = await getAlbyNpub();
    setAlbyDetecting(false);
    if (hexPubkey) {
      applyNpub(hexPubkey);
    } else {
      window.open('https://getalby.com', '_blank');
    }
  };

  const handleSetNpub = () => {
    const trimmed = manualNpubInput.trim();
    if (!trimmed) {
      setManualNpubError('Please enter an npub');
      return;
    }

    if (trimmed.startsWith('npub1')) {
      try {
        const { data } = nip19.decode(trimmed);
        if (typeof data === 'string' && data.length === 64) {
          setManualNpubError(null);
          applyNpub(data);
        } else {
          setManualNpubError('Invalid npub format');
        }
      } catch {
        setManualNpubError('Invalid npub format');
      }
    } else if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
      setManualNpubError(null);
      applyNpub(trimmed);
    } else {
      setManualNpubError('Must be 64-char hex or npub1...');
    }
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

        {/* Alby login */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            marginLeft: '12px',
            padding: '6px 12px',
            backgroundColor: userNpub ? 'rgba(255, 152, 0, 0.1)' : 'rgba(117, 117, 117, 0.1)',
            borderRadius: '20px',
            fontSize: '12px',
          }}
        >
          {userNpub ? (
            <span style={{ color: '#FF9800' }}>⚡ {userNpubDisplay?.slice(0, 12)}...</span>
          ) : (
            <button
              onClick={handleConnectAlby}
              disabled={albyDetecting}
              style={{
                background: 'none',
                border: '1px solid #FF9800',
                borderRadius: '12px',
                padding: '2px 10px',
                fontSize: '11px',
                color: '#FF9800',
                cursor: albyDetecting ? 'default' : 'pointer',
                opacity: albyDetecting ? 0.6 : 1,
              }}
            >
              {albyDetecting ? 'Detecting...' : '⚡ Login with Alby'}
            </button>
          )}
        </div>

        {/* Manual npub input */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            marginLeft: '12px',
            padding: '6px 12px',
            backgroundColor: 'rgba(147, 112, 219, 0.1)',
            borderRadius: '20px',
            fontSize: '12px',
          }}
        >
          <input
            type="text"
            placeholder="Enter your npub..."
            value={manualNpubInput}
            onChange={(e) => setManualNpubInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetNpub()}
            style={{
              background: 'none',
              border: 'none',
              color: '#9370DB',
              fontSize: '12px',
              width: '120px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSetNpub}
            style={{
              background: 'none',
              border: '1px solid #9370DB',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '11px',
              color: '#9370DB',
              cursor: 'pointer',
            }}
          >
            Set
          </button>
        </div>
        {manualNpubError && (
          <span style={{ color: '#F44336', fontSize: '11px', marginLeft: '8px' }}>
            {manualNpubError}
          </span>
        )}

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
              post={post}
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
