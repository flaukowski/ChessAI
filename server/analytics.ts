/**
 * Analytics Module
 * Event tracking and admin analytics endpoints
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';
import {
  analyticsEvents,
  users,
  recordings,
  subscriptions,
  userPresets,
  follows,
  recordingLikes,
  recordingComments,
  auditLogs,
} from '../shared/schema';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Middleware to ensure user is admin
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  const userId = (req.user as any)?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user is admin (you would have an admin flag or role in users table)
  // For now, check environment variable for admin users
  const adminUsers = (process.env.ADMIN_USER_IDS || '').split(',');
  if (!adminUsers.includes(userId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// ============================================================================
// EVENT TRACKING
// ============================================================================

/**
 * Track an analytics event
 * POST /api/v1/analytics/events
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { eventType, eventData, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'Event type required' });
    }

    await db.insert(analyticsEvents).values({
      userId,
      sessionId,
      eventType,
      eventData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics] Track event error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * Batch track events
 * POST /api/v1/analytics/events/batch
 */
router.post('/events/batch', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { events, sessionId } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array required' });
    }

    const eventRows = events.map((e: any) => ({
      userId,
      sessionId: e.sessionId || sessionId,
      eventType: e.eventType,
      eventData: e.eventData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'],
      createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    await db.insert(analyticsEvents).values(eventRows);

    res.json({ success: true, count: events.length });
  } catch (error) {
    console.error('[Analytics] Batch track error:', error);
    res.status(500).json({ error: 'Failed to track events' });
  }
});

// ============================================================================
// ADMIN ANALYTICS
// ============================================================================

/**
 * Get dashboard overview
 * GET /api/v1/analytics/admin/overview
 */
router.get('/admin/overview', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Total users
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // New users (30 days)
    const newUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));

    // Active users (last 7 days)
    const activeUsersResult = await db
      .select({ count: sql<number>`count(distinct user_id)` })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, sevenDaysAgo));

    // Total recordings
    const totalRecordingsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings);

    // Total presets
    const totalPresetsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userPresets);

    // Subscription breakdown
    const subscriptionBreakdown = await db
      .select({
        tier: subscriptions.tier,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.tier);

    // Daily active users (last 30 days)
    const dailyActiveUsers = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(distinct user_id)`,
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, thirtyDaysAgo))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    // Top events (last 7 days)
    const topEvents = await db
      .select({
        eventType: analyticsEvents.eventType,
        count: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, sevenDaysAgo))
      .groupBy(analyticsEvents.eventType)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({
      totals: {
        users: Number(totalUsersResult[0]?.count || 0),
        newUsers30d: Number(newUsersResult[0]?.count || 0),
        activeUsers7d: Number(activeUsersResult[0]?.count || 0),
        recordings: Number(totalRecordingsResult[0]?.count || 0),
        presets: Number(totalPresetsResult[0]?.count || 0),
      },
      subscriptions: subscriptionBreakdown.reduce((acc: Record<string, number>, s: typeof subscriptionBreakdown[0]) => {
        acc[s.tier] = Number(s.count);
        return acc;
      }, {} as Record<string, number>),
      dailyActiveUsers: dailyActiveUsers.map((d: typeof dailyActiveUsers[0]) => ({
        date: d.date,
        count: Number(d.count),
      })),
      topEvents: topEvents.map((e: typeof topEvents[0]) => ({
        event: e.eventType,
        count: Number(e.count),
      })),
    });
  } catch (error) {
    console.error('[Analytics] Admin overview error:', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

/**
 * Get user growth data
 * GET /api/v1/analytics/admin/users
 */
router.get('/admin/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // User signups by day
    const signupsByDay = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(gte(users.createdAt, startDate))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    // User retention (users who came back after signup)
    const cohortData = await db
      .select({
        signupDate: sql<string>`date(u.created_at)`,
        returnDate: sql<string>`date(e.created_at)`,
        users: sql<number>`count(distinct u.id)`,
      })
      .from(users)
      .innerJoin(analyticsEvents, eq(users.id, analyticsEvents.userId))
      .where(gte(users.createdAt, startDate))
      .groupBy(sql`date(u.created_at)`, sql`date(e.created_at)`)
      .orderBy(sql`date(u.created_at)`, sql`date(e.created_at)`);

    res.json({
      signupsByDay: signupsByDay.map((d: typeof signupsByDay[0]) => ({
        date: d.date,
        count: Number(d.count),
      })),
      cohortData: cohortData.map((d: typeof cohortData[0]) => ({
        signupDate: d.signupDate,
        returnDate: d.returnDate,
        users: Number(d.users),
      })),
    });
  } catch (error) {
    console.error('[Analytics] Admin users error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * Get revenue analytics
 * GET /api/v1/analytics/admin/revenue
 */
router.get('/admin/revenue', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // Subscription counts by tier
    const subscriptionCounts = await db
      .select({
        tier: subscriptions.tier,
        status: subscriptions.status,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .groupBy(subscriptions.tier, subscriptions.status);

    // MRR calculation (simplified)
    const activeSubs = await db
      .select({
        tier: subscriptions.tier,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.tier);

    const tierPrices: Record<string, number> = {
      free: 0,
      pro: 999,
      studio: 1999,
    };

    const mrr = activeSubs.reduce((total: number, sub: typeof activeSubs[0]) => {
      return total + (tierPrices[sub.tier] || 0) * Number(sub.count);
    }, 0);

    // Churn (subscriptions that ended in period)
    const churnedSubs = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'canceled'),
          gte(subscriptions.updatedAt, startDate)
        )
      );

    res.json({
      subscriptionCounts: subscriptionCounts.map((s: typeof subscriptionCounts[0]) => ({
        tier: s.tier,
        status: s.status,
        count: Number(s.count),
      })),
      mrr: mrr / 100, // Convert cents to dollars
      churnedCount: Number(churnedSubs[0]?.count || 0),
      activeSubscribers: activeSubs.reduce((sum: number, s: typeof activeSubs[0]) => sum + Number(s.count), 0),
    });
  } catch (error) {
    console.error('[Analytics] Admin revenue error:', error);
    res.status(500).json({ error: 'Failed to get revenue data' });
  }
});

/**
 * Get content analytics
 * GET /api/v1/analytics/admin/content
 */
router.get('/admin/content', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // Recordings created by day
    const recordingsByDay = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(recordings)
      .where(gte(recordings.createdAt, startDate))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    // Presets created by day
    const presetsByDay = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(userPresets)
      .where(gte(userPresets.createdAt, startDate))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    // Social engagement
    const likesByDay = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(recordingLikes)
      .where(gte(recordingLikes.createdAt, startDate))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    const commentsByDay = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(recordingComments)
      .where(gte(recordingComments.createdAt, startDate))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    const followsByDay = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(follows)
      .where(gte(follows.createdAt, startDate))
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    // Top recordings by play count
    const topRecordings = await db
      .select({
        id: recordings.id,
        title: recordings.title,
        userId: recordings.userId,
        playCount: recordings.playCount,
        createdAt: recordings.createdAt,
      })
      .from(recordings)
      .where(eq(recordings.isPublic, true))
      .orderBy(desc(recordings.playCount))
      .limit(10);

    res.json({
      recordingsByDay: recordingsByDay.map((d: typeof recordingsByDay[0]) => ({ date: d.date, count: Number(d.count) })),
      presetsByDay: presetsByDay.map((d: typeof presetsByDay[0]) => ({ date: d.date, count: Number(d.count) })),
      engagement: {
        likesByDay: likesByDay.map((d: typeof likesByDay[0]) => ({ date: d.date, count: Number(d.count) })),
        commentsByDay: commentsByDay.map((d: typeof commentsByDay[0]) => ({ date: d.date, count: Number(d.count) })),
        followsByDay: followsByDay.map((d: typeof followsByDay[0]) => ({ date: d.date, count: Number(d.count) })),
      },
      topRecordings,
    });
  } catch (error) {
    console.error('[Analytics] Admin content error:', error);
    res.status(500).json({ error: 'Failed to get content data' });
  }
});

/**
 * Get feature usage analytics
 * GET /api/v1/analytics/admin/features
 */
router.get('/admin/features', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // Effect usage
    const effectUsage = await db
      .select({
        effectType: sql<string>`event_data->>'effectType'`,
        count: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventType, 'effect_used'),
          gte(analyticsEvents.createdAt, startDate)
        )
      )
      .groupBy(sql`event_data->>'effectType'`)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    // AI suggestions usage
    const aiUsage = await db
      .select({
        date: sql<string>`date(created_at)`,
        count: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventType, 'ai_suggestion_requested'),
          gte(analyticsEvents.createdAt, startDate)
        )
      )
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`);

    // Recording formats used
    const formatUsage = await db
      .select({
        format: recordings.format,
        count: sql<number>`count(*)`,
      })
      .from(recordings)
      .where(gte(recordings.createdAt, startDate))
      .groupBy(recordings.format);

    res.json({
      effectUsage: effectUsage.map((e: typeof effectUsage[0]) => ({
        effect: e.effectType,
        count: Number(e.count),
      })),
      aiUsageByDay: aiUsage.map((d: typeof aiUsage[0]) => ({
        date: d.date,
        count: Number(d.count),
      })),
      formatUsage: formatUsage.map((f: typeof formatUsage[0]) => ({
        format: f.format,
        count: Number(f.count),
      })),
    });
  } catch (error) {
    console.error('[Analytics] Admin features error:', error);
    res.status(500).json({ error: 'Failed to get feature data' });
  }
});

/**
 * Export analytics data
 * GET /api/v1/analytics/admin/export
 */
router.get('/admin/export', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, format = 'json' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    let data: any[] = [];

    switch (type) {
      case 'events':
        data = await db
          .select()
          .from(analyticsEvents)
          .where(
            and(
              gte(analyticsEvents.createdAt, start),
              lte(analyticsEvents.createdAt, end)
            )
          )
          .orderBy(desc(analyticsEvents.createdAt))
          .limit(10000);
        break;

      case 'users':
        data = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            createdAt: users.createdAt,
            emailVerified: users.emailVerified,
          })
          .from(users)
          .where(
            and(
              gte(users.createdAt, start),
              lte(users.createdAt, end)
            )
          )
          .orderBy(desc(users.createdAt));
        break;

      case 'subscriptions':
        data = await db
          .select()
          .from(subscriptions)
          .where(
            and(
              gte(subscriptions.createdAt, start),
              lte(subscriptions.createdAt, end)
            )
          )
          .orderBy(desc(subscriptions.createdAt));
        break;

      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    if (format === 'csv') {
      // Convert to CSV
      if (data.length === 0) {
        return res.status(200).send('');
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map((row) =>
        Object.values(row)
          .map((v) => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v))
          .join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`);
      res.send([headers, ...rows].join('\n'));
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('[Analytics] Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
