'use client';

import { useState, useEffect } from 'react';
import { getStoredSession, authFetch, clearSession } from '@/lib/auth-client';
import { hexToNpub } from '@/lib/nostr-utils';
import { TIERS, type Tier, type TierConfig } from '@/lib/tiers';
import { truncateNpub } from '@/components/dashboard';

interface UserInfo {
  pubkey: string;
  tier: Tier;
  createdAt: string;
}

interface PaymentState {
  subscriptionId: string;
  bolt11: string | null;
  amountSats: number;
  status: 'pending' | 'paid' | 'error';
  error?: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentState | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      window.location.href = '/dashboard';
      return;
    }

    authFetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setUser(data);
      })
      .catch(() => {
        clearSession();
        window.location.href = '/dashboard';
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (tier: 'creator' | 'pro') => {
    try {
      const res = await authFetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPayment({
        subscriptionId: data.subscriptionId,
        bolt11: data.bolt11,
        amountSats: data.amountSats,
        status: 'pending',
      });
    } catch (err: any) {
      setPayment({
        subscriptionId: '',
        bolt11: null,
        amountSats: 0,
        status: 'error',
        error: err.message,
      });
    }
  };

  const handleConfirmPayment = async () => {
    if (!payment) return;

    try {
      const res = await authFetch('/api/subscribe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: payment.subscriptionId }),
      });

      const data = await res.json();

      if (data.status === 'paid') {
        setPayment({ ...payment, status: 'paid' });
        // Refresh user info
        const meRes = await authFetch('/api/auth/me');
        const meData = await meRes.json();
        setUser(meData);
      } else if (data.status === 'expired') {
        setPayment({ ...payment, status: 'error', error: 'Invoice expired. Please try again.' });
      }
      // If still pending, do nothing — user can check again
    } catch (err: any) {
      setPayment({ ...payment, status: 'error', error: err.message });
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const currentTier = TIERS[user.tier] || TIERS.free;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, color: 'var(--zap-gold)' }}>Settings</h1>
        <a
          href="/dashboard"
          style={{
            color: 'var(--text-secondary)', fontSize: 14,
            padding: '8px 16px', borderRadius: 6,
            border: '1px solid var(--border-color)',
          }}
        >
          Back to Dashboard
        </a>
      </div>

      {/* Account info */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 16 }}>Account</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Public Key</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>
            {truncateNpub(hexToNpub(user.pubkey))}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Current Plan</span>
          <TierBadge tier={user.tier} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Member Since</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Subscription plans */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 16 }}>Plans</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {(['free', 'creator', 'pro'] as Tier[]).map((tier) => {
            const config = TIERS[tier];
            const isCurrent = user.tier === tier;
            const isUpgrade = tierOrder(tier) > tierOrder(user.tier);

            return (
              <div
                key={tier}
                style={{
                  padding: 16, borderRadius: 10,
                  border: isCurrent ? '2px solid var(--zap-gold)' : '1px solid var(--border-color)',
                  background: isCurrent ? 'rgba(255, 215, 0, 0.05)' : 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {config.displayName}
                    </span>
                    {isCurrent && (
                      <span style={{ fontSize: 11, color: 'var(--zap-gold)', marginLeft: 8, fontWeight: 600 }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--zap-gold)' }}>
                    {config.priceSats === 0 ? 'Free' : `${config.priceSats.toLocaleString()} sats/mo`}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <div>History: {config.maxHistoryDays >= 365 ? `${Math.floor(config.maxHistoryDays / 365)}y` : `${config.maxHistoryDays}d`}</div>
                  <div>Top posts: {config.maxTopPosts} &middot; Top supporters: {config.maxTopSupporters}</div>
                  <div style={{ marginTop: 4 }}>
                    {Object.entries(config.features)
                      .filter(([_, v]) => v)
                      .map(([k]) => featureLabel(k))
                      .join(' · ')}
                  </div>
                </div>

                {isUpgrade && tier !== 'free' && (
                  <button
                    onClick={() => handleSubscribe(tier as 'creator' | 'pro')}
                    style={{
                      marginTop: 12, width: '100%',
                      padding: '10px 0', borderRadius: 8,
                      background: 'var(--zap-gold)', color: '#000',
                      fontSize: 14, fontWeight: 600,
                    }}
                  >
                    Upgrade to {config.displayName}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment modal */}
      {payment && payment.status !== 'paid' && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: 24, marginBottom: 24,
          border: '2px solid var(--zap-gold)',
        }}>
          <h2 style={{ fontSize: 16, color: 'var(--zap-gold)', marginBottom: 16 }}>
            Complete Payment
          </h2>

          {payment.status === 'error' ? (
            <p style={{ color: '#ff5252', marginBottom: 12 }}>{payment.error}</p>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                Pay <strong style={{ color: 'var(--zap-gold)' }}>{payment.amountSats.toLocaleString()} sats</strong> to activate your subscription.
              </p>

              {payment.bolt11 ? (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Lightning Invoice:
                  </p>
                  <div style={{
                    background: 'var(--bg-surface)', padding: 12, borderRadius: 8,
                    wordBreak: 'break-all', fontSize: 12, color: 'var(--text-primary)',
                    fontFamily: 'monospace', maxHeight: 120, overflow: 'auto',
                  }}>
                    {payment.bolt11}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(payment.bolt11!)}
                    style={{
                      marginTop: 8, padding: '6px 16px', borderRadius: 6,
                      fontSize: 13, background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                    }}
                  >
                    Copy Invoice
                  </button>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                  Development mode — click confirm to simulate payment.
                </p>
              )}

              <button
                onClick={handleConfirmPayment}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 8,
                  background: 'var(--zap-gold)', color: '#000',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {payment.bolt11 ? 'I\'ve Paid — Verify' : 'Confirm Payment (Dev)'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Payment success */}
      {payment?.status === 'paid' && (
        <div style={{
          background: 'rgba(76, 175, 80, 0.1)', borderRadius: 12, padding: 20, marginBottom: 24,
          border: '1px solid #4CAF50', textAlign: 'center',
        }}>
          <p style={{ color: '#4CAF50', fontSize: 16, fontWeight: 600 }}>
            Subscription activated!
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
            Your dashboard now has full access to premium analytics.
          </p>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: 'var(--text-muted)',
    creator: 'var(--zap-orange)',
    pro: 'var(--zap-gold)',
    platform: '#ff5252',
  };

  return (
    <span style={{
      padding: '2px 10px', borderRadius: 10,
      fontSize: 12, fontWeight: 600,
      background: `${colors[tier] || colors.free}20`,
      color: colors[tier] || colors.free,
      textTransform: 'uppercase',
    }}>
      {TIERS[tier as Tier]?.displayName || tier}
    </span>
  );
}

function tierOrder(tier: string): number {
  const order: Record<string, number> = { free: 0, creator: 1, pro: 2, platform: 3 };
  return order[tier] ?? 0;
}

function featureLabel(key: string): string {
  const labels: Record<string, string> = {
    hourlyHeatmap: 'Heatmap',
    sizeDistribution: 'Size Analysis',
    customDateRange: 'Custom Dates',
    csvExport: 'CSV Export',
    apiAccess: 'API Access',
    webhooks: 'Webhooks',
    multiNpub: 'Multi-npub',
  };
  return labels[key] || key;
}
