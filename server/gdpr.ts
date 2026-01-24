/**
 * GDPR Compliance Module
 * Handles data export, deletion, and consent management
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import {
  users,
  gdprConsent,
  gdprExportRequests,
  gdprDeletionRequests,
  recordings,
  userPresets,
  userAISettings,
  userSoundPreferences,
  aiEffectConversations,
  aiEffectMessages,
  auditLogs,
  loginAttempts,
  userProfiles,
  follows,
  recordingLikes,
  recordingComments,
  commentLikes,
  notifications,
  analyticsEvents,
  encryptedApiKeys,
  workspaceMembers,
  subscriptions,
  usageRecords,
  paymentHistory,
} from '../shared/schema';
import { generateSecureToken } from './encryption';
// import archiver from 'archiver'; // Uncomment when needed
// import { Writable } from 'stream';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Record user consent
 * POST /api/v1/gdpr/consent
 */
router.post('/consent', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { consentType, granted } = req.body;

    if (!['terms', 'privacy', 'marketing', 'analytics'].includes(consentType)) {
      return res.status(400).json({ error: 'Invalid consent type' });
    }

    // Withdraw any existing consent of this type
    await db
      .update(gdprConsent)
      .set({ withdrawnAt: new Date() })
      .where(
        and(
          eq(gdprConsent.userId, userId),
          eq(gdprConsent.consentType, consentType)
        )
      );

    // Record new consent
    const [consent] = await db
      .insert(gdprConsent)
      .values({
        userId,
        consentType,
        granted,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'gdpr.consent',
      resource: 'gdpr_consent',
      resourceId: consent.id,
      changes: { consentType, granted },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, consent });
  } catch (error) {
    console.error('[GDPR] Consent error:', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

/**
 * Get user's consent status
 * GET /api/v1/gdpr/consent
 */
router.get('/consent', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const consents = await db
      .select()
      .from(gdprConsent)
      .where(
        and(
          eq(gdprConsent.userId, userId),
          eq(gdprConsent.withdrawnAt, null as any)
        )
      );

    const consentMap: Record<string, boolean> = {
      terms: false,
      privacy: false,
      marketing: false,
      analytics: false,
    };

    consents.forEach((c: typeof consents[0]) => {
      consentMap[c.consentType] = c.granted;
    });

    res.json(consentMap);
  } catch (error) {
    console.error('[GDPR] Get consent error:', error);
    res.status(500).json({ error: 'Failed to get consent status' });
  }
});

/**
 * Request data export (GDPR Article 20 - Right to Data Portability)
 * POST /api/v1/gdpr/export
 */
router.post('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    // Check for existing pending request
    const existingRequest = await db
      .select()
      .from(gdprExportRequests)
      .where(
        and(
          eq(gdprExportRequests.userId, userId),
          eq(gdprExportRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return res.status(400).json({
        error: 'Export request already pending',
        requestId: existingRequest[0].id,
      });
    }

    // Create export request
    const [exportRequest] = await db
      .insert(gdprExportRequests)
      .values({
        userId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'gdpr.export_request',
      resource: 'gdpr_export_request',
      resourceId: exportRequest.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // In production, this would trigger a background job
    // For now, process immediately
    processExportRequest(exportRequest.id, userId);

    res.json({
      success: true,
      requestId: exportRequest.id,
      message: 'Export request received. You will be notified when ready.',
    });
  } catch (error) {
    console.error('[GDPR] Export request error:', error);
    res.status(500).json({ error: 'Failed to create export request' });
  }
});

/**
 * Get export request status
 * GET /api/v1/gdpr/export/:requestId
 */
router.get('/export/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { requestId } = req.params;

    const [exportRequest] = await db
      .select()
      .from(gdprExportRequests)
      .where(
        and(
          eq(gdprExportRequests.id, requestId),
          eq(gdprExportRequests.userId, userId)
        )
      );

    if (!exportRequest) {
      return res.status(404).json({ error: 'Export request not found' });
    }

    res.json(exportRequest);
  } catch (error) {
    console.error('[GDPR] Get export status error:', error);
    res.status(500).json({ error: 'Failed to get export status' });
  }
});

/**
 * Request account deletion (GDPR Article 17 - Right to Erasure)
 * POST /api/v1/gdpr/delete
 */
router.post('/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { reason } = req.body;

    // Check for existing pending request
    const existingRequest = await db
      .select()
      .from(gdprDeletionRequests)
      .where(
        and(
          eq(gdprDeletionRequests.userId, userId),
          eq(gdprDeletionRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return res.status(400).json({
        error: 'Deletion request already pending',
        requestId: existingRequest[0].id,
      });
    }

    // Create deletion request with 30-day grace period
    const scheduledDeletion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [deletionRequest] = await db
      .insert(gdprDeletionRequests)
      .values({
        userId,
        status: 'pending',
        reason,
        scheduledDeletionAt: scheduledDeletion,
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'gdpr.deletion_request',
      resource: 'gdpr_deletion_request',
      resourceId: deletionRequest.id,
      changes: { reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      requestId: deletionRequest.id,
      scheduledDeletionAt: scheduledDeletion,
      message: 'Deletion request received. Account will be deleted in 30 days. You can cancel before then.',
    });
  } catch (error) {
    console.error('[GDPR] Deletion request error:', error);
    res.status(500).json({ error: 'Failed to create deletion request' });
  }
});

/**
 * Cancel deletion request
 * DELETE /api/v1/gdpr/delete/:requestId
 */
router.delete('/delete/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { requestId } = req.params;

    const [deletionRequest] = await db
      .select()
      .from(gdprDeletionRequests)
      .where(
        and(
          eq(gdprDeletionRequests.id, requestId),
          eq(gdprDeletionRequests.userId, userId),
          eq(gdprDeletionRequests.status, 'pending')
        )
      );

    if (!deletionRequest) {
      return res.status(404).json({ error: 'Deletion request not found or already processed' });
    }

    await db
      .update(gdprDeletionRequests)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(gdprDeletionRequests.id, requestId));

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'gdpr.deletion_cancelled',
      resource: 'gdpr_deletion_request',
      resourceId: requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Deletion request cancelled' });
  } catch (error) {
    console.error('[GDPR] Cancel deletion error:', error);
    res.status(500).json({ error: 'Failed to cancel deletion request' });
  }
});

/**
 * Process data export request
 * Collects all user data and creates a downloadable archive
 */
async function processExportRequest(requestId: string, userId: string) {
  try {
    await db
      .update(gdprExportRequests)
      .set({ status: 'processing' })
      .where(eq(gdprExportRequests.id, requestId));

    // Collect all user data
    const userData: Record<string, any> = {};

    // User account
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    userData.account = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };

    // Profile
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    if (profile) userData.profile = profile;

    // Recordings
    const userRecordings = await db.select().from(recordings).where(eq(recordings.userId, userId));
    userData.recordings = userRecordings;

    // Presets
    const presets = await db.select().from(userPresets).where(eq(userPresets.userId, userId));
    userData.presets = presets;

    // AI Settings (excluding encrypted keys)
    const [aiSettings] = await db.select().from(userAISettings).where(eq(userAISettings.userId, userId));
    if (aiSettings) {
      userData.aiSettings = {
        provider: aiSettings.provider,
        baseUrl: aiSettings.baseUrl,
        model: aiSettings.model,
      };
    }

    // Sound preferences
    const [soundPrefs] = await db.select().from(userSoundPreferences).where(eq(userSoundPreferences.userId, userId));
    if (soundPrefs) userData.soundPreferences = soundPrefs;

    // AI conversations
    const conversations = await db.select().from(aiEffectConversations).where(eq(aiEffectConversations.userId, userId));
    userData.aiConversations = conversations;

    // Comments
    const comments = await db.select().from(recordingComments).where(eq(recordingComments.userId, userId));
    userData.comments = comments;

    // Likes
    const likes = await db.select().from(recordingLikes).where(eq(recordingLikes.userId, userId));
    userData.likes = likes;

    // Follows
    const following = await db.select().from(follows).where(eq(follows.followerId, userId));
    const followers = await db.select().from(follows).where(eq(follows.followingId, userId));
    userData.follows = { following, followers };

    // Consent records
    const consents = await db.select().from(gdprConsent).where(eq(gdprConsent.userId, userId));
    userData.consents = consents;

    // Login history (limited)
    const logins = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, user.email))
      .limit(100);
    userData.loginHistory = logins;

    // Subscription
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    if (subscription) {
      userData.subscription = {
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    }

    // Payment history
    const payments = await db.select().from(paymentHistory).where(eq(paymentHistory.userId, userId));
    userData.paymentHistory = payments.map((p: typeof payments[0]) => ({
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      description: p.description,
      createdAt: p.createdAt,
    }));

    // Generate download token and URL
    const downloadToken = generateSecureToken(32);
    const downloadUrl = `/api/v1/gdpr/download/${downloadToken}`;

    // Store export data (in production, upload to secure storage)
    // For now, we'll store a reference to regenerate on download
    await db
      .update(gdprExportRequests)
      .set({
        status: 'completed',
        downloadUrl,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .where(eq(gdprExportRequests.id, requestId));

    console.log(`[GDPR] Export completed for user ${userId}, request ${requestId}`);
  } catch (error) {
    console.error('[GDPR] Export processing error:', error);
    await db
      .update(gdprExportRequests)
      .set({ status: 'expired' })
      .where(eq(gdprExportRequests.id, requestId));
  }
}

/**
 * Process account deletion
 * Called by scheduled job when grace period expires
 */
export async function processAccountDeletion(userId: string) {
  console.log(`[GDPR] Starting account deletion for user ${userId}`);

  try {
    // Delete in order to respect foreign key constraints

    // 1. Delete notifications
    await db.delete(notifications).where(eq(notifications.userId, userId));

    // 2. Delete comment likes (for user's comments)
    const userComments = await db.select({ id: recordingComments.id }).from(recordingComments).where(eq(recordingComments.userId, userId));
    for (const comment of userComments) {
      await db.delete(commentLikes).where(eq(commentLikes.commentId, comment.id));
    }

    // 3. Delete user's likes on comments
    await db.delete(commentLikes).where(eq(commentLikes.userId, userId));

    // 4. Delete recording comments
    await db.delete(recordingComments).where(eq(recordingComments.userId, userId));

    // 5. Delete recording likes
    await db.delete(recordingLikes).where(eq(recordingLikes.userId, userId));

    // 6. Delete follows
    await db.delete(follows).where(eq(follows.followerId, userId));
    await db.delete(follows).where(eq(follows.followingId, userId));

    // 7. Delete workspace memberships
    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));

    // 8. Delete AI messages and conversations
    const conversations = await db.select({ id: aiEffectConversations.id }).from(aiEffectConversations).where(eq(aiEffectConversations.userId, userId));
    for (const conv of conversations) {
      await db.delete(aiEffectMessages).where(eq(aiEffectMessages.conversationId, conv.id));
    }
    await db.delete(aiEffectConversations).where(eq(aiEffectConversations.userId, userId));

    // 9. Delete sound preferences
    await db.delete(userSoundPreferences).where(eq(userSoundPreferences.userId, userId));

    // 10. Delete API keys
    await db.delete(encryptedApiKeys).where(eq(encryptedApiKeys.userId, userId));

    // 11. Delete AI settings
    await db.delete(userAISettings).where(eq(userAISettings.userId, userId));

    // 12. Delete presets
    await db.delete(userPresets).where(eq(userPresets.userId, userId));

    // 13. Delete recordings
    // Note: In production, also delete files from storage
    await db.delete(recordings).where(eq(recordings.userId, userId));

    // 14. Delete profile
    await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

    // 15. Delete usage records
    await db.delete(usageRecords).where(eq(usageRecords.userId, userId));

    // 16. Delete payment history (keep for legal compliance with anonymized user reference)
    // await db.delete(paymentHistory).where(eq(paymentHistory.userId, userId));

    // 17. Delete subscription
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));

    // 18. Delete analytics (anonymize instead of delete for aggregate analytics)
    await db.update(analyticsEvents).set({ userId: null }).where(eq(analyticsEvents.userId, userId));

    // 19. Delete GDPR records
    await db.delete(gdprConsent).where(eq(gdprConsent.userId, userId));
    await db.delete(gdprExportRequests).where(eq(gdprExportRequests.userId, userId));

    // 20. Anonymize audit logs (keep for security compliance)
    await db.update(auditLogs).set({ userId: null }).where(eq(auditLogs.userId, userId));

    // 21. Finally delete user account
    await db.delete(users).where(eq(users.id, userId));

    console.log(`[GDPR] Account deletion completed for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`[GDPR] Account deletion failed for user ${userId}:`, error);
    return false;
  }
}

export default router;
