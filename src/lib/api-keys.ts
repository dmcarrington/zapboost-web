/**
 * API key management for the v1 bulk API.
 * API keys are prefixed with zb_live_ (production) or zb_test_ (development).
 */

import { db } from './db';
import { apiKeys, users } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getTierConfig, type Tier, type TierConfig } from './tiers';

interface ApiKeyContext {
  keyId: string;
  pubkey: string;
  tier: Tier;
  tierConfig: TierConfig;
  rateLimit: number;
}

/**
 * Generate a new API key for a user.
 */
export async function createApiKey(pubkey: string, name: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.pubkey, pubkey),
  });

  const tier = (user?.tier || 'free') as Tier;
  const tierConfig = getTierConfig(tier);

  if (!tierConfig.features.apiAccess) {
    throw new Error('API access requires Pro tier or above');
  }

  const prefix = process.env.NODE_ENV === 'production' ? 'zb_live_' : 'zb_test_';
  const key = prefix + crypto.randomUUID().replace(/-/g, '');

  const rateLimits: Record<string, number> = {
    pro: 100,
    platform: 1000,
  };

  await db.insert(apiKeys).values({
    id: key,
    pubkey,
    name,
    tier,
    rateLimit: rateLimits[tier] || 100,
  });

  return key;
}

/**
 * Authenticate an API request by its API key.
 * Expects the key in the X-API-Key header or as ?api_key query param.
 */
export async function authenticateApiKey(request: Request): Promise<ApiKeyContext | null> {
  const headerKey = request.headers.get('X-API-Key');
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('api_key');
  const key = headerKey || queryKey;

  if (!key) return null;

  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.id, key),
      isNull(apiKeys.revokedAt),
    ),
  });

  if (!apiKey) return null;

  // Update last used timestamp (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key))
    .catch(() => {});

  const tier = apiKey.tier as Tier;

  return {
    keyId: apiKey.id,
    pubkey: apiKey.pubkey,
    tier,
    tierConfig: getTierConfig(tier),
    rateLimit: apiKey.rateLimit,
  };
}

/**
 * List all API keys for a user.
 */
export async function listApiKeys(pubkey: string) {
  const keys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.pubkey, pubkey),
      isNull(apiKeys.revokedAt),
    ),
  });

  // Return keys with masked values (only show last 8 chars)
  return keys.map((k) => ({
    id: k.id.slice(0, 8) + '...' + k.id.slice(-8),
    name: k.name,
    tier: k.tier,
    rateLimit: k.rateLimit,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }));
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(pubkey: string, keyPrefix: string) {
  // Find the key that matches the prefix for this user
  const allKeys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.pubkey, pubkey),
      isNull(apiKeys.revokedAt),
    ),
  });

  const key = allKeys.find((k) => k.id.startsWith(keyPrefix) || k.id.endsWith(keyPrefix.replace('...', '')));
  if (!key) throw new Error('API key not found');

  await db.update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, key.id));
}
