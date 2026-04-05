'use client';

import React, { useEffect, useState } from 'react';
import { TrendingPost } from '@/lib/nostr';
import { VelocityBadge } from '@/components/VelocityBadge';
import { TrendingPostCard } from '@/components/TrendingPostCard';
import { isAlbyInstalled, sendZap, connectAlby } from '@/lib/alby';
import * as nip19 from 'nostr-tools/nip19';

import { zapBoostClient } from '@/lib/nostr';

export default function HomePage() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [albyConnected, setAlbyConnected] = useState(false);
  const [userNpub, setUserNpub] = useState<string | null>(null);
  const [userNpubDisplay, setUserNpubDisplay] = useState<string | null>(null);
  const [manualNpubInput, setManualNpubInput] = useState<string>('');
  const [manualNpubError, setManualNpubError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to Nostr relays
    zapBoostClient.connect().then(() => {
      setIsConnected(zapBoostClient.getIsConnected());
      setIsLoading(false);
      console.log('Connected to', zapBoostClient.getRelayCount(), 'relays');
    });

    // Subscribe to updates
    const unsubscribe = zapBoostClient.subscribe((posts) => {
      setTrendingPosts(posts);
      setIsConnected(zapBoostClient.getIsConnected());
      // Update userNpub from the first post
      if (posts.length > 0) {
        const firstPost = posts[0];
        if (firstPost.recipientNpub && !userNpub) {
          setUserNpub(firstPost.recipientNpub);
          console.log('User npub:', firstPost.recipientNpub);
        }
      }
    });

    // Check Alby status
    setAlbyConnected(isAlbyInstalled());

    // Cleanup on unmount
    return () => {
      unsubscribe();
      zapBoostClient.disconnect();
    };
  }, []);

  // Update display when userNpub changes
  useEffect(() => {
    if (userNpub) {
      // Convert hex pubkey to npub format using nip19
      const npub = nip19.npubEncode(userNpub);
      setUserNpubDisplay(npub);
      console.log('User npub display:', npub);
      // Set myNpub in client to filter zaps
      zapBoostClient.setMyNpub(npub);
    }
  }, [userNpub]);

  const handleConnectAlby = async () => {
    const nwcUrl = await connectAlby();
    if (nwcUrl || isAlbyInstalled()) {
      setAlbyConnected(true);
    }
  };

  const handleSetNpub = () => {
    if (manualNpubInput) {
      // Validate it's a valid npub format
      if (manualNpubInput.startsWith('npub1')) {
        setUserNpub(manualNpubInput);
        setUserNpubDisplay(manualNpubInput);
        zapBoostClient.setMyNpub(manualNpubInput);
        setManualNpubError(null);
        console.log('Manual npub set:', manualNpubInput);
      } else {
        setManualNpubError('Invalid npub format. Must start with npub1');
      }
    }
  };

  const handleZap = async (postId: string, amountSats: number) => {
    const post = trendingPosts.find((p) => p.postId === postId);
    if (!post?.recipientNpub) {
      alert('No recipient for this zap');
      return;
    }

    try {
      const success = await sendZap(amountSats, post.recipientNpub, postId);
      if (success) {
        alert(`⚡ Zap sent! ${amountSats} sats to ${post.recipientNpub.slice(0, 8)}...`);
      } else {
        // Alby not available, show fallback
        alert(
          `Zap request for ${amountSats} sats\n\nRecipient: ${post.recipientNpub}\nPost: ${postId}\n\nInstall Alby (getalby.com) for one-tap zaps!`
        );
      }
    } catch (error) {
      console.error('Zap failed:', error);
      alert(`Zap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        {/* Alby wallet status */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            marginLeft: '12px',
            padding: '6px 12px',
            backgroundColor: albyConnected ? 'rgba(255, 152, 0, 0.1)' : 'rgba(117, 117, 117, 0.1)',
            borderRadius: '20px',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: albyConnected ? '#FF9800' : '#757575',
            }}
          />
          <span style={{ color: albyConnected ? '#FF9800' : '#757575' }}>
            {albyConnected ? '⚡ Alby ready' : 'Wallet disconnected'}
          </span>
          {!albyConnected && (
            <button
              onClick={handleConnectAlby}
              style={{
                marginLeft: '8px',
                background: 'none',
                border: '1px solid #FF9800',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px',
                color: '#FF9800',
                cursor: 'pointer',
              }}
            >
              Connect
            </button>
          )}
        </div>

        {/* User npub (first post recipient) */}
        {userNpubDisplay && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              marginLeft: '12px',
              padding: '6px 12px',
              backgroundColor: 'rgba(100, 149, 237, 0.1)',
              borderRadius: '20px',
              fontSize: '12px',
            }}
          >
            <span style={{ color: '#6495ED' }}>
              👤 Scanning: {userNpubDisplay.slice(0, 12)}...
            </span>
          </div>
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
