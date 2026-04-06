/**
 * Lightning billing for ZapBoost subscriptions.
 *
 * Supports two backends:
 * 1. LNbits — self-hosted or hosted Lightning wallet with REST API
 * 2. Manual — generates a payment hash, user pays via any method (for development)
 *
 * Set LNBITS_URL and LNBITS_API_KEY environment variables to enable LNbits.
 * Without them, the system runs in manual/development mode.
 */

import { db } from './db';
import { subscriptions, users } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { type Tier, TIERS } from './tiers';

const LNBITS_URL = process.env.LNBITS_URL;
const LNBITS_API_KEY = process.env.LNBITS_API_KEY;
const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface InvoiceResult {
  subscriptionId: string;
  bolt11: string | null;
  paymentHash: string;
  amountSats: number;
  expiresAt: Date;
}

/**
 * Create a subscription invoice for a user.
 */
export async function createSubscriptionInvoice(
  pubkey: string,
  tier: 'creator' | 'pro'
): Promise<InvoiceResult> {
  const tierConfig = TIERS[tier];
  const amountSats = tierConfig.priceSats;
  const subscriptionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SUBSCRIPTION_DURATION_MS);

  let bolt11: string | null = null;
  let paymentHash: string;

  if (LNBITS_URL && LNBITS_API_KEY) {
    // Create real Lightning invoice via LNbits
    const res = await fetch(`${LNBITS_URL}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': LNBITS_API_KEY,
      },
      body: JSON.stringify({
        out: false,
        amount: amountSats,
        memo: `ZapBoost ${tierConfig.displayName} subscription (30 days)`,
        expiry: 3600, // 1 hour to pay
      }),
    });

    if (!res.ok) {
      throw new Error(`LNbits invoice creation failed: ${res.statusText}`);
    }

    const data = await res.json();
    bolt11 = data.bolt11 || data.payment_request;
    paymentHash = data.payment_hash;
  } else {
    // Development mode — generate a mock payment hash
    paymentHash = crypto.randomUUID().replace(/-/g, '');
    console.log(`[billing] Dev mode: subscription ${subscriptionId} for ${pubkey}, ${amountSats} sats`);
    console.log(`[billing] Dev mode: call POST /api/subscribe/confirm with { subscriptionId: "${subscriptionId}" } to simulate payment`);
  }

  // Store subscription record
  await db.insert(subscriptions).values({
    id: subscriptionId,
    pubkey,
    tier,
    amountSats,
    status: 'pending',
    paymentHash,
    bolt11,
    expiresAt,
  });

  return {
    subscriptionId,
    bolt11,
    paymentHash,
    amountSats,
    expiresAt,
  };
}

/**
 * Check payment status and activate subscription if paid.
 * For LNbits, checks the payment status via API.
 * For dev mode, this is called directly to simulate payment.
 */
export async function checkAndActivatePayment(subscriptionId: string): Promise<{
  status: 'paid' | 'pending' | 'expired' | 'not_found';
  tier?: string;
}> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, subscriptionId),
  });

  if (!sub) return { status: 'not_found' };
  if (sub.status === 'paid') return { status: 'paid', tier: sub.tier };

  let isPaid = false;

  if (LNBITS_URL && LNBITS_API_KEY && sub.paymentHash) {
    // Check LNbits for payment status
    const res = await fetch(`${LNBITS_URL}/api/v1/payments/${sub.paymentHash}`, {
      headers: { 'X-Api-Key': LNBITS_API_KEY },
    });

    if (res.ok) {
      const data = await res.json();
      isPaid = data.paid === true;
    }
  } else {
    // Dev mode — auto-confirm when this endpoint is hit
    isPaid = true;
  }

  if (isPaid) {
    // Mark subscription as paid
    await db.update(subscriptions)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));

    // Upgrade user tier
    await db.update(users)
      .set({ tier: sub.tier })
      .where(eq(users.pubkey, sub.pubkey));

    return { status: 'paid', tier: sub.tier };
  }

  // Check if invoice expired (created more than 1 hour ago and still pending)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (sub.createdAt < oneHourAgo) {
    await db.update(subscriptions)
      .set({ status: 'expired' })
      .where(eq(subscriptions.id, subscriptionId));
    return { status: 'expired' };
  }

  return { status: 'pending' };
}

/**
 * Get the active subscription for a user (if any).
 */
export async function getActiveSubscription(pubkey: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.pubkey, pubkey),
      eq(subscriptions.status, 'paid'),
    ),
    orderBy: (subscriptions, { desc }) => [desc(subscriptions.paidAt)],
  });

  if (!sub) return null;

  // Check if expired
  if (new Date(sub.expiresAt) < new Date()) {
    // Downgrade user to free
    await db.update(users)
      .set({ tier: 'free' })
      .where(eq(users.pubkey, pubkey));
    await db.update(subscriptions)
      .set({ status: 'expired' })
      .where(eq(subscriptions.id, sub.id));
    return null;
  }

  return sub;
}
