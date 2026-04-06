import { NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/api-auth';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';
import { hasFeature } from '@/lib/tiers';

// List API keys
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  if (!hasFeature(auth.tier, 'apiAccess')) {
    return NextResponse.json({ error: 'API access requires Pro tier or above' }, { status: 403 });
  }

  const keys = await listApiKeys(auth.pubkey);
  return NextResponse.json({ keys });
}

// Create a new API key
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  if (!hasFeature(auth.tier, 'apiAccess')) {
    return NextResponse.json({ error: 'API access requires Pro tier or above' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = body.name || 'Default';
    const key = await createApiKey(auth.pubkey, name);
    return NextResponse.json({ key, name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// Revoke an API key
export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { keyId } = body;
    if (!keyId) return NextResponse.json({ error: 'Missing keyId' }, { status: 400 });

    await revokeApiKey(auth.pubkey, keyId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
