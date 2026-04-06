import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { createSubscriptionInvoice } from '@/lib/billing';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { tier } = body;

    if (tier !== 'creator' && tier !== 'pro') {
      return NextResponse.json({ error: 'Invalid tier. Must be "creator" or "pro".' }, { status: 400 });
    }

    const invoice = await createSubscriptionInvoice(auth.pubkey, tier);

    return NextResponse.json({
      subscriptionId: invoice.subscriptionId,
      bolt11: invoice.bolt11,
      paymentHash: invoice.paymentHash,
      amountSats: invoice.amountSats,
      expiresAt: invoice.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
