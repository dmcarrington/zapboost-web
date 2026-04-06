/**
 * API route helpers for authentication and tier gating.
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from './auth';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import { getTierConfig, type Tier, type TierConfig } from './tiers';

export interface AuthenticatedContext {
  pubkey: string;
  tier: Tier;
  tierConfig: TierConfig;
}

/**
 * Authenticate a request and return the user context.
 * Returns null if not authenticated (caller should return 401).
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedContext | null> {
  const pubkey = await getSessionFromRequest(request);
  if (!pubkey) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.pubkey, pubkey),
  });

  const tier = (user?.tier || 'free') as Tier;

  return {
    pubkey,
    tier,
    tierConfig: getTierConfig(tier),
  };
}

/**
 * Require authentication. Returns a 401 response if not authenticated,
 * otherwise returns the authenticated context.
 */
export async function requireAuth(request: Request): Promise<AuthenticatedContext | NextResponse> {
  const ctx = await authenticateRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return ctx;
}

/**
 * Type guard to check if requireAuth returned a response (error) or context (success).
 */
export function isAuthError(result: AuthenticatedContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
