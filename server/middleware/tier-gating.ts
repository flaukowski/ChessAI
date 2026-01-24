/**
 * Tier Gating Middleware
 * Enforces subscription limits and feature access
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import {
  subscriptions,
  usageRecords,
  recordings,
} from '../../shared/schema';
import { TIER_LIMITS, TierName, isWithinLimit, getUpgradeReason } from '../../shared/tiers';

// Extend Express Request to include tier info
declare global {
  namespace Express {
    interface Request {
      tier?: TierName;
      tierLimits?: (typeof TIER_LIMITS)[TierName];
      usage?: {
        recordings: number;
        storageBytes: number;
        aiRequests: number;
        effectsInChain?: number;
      };
    }
  }
}

/**
 * Load user's tier information
 */
export async function loadTierInfo(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    req.tier = 'free';
    req.tierLimits = TIER_LIMITS.free;
    return next();
  }

  const userId = (req.user as any).id;

  try {
    // Get subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const tier = (subscription?.tier as TierName) || 'free';

    // Check if subscription is active
    const isActive = !subscription ||
      subscription.status === 'active' ||
      subscription.status === 'trialing';

    req.tier = isActive ? tier : 'free';
    req.tierLimits = TIER_LIMITS[req.tier];

    next();
  } catch (error) {
    console.error('[TierGating] Error loading tier info:', error);
    req.tier = 'free';
    req.tierLimits = TIER_LIMITS.free;
    next();
  }
}

/**
 * Load user's current usage
 */
export async function loadUsage(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    req.usage = { recordings: 0, storageBytes: 0, aiRequests: 0 };
    return next();
  }

  const userId = (req.user as any).id;

  try {
    // Count recordings
    const recordingCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings)
      .where(eq(recordings.userId, userId));
    const recordingCount = Number(recordingCountResult[0]?.count || 0);

    // Sum storage
    const storageResult = await db
      .select({ total: sql<number>`coalesce(sum(file_size), 0)` })
      .from(recordings)
      .where(eq(recordings.userId, userId));
    const storageBytes = Number(storageResult[0]?.total || 0);

    // Get AI requests this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const aiUsageResult = await db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, userId),
          eq(usageRecords.usageType, 'ai_requests'),
          gte(usageRecords.periodStart, monthStart),
          lte(usageRecords.periodEnd, monthEnd)
        )
      );
    const aiRequests = aiUsageResult.reduce((sum: number, r: typeof aiUsageResult[0]) => sum + r.quantity, 0);

    req.usage = {
      recordings: recordingCount,
      storageBytes,
      aiRequests,
    };

    next();
  } catch (error) {
    console.error('[TierGating] Error loading usage:', error);
    req.usage = { recordings: 0, storageBytes: 0, aiRequests: 0 };
    next();
  }
}

/**
 * Require a specific feature
 */
export function requireFeature(feature: keyof (typeof TIER_LIMITS)['free']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const limits = req.tierLimits || TIER_LIMITS.free;
    const value = limits[feature];

    // Check boolean features
    if (typeof value === 'boolean' && !value) {
      return res.status(403).json({
        error: 'Feature not available',
        feature,
        currentTier: req.tier,
        upgrade: getUpgradeRecommendation(req.tier || 'free', feature),
      });
    }

    next();
  };
}

/**
 * Check recording limit before creating new recording
 */
export function checkRecordingLimit(req: Request, res: Response, next: NextFunction) {
  const limits = req.tierLimits || TIER_LIMITS.free;
  const usage = req.usage || { recordings: 0, storageBytes: 0, aiRequests: 0 };

  // -1 means unlimited
  if (limits.recordings !== -1 && usage.recordings >= limits.recordings) {
    return res.status(403).json({
      error: 'Recording limit reached',
      currentUsage: usage.recordings,
      limit: limits.recordings,
      currentTier: req.tier,
      upgrade: getUpgradeReason(req.tier || 'free', 'recordings'),
    });
  }

  next();
}

/**
 * Check storage limit before uploading
 */
export function checkStorageLimit(additionalBytes?: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const limits = req.tierLimits || TIER_LIMITS.free;
    const usage = req.usage || { recordings: 0, storageBytes: 0, aiRequests: 0 };
    const fileSize = additionalBytes || (req.body?.fileSize as number) || 0;

    // -1 means unlimited
    if (limits.storageBytes !== -1 && (usage.storageBytes + fileSize) > limits.storageBytes) {
      return res.status(403).json({
        error: 'Storage limit reached',
        currentUsage: usage.storageBytes,
        limit: limits.storageBytes,
        additionalRequired: fileSize,
        currentTier: req.tier,
        upgrade: getUpgradeReason(req.tier || 'free', 'storageBytes'),
      });
    }

    next();
  };
}

/**
 * Check file size limit
 */
export function checkFileSizeLimit(req: Request, res: Response, next: NextFunction) {
  const limits = req.tierLimits || TIER_LIMITS.free;
  const fileSize = (req.body?.fileSize as number) || (req.file?.size) || 0;

  if (limits.maxFileSize !== -1 && fileSize > limits.maxFileSize) {
    return res.status(403).json({
      error: 'File size exceeds limit',
      fileSize,
      limit: limits.maxFileSize,
      currentTier: req.tier,
    });
  }

  next();
}

/**
 * Check AI request limit
 */
export async function checkAIRequestLimit(req: Request, res: Response, next: NextFunction) {
  const limits = req.tierLimits || TIER_LIMITS.free;
  const usage = req.usage || { recordings: 0, storageBytes: 0, aiRequests: 0 };

  // -1 means unlimited
  if (limits.aiRequestsPerMonth !== -1 && usage.aiRequests >= limits.aiRequestsPerMonth) {
    return res.status(403).json({
      error: 'AI request limit reached',
      currentUsage: usage.aiRequests,
      limit: limits.aiRequestsPerMonth,
      currentTier: req.tier,
      upgrade: getUpgradeReason(req.tier || 'free', 'aiRequestsPerMonth'),
    });
  }

  next();
}

/**
 * Check recording duration limit
 */
export function checkDurationLimit(req: Request, res: Response, next: NextFunction) {
  const limits = req.tierLimits || TIER_LIMITS.free;
  const duration = (req.body?.duration as number) || 0;

  if (limits.maxRecordingDuration !== -1 && duration > limits.maxRecordingDuration) {
    return res.status(403).json({
      error: 'Recording duration exceeds limit',
      duration,
      limit: limits.maxRecordingDuration,
      currentTier: req.tier,
    });
  }

  next();
}

/**
 * Check effect chain size limit
 */
export function checkEffectChainLimit(req: Request, res: Response, next: NextFunction) {
  const limits = req.tierLimits || TIER_LIMITS.free;
  const effectChain = req.body?.effectChain as any[];
  const effectCount = effectChain?.length || 0;

  if (limits.effects !== -1 && effectCount > limits.effects) {
    return res.status(403).json({
      error: 'Effect chain size exceeds limit',
      effectCount,
      limit: limits.effects,
      currentTier: req.tier,
      upgrade: getUpgradeReason(req.tier || 'free', 'effects'),
    });
  }

  next();
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  userId: string,
  usageType: 'recordings' | 'storage_bytes' | 'ai_requests',
  quantity: number = 1
) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Try to update existing record
  const existing = await db
    .select()
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.usageType, usageType),
        gte(usageRecords.periodStart, periodStart),
        lte(usageRecords.periodEnd, periodEnd)
      )
    );

  if (existing.length > 0) {
    await db
      .update(usageRecords)
      .set({
        quantity: existing[0].quantity + quantity,
        updatedAt: new Date(),
      })
      .where(eq(usageRecords.id, existing[0].id));
  } else {
    await db.insert(usageRecords).values({
      userId,
      usageType,
      quantity,
      periodStart,
      periodEnd,
    });
  }
}

/**
 * Get upgrade recommendation for a feature
 */
function getUpgradeRecommendation(
  currentTier: TierName,
  feature: string
): { tier: TierName; benefit: string } | null {
  const tiers: TierName[] = ['free', 'pro', 'studio'];
  const currentIndex = tiers.indexOf(currentTier);

  if (currentIndex >= tiers.length - 1) return null;

  for (let i = currentIndex + 1; i < tiers.length; i++) {
    const nextTier = tiers[i];
    const nextLimits = TIER_LIMITS[nextTier];
    const currentLimits = TIER_LIMITS[currentTier];

    // Check if upgrade provides better value for this feature
    const nextValue = nextLimits[feature as keyof typeof nextLimits];
    const currentValue = currentLimits[feature as keyof typeof currentLimits];

    if (nextValue !== currentValue) {
      let benefit = '';
      if (typeof nextValue === 'boolean' && nextValue) {
        benefit = `Unlock ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
      } else if (typeof nextValue === 'number') {
        benefit = nextValue === -1 ? 'Unlimited' : `${nextValue}`;
      }
      return { tier: nextTier, benefit };
    }
  }

  return null;
}

/**
 * Combined middleware for common routes
 */
export const withTierGating = [loadTierInfo, loadUsage];

/**
 * Middleware for recording creation
 */
export const withRecordingLimits = [
  ...withTierGating,
  checkRecordingLimit,
  checkStorageLimit(),
  checkFileSizeLimit,
  checkDurationLimit,
];

/**
 * Middleware for AI requests
 */
export const withAILimits = [
  ...withTierGating,
  checkAIRequestLimit,
];

/**
 * Middleware for preset creation with effect chain
 */
export const withPresetLimits = [
  ...withTierGating,
  checkEffectChainLimit,
];
