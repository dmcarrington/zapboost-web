'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  StatCards, RevenueChart, HeatmapChart, SizeDistribution,
  SupporterLeaderboard, PostPerformance, DateRangePicker,
  truncateNpub,
} from '@/components/dashboard';
import type { Stats, HourlyStats } from '@/components/dashboard';
import { getStoredSession, loginWithNostr, logout, isNip07Available, authFetch } from '@/lib/auth-client';
import { hexToNpub } from '@/lib/nostr-utils';
import { TIERS, type Tier } from '@/lib/tiers';

const TIER_COLORS: Record<string, string> = {
  free: 'var(--text-muted)',
  creator: 'var(--zap-orange)',
  pro: 'var(--zap-gold)',
  platform: '#ff5252',
};

function UpgradePrompt({ feature, requiredTier }: { feature: string; requiredTier: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12, padding: 24, marginBottom: 24,
      border: '1px dashed var(--border-color)', textAlign: 'center',
    }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
        {feature} requires {TIERS[requiredTier as Tier]?.displayName || requiredTier} plan
      </p>
      <a
        href="/dashboard/settings"
        style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: 6,
          background: 'var(--zap-gold)', color: '#000',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}
      >
        Upgrade
      </a>
    </div>
  );
}

export default function DashboardPage() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>('free');
  const [stats, setStats] = useState<Stats | null>(null);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setPubkey(session.pubkey);
      // Fetch user tier
      authFetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => { if (data.tier) setTier(data.tier); })
        .catch(() => {});
    } else {
      setLoading(false);
    }
  }, []);

  const tierConfig = TIERS[tier];

  const fetchData = useCallback(async (pk: string, d: number) => {
    setLoading(true);
    setError(null);
    try {
      const fetches: Promise<Response>[] = [
        authFetch(`/api/stats/${pk}?days=${d}`),
      ];
      // Only fetch hourly if tier supports it
      fetches.push(authFetch(`/api/stats/${pk}/hourly?days=${d}`));

      const [statsRes, hourlyRes] = await Promise.all(fetches);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      const statsData = await statsRes.json();
      setStats(statsData);
      // Update tier from API response if available
      if (statsData.tier) setTier(statsData.tier);

      if (hourlyRes && hourlyRes.ok) {
        const hourlyData = await hourlyRes.json();
        setHourlyStats(hourlyData);
      } else {
        setHourlyStats(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pubkey) fetchData(pubkey, days);
  }, [pubkey, days, fetchData]);

  const handleLogin = async () => {
    try {
      setError(null);
      const { pubkey: pk } = await loginWithNostr();
      setPubkey(pk);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    setPubkey(null);
    setStats(null);
    setHourlyStats(null);
    setTier('free');
    // Kick the user back to the landing page with no filter applied.
    window.location.href = '/';
  };

  // Unauthenticated state
  if (!pubkey) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, marginBottom: 8, color: 'var(--zap-gold)' }}>
          ZapBoost Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 16 }}>
          Analytics for your Nostr zap earnings. Sign in with your Nostr identity.
        </p>

        {isNip07Available() ? (
          <button
            onClick={handleLogin}
            style={{
              background: 'var(--zap-gold)',
              color: '#000',
              padding: '14px 32px',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Sign in with Nostr
          </button>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>
            <p>Install a NIP-07 browser extension to sign in.</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Recommended: Alby or nos2x
            </p>
          </div>
        )}

        {error && (
          <p style={{ color: '#ff5252', marginTop: 16 }}>{error}</p>
        )}

        <div style={{ marginTop: 48 }}>
          <a href="/" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Back to trending feed
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, color: 'var(--zap-gold)' }}>
              ZapBoost Dashboard
            </h1>
            <span style={{
              padding: '2px 10px', borderRadius: 10,
              fontSize: 11, fontWeight: 600,
              background: `${TIER_COLORS[tier]}20`,
              color: TIER_COLORS[tier],
              textTransform: 'uppercase',
            }}>
              {tierConfig.displayName}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {truncateNpub(hexToNpub(pubkey))}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a
            href="/"
            style={{
              color: 'var(--text-secondary)', fontSize: 14,
              padding: '8px 16px', borderRadius: 6,
              border: '1px solid var(--border-color)',
            }}
          >
            Trending Feed
          </a>
          <a
            href="/dashboard/settings"
            style={{
              color: 'var(--text-secondary)', fontSize: 14,
              padding: '8px 16px', borderRadius: 6,
              border: '1px solid var(--border-color)',
            }}
          >
            Settings
          </a>
          <button
            onClick={handleLogout}
            style={{
              color: 'var(--text-muted)', fontSize: 14,
              padding: '8px 16px', borderRadius: 6,
              border: '1px solid var(--border-color)',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Date range picker */}
      <DateRangePicker
        days={days}
        onDaysChange={setDays}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />

      {/* Tier limit notice */}
      {stats && stats.period && (stats as any).period?.clamped && (
        <div style={{
          background: 'rgba(255, 152, 0, 0.1)', borderRadius: 8, padding: '10px 16px',
          marginBottom: 16, fontSize: 13, color: 'var(--zap-orange)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>
            Your {tierConfig.displayName} plan supports up to {tierConfig.maxHistoryDays} days of history.
          </span>
          {tier === 'free' && (
            <a href="/dashboard/settings" style={{ color: 'var(--zap-gold)', fontWeight: 600, fontSize: 13 }}>
              Upgrade
            </a>
          )}
        </div>
      )}

      {loading && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          Loading analytics...
        </p>
      )}

      {error && (
        <p style={{ color: '#ff5252', textAlign: 'center', padding: 40 }}>{error}</p>
      )}

      {stats && !loading && (
        <>
          {/* Summary stats */}
          <StatCards
            sats={stats.totals.sats}
            zaps={stats.totals.zaps}
            avgZapSize={stats.totals.avgZapSize}
            uniqueSupporters={stats.totals.uniqueSupporters}
          />

          {/* Revenue + zap count chart */}
          <RevenueChart dailyStats={stats.dailyStats} />

          {/* Two-column: heatmap + size distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {hourlyStats ? (
              <HeatmapChart hourlyStats={hourlyStats} />
            ) : (
              <UpgradePrompt feature="Peak Zap Times heatmap" requiredTier="creator" />
            )}
            {hourlyStats ? (
              <SizeDistribution hourlyStats={hourlyStats} />
            ) : (
              <UpgradePrompt feature="Zap Size Distribution" requiredTier="creator" />
            )}
          </div>

          {/* Post performance table */}
          <PostPerformance posts={stats.topPosts} />

          {/* Supporter leaderboard */}
          <SupporterLeaderboard supporters={stats.topSupporters} />
        </>
      )}
    </div>
  );
}
