/**
 * Subscription Tier Definitions
 * Defines features and limits for each subscription tier
 */

export const TIER_LIMITS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    effects: 3, // Max effects in chain
    recordings: 5, // Max recordings
    storageBytes: 100 * 1024 * 1024, // 100MB
    aiRequestsPerMonth: 10,
    maxRecordingDuration: 60, // seconds
    maxFileSize: 10 * 1024 * 1024, // 10MB
    teams: false,
    customEffects: false,
    prioritySupport: false,
    apiAccess: false,
    advancedAnalytics: false,
    exportFormats: ['wav'] as const,
  },
  pro: {
    name: 'Pro',
    price: 999, // $9.99 in cents
    priceId: process.env.STRIPE_PRICE_PRO || 'price_pro',
    effects: 10,
    recordings: 50,
    storageBytes: 2 * 1024 * 1024 * 1024, // 2GB
    aiRequestsPerMonth: 100,
    maxRecordingDuration: 300, // 5 minutes
    maxFileSize: 50 * 1024 * 1024, // 50MB
    teams: false,
    customEffects: true,
    prioritySupport: false,
    apiAccess: true,
    advancedAnalytics: true,
    exportFormats: ['wav', 'mp3', 'ogg'] as const,
  },
  studio: {
    name: 'Studio',
    price: 1999, // $19.99 in cents
    priceId: process.env.STRIPE_PRICE_STUDIO || 'price_studio',
    effects: -1, // Unlimited
    recordings: -1, // Unlimited
    storageBytes: 20 * 1024 * 1024 * 1024, // 20GB
    aiRequestsPerMonth: -1, // Unlimited
    maxRecordingDuration: -1, // Unlimited
    maxFileSize: 200 * 1024 * 1024, // 200MB
    teams: true,
    customEffects: true,
    prioritySupport: true,
    apiAccess: true,
    advancedAnalytics: true,
    exportFormats: ['wav', 'mp3', 'ogg', 'flac'] as const,
  },
} as const;

export type TierName = keyof typeof TIER_LIMITS;
export type TierConfig = (typeof TIER_LIMITS)[TierName];

/**
 * Get tier configuration
 */
export function getTierConfig(tier: TierName): TierConfig {
  return TIER_LIMITS[tier];
}

/**
 * Check if a feature is available for a tier
 */
export function hasFeature(tier: TierName, feature: keyof TierConfig): boolean {
  const config = TIER_LIMITS[tier];
  const value = config[feature];

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return !!value;
}

/**
 * Check if usage is within tier limits
 */
export function isWithinLimit(
  tier: TierName,
  limitType: 'effects' | 'recordings' | 'storageBytes' | 'aiRequestsPerMonth',
  currentUsage: number
): boolean {
  const limit = TIER_LIMITS[tier][limitType];
  if (limit === -1) return true; // Unlimited
  return currentUsage < limit;
}

/**
 * Get remaining quota for a limit type
 */
export function getRemainingQuota(
  tier: TierName,
  limitType: 'effects' | 'recordings' | 'storageBytes' | 'aiRequestsPerMonth',
  currentUsage: number
): number {
  const limit = TIER_LIMITS[tier][limitType];
  if (limit === -1) return Infinity;
  return Math.max(0, limit - currentUsage);
}

/**
 * Format storage size for display
 */
export function formatStorage(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)}GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  }
  return `${(bytes / 1024).toFixed(0)}KB`;
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}/mo`;
}

/**
 * Get upgrade recommendations
 */
export function getUpgradeReason(
  currentTier: TierName,
  limitType: 'effects' | 'recordings' | 'storageBytes' | 'aiRequestsPerMonth'
): { upgradeTo: TierName; benefit: string } | null {
  const tiers: TierName[] = ['free', 'pro', 'studio'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex >= tiers.length - 1) return null;

  const nextTier = tiers[currentIndex + 1];
  const currentLimit = TIER_LIMITS[currentTier][limitType];
  const nextLimit = TIER_LIMITS[nextTier][limitType];

  if (currentLimit === -1) return null; // Already unlimited

  const benefits: Record<string, string> = {
    effects: nextLimit === -1 ? 'unlimited effects' : `${nextLimit} effects`,
    recordings: nextLimit === -1 ? 'unlimited recordings' : `${nextLimit} recordings`,
    storageBytes: formatStorage(nextLimit as number),
    aiRequestsPerMonth: nextLimit === -1 ? 'unlimited AI requests' : `${nextLimit} AI requests/month`,
  };

  return {
    upgradeTo: nextTier,
    benefit: benefits[limitType],
  };
}

/**
 * Tier feature comparison for pricing page
 */
export const TIER_FEATURES = [
  {
    name: 'Effect chain size',
    free: '3 effects',
    pro: '10 effects',
    studio: 'Unlimited',
  },
  {
    name: 'Recordings',
    free: '5 recordings',
    pro: '50 recordings',
    studio: 'Unlimited',
  },
  {
    name: 'Storage',
    free: '100MB',
    pro: '2GB',
    studio: '20GB',
  },
  {
    name: 'AI suggestions',
    free: '10/month',
    pro: '100/month',
    studio: 'Unlimited',
  },
  {
    name: 'Max recording length',
    free: '1 minute',
    pro: '5 minutes',
    studio: 'Unlimited',
  },
  {
    name: 'Export formats',
    free: 'WAV',
    pro: 'WAV, MP3, OGG',
    studio: 'WAV, MP3, OGG, FLAC',
  },
  {
    name: 'Team workspaces',
    free: false,
    pro: false,
    studio: true,
  },
  {
    name: 'Custom effects',
    free: false,
    pro: true,
    studio: true,
  },
  {
    name: 'API access',
    free: false,
    pro: true,
    studio: true,
  },
  {
    name: 'Advanced analytics',
    free: false,
    pro: true,
    studio: true,
  },
  {
    name: 'Priority support',
    free: false,
    pro: false,
    studio: true,
  },
] as const;
