/**
 * Subscription tier definitions and feature gating.
 */

export type Tier = 'free' | 'creator' | 'pro' | 'platform';

export interface TierConfig {
  name: string;
  displayName: string;
  priceSats: number; // monthly price in sats (0 = free)
  maxHistoryDays: number;
  maxTopPosts: number;
  maxTopSupporters: number;
  features: {
    hourlyHeatmap: boolean;
    sizeDistribution: boolean;
    customDateRange: boolean;
    csvExport: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    multiNpub: boolean;
  };
}

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    name: 'free',
    displayName: 'Free',
    priceSats: 0,
    // Demo deployment: give free-tier users a full year of history so the
    // dashboard actually shows something on fresh signups. Tighten this if
    // you ever want to re-enable the paywall on history depth.
    maxHistoryDays: 365,
    maxTopPosts: 5,
    maxTopSupporters: 5,
    features: {
      hourlyHeatmap: false,
      sizeDistribution: false,
      customDateRange: false,
      csvExport: false,
      apiAccess: false,
      webhooks: false,
      multiNpub: false,
    },
  },
  creator: {
    name: 'creator',
    displayName: 'Creator',
    priceSats: 10_000,
    maxHistoryDays: 365,
    maxTopPosts: 20,
    maxTopSupporters: 20,
    features: {
      hourlyHeatmap: true,
      sizeDistribution: true,
      customDateRange: true,
      csvExport: true,
      apiAccess: false,
      webhooks: false,
      multiNpub: false,
    },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceSats: 50_000,
    maxHistoryDays: 365 * 3,
    maxTopPosts: 50,
    maxTopSupporters: 50,
    features: {
      hourlyHeatmap: true,
      sizeDistribution: true,
      customDateRange: true,
      csvExport: true,
      apiAccess: true,
      webhooks: true,
      multiNpub: true,
    },
  },
  platform: {
    name: 'platform',
    displayName: 'Platform',
    priceSats: 0, // custom pricing
    maxHistoryDays: 365 * 5,
    maxTopPosts: 100,
    maxTopSupporters: 100,
    features: {
      hourlyHeatmap: true,
      sizeDistribution: true,
      customDateRange: true,
      csvExport: true,
      apiAccess: true,
      webhooks: true,
      multiNpub: true,
    },
  },
};

export function getTierConfig(tier: string): TierConfig {
  return TIERS[tier as Tier] || TIERS.free;
}

/**
 * Check if a tier has access to a specific feature.
 */
export function hasFeature(tier: string, feature: keyof TierConfig['features']): boolean {
  return getTierConfig(tier).features[feature];
}

/**
 * Clamp the requested days to the tier's max history.
 */
export function clampDays(tier: string, requestedDays: number): number {
  const config = getTierConfig(tier);
  return Math.min(requestedDays, config.maxHistoryDays);
}
