/**
 * Social Features Module
 * Handles profiles, follows, likes, comments, and notifications
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';
import {
  users,
  userProfiles,
  follows,
  recordings,
  recordingLikes,
  recordingComments,
  commentLikes,
  notifications,
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

// Optional auth - allows both authenticated and anonymous access
const optionalAuth = (req: Request, res: Response, next: Function) => {
  next();
};

// ============================================================================
// PROFILES
// ============================================================================

/**
 * Get or create user profile
 * GET /api/v1/social/profile
 */
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    let [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    if (!profile) {
      // Create default profile
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      [profile] = await db
        .insert(userProfiles)
        .values({
          userId,
          displayName: user.username,
          isPublic: true,
        })
        .returning();
    }

    res.json(profile);
  } catch (error) {
    console.error('[Social] Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Update user profile
 * PUT /api/v1/social/profile
 */
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const {
      displayName,
      bio,
      avatarUrl,
      websiteUrl,
      twitterHandle,
      instagramHandle,
      youtubeChannel,
      soundcloudUrl,
      location,
      isPublic,
    } = req.body;

    // Upsert profile
    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    let profile;
    if (existing.length > 0) {
      [profile] = await db
        .update(userProfiles)
        .set({
          displayName,
          bio,
          avatarUrl,
          websiteUrl,
          twitterHandle,
          instagramHandle,
          youtubeChannel,
          soundcloudUrl,
          location,
          isPublic,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
    } else {
      [profile] = await db
        .insert(userProfiles)
        .values({
          userId,
          displayName,
          bio,
          avatarUrl,
          websiteUrl,
          twitterHandle,
          instagramHandle,
          youtubeChannel,
          soundcloudUrl,
          location,
          isPublic: isPublic ?? true,
        })
        .returning();
    }

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'social.profile_updated',
      resource: 'user_profile',
      resourceId: profile.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(profile);
  } catch (error) {
    console.error('[Social] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Get public profile by username
 * GET /api/v1/social/users/:username
 */
router.get('/users/:username', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const currentUserId = (req.user as any)?.id;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id));

    if (profile && !profile.isPublic && currentUserId !== user.id) {
      return res.status(403).json({ error: 'Profile is private' });
    }

    // Check if current user follows this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user.id) {
      const [follow] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, currentUserId),
            eq(follows.followingId, user.id)
          )
        );
      isFollowing = !!follow;
    }

    // Get public recordings count
    const recordingCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings)
      .where(
        and(
          eq(recordings.userId, user.id),
          eq(recordings.isPublic, true)
        )
      );

    res.json({
      user,
      profile: profile || { userId: user.id, isPublic: true },
      isFollowing,
      recordingCount: Number(recordingCountResult[0]?.count || 0),
    });
  } catch (error) {
    console.error('[Social] Get public profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Search users
 * GET /api/v1/social/users/search?q=query
 */
router.get('/users', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        bio: userProfiles.bio,
        followerCount: userProfiles.followerCount,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(
        and(
          or(
            ilike(users.username, `%${q}%`),
            ilike(userProfiles.displayName, `%${q}%`)
          ),
          or(
            eq(userProfiles.isPublic, true),
            eq(userProfiles.isPublic, null as any)
          )
        )
      )
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(results);
  } catch (error) {
    console.error('[Social] Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// ============================================================================
// FOLLOWS
// ============================================================================

/**
 * Follow a user
 * POST /api/v1/social/follow/:userId
 */
router.post('/follow/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const followerId = (req.user as any).id;
    const followingId = req.params.userId;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if already following
    const existing = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Create follow
    await db.insert(follows).values({ followerId, followingId });

    // Update counts
    await db
      .update(userProfiles)
      .set({
        followingCount: sql`following_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, followerId));

    await db
      .update(userProfiles)
      .set({
        followerCount: sql`follower_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, followingId));

    // Create notification
    await db.insert(notifications).values({
      userId: followingId,
      type: 'follow',
      actorId: followerId,
      message: 'started following you',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Social] Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

/**
 * Unfollow a user
 * DELETE /api/v1/social/follow/:userId
 */
router.delete('/follow/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const followerId = (req.user as any).id;
    const followingId = req.params.userId;

    const deleted = await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    // Update counts
    await db
      .update(userProfiles)
      .set({
        followingCount: sql`greatest(following_count - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, followerId));

    await db
      .update(userProfiles)
      .set({
        followerCount: sql`greatest(follower_count - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, followingId));

    res.json({ success: true });
  } catch (error) {
    console.error('[Social] Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

/**
 * Get followers
 * GET /api/v1/social/users/:userId/followers
 */
router.get('/users/:userId/followers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const followers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(followers);
  } catch (error) {
    console.error('[Social] Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

/**
 * Get following
 * GET /api/v1/social/users/:userId/following
 */
router.get('/users/:userId/following', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const following = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(following);
  } catch (error) {
    console.error('[Social] Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

// ============================================================================
// LIKES
// ============================================================================

/**
 * Like a recording
 * POST /api/v1/social/recordings/:id/like
 */
router.post('/recordings/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const recordingId = req.params.id;

    // Check if recording exists
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId));

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Check if already liked
    const existing = await db
      .select()
      .from(recordingLikes)
      .where(
        and(
          eq(recordingLikes.recordingId, recordingId),
          eq(recordingLikes.userId, userId)
        )
      );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already liked' });
    }

    await db.insert(recordingLikes).values({ recordingId, userId });

    // Create notification if not own recording
    if (recording.userId !== userId) {
      await db.insert(notifications).values({
        userId: recording.userId,
        type: 'like',
        actorId: userId,
        resourceType: 'recording',
        resourceId: recordingId,
        message: 'liked your recording',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Social] Like error:', error);
    res.status(500).json({ error: 'Failed to like recording' });
  }
});

/**
 * Unlike a recording
 * DELETE /api/v1/social/recordings/:id/like
 */
router.delete('/recordings/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const recordingId = req.params.id;

    await db
      .delete(recordingLikes)
      .where(
        and(
          eq(recordingLikes.recordingId, recordingId),
          eq(recordingLikes.userId, userId)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error('[Social] Unlike error:', error);
    res.status(500).json({ error: 'Failed to unlike recording' });
  }
});

/**
 * Get recording likes count and status
 * GET /api/v1/social/recordings/:id/likes
 */
router.get('/recordings/:id/likes', optionalAuth, async (req: Request, res: Response) => {
  try {
    const recordingId = req.params.id;
    const currentUserId = (req.user as any)?.id;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordingLikes)
      .where(eq(recordingLikes.recordingId, recordingId));

    let isLiked = false;
    if (currentUserId) {
      const [like] = await db
        .select()
        .from(recordingLikes)
        .where(
          and(
            eq(recordingLikes.recordingId, recordingId),
            eq(recordingLikes.userId, currentUserId)
          )
        );
      isLiked = !!like;
    }

    res.json({
      count: Number(countResult[0]?.count || 0),
      isLiked,
    });
  } catch (error) {
    console.error('[Social] Get likes error:', error);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Add comment to recording
 * POST /api/v1/social/recordings/:id/comments
 */
router.post('/recordings/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const recordingId = req.params.id;
    const { content, parentId } = req.body;

    // Check if recording exists
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId));

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const [comment] = await db
      .insert(recordingComments)
      .values({
        recordingId,
        userId,
        content,
        parentId,
      })
      .returning();

    // Create notification if not own recording
    if (recording.userId !== userId) {
      await db.insert(notifications).values({
        userId: recording.userId,
        type: 'comment',
        actorId: userId,
        resourceType: 'recording',
        resourceId: recordingId,
        message: 'commented on your recording',
      });
    }

    // If reply, notify parent comment author
    if (parentId) {
      const [parentComment] = await db
        .select()
        .from(recordingComments)
        .where(eq(recordingComments.id, parentId));

      if (parentComment && parentComment.userId !== userId) {
        await db.insert(notifications).values({
          userId: parentComment.userId,
          type: 'comment',
          actorId: userId,
          resourceType: 'comment',
          resourceId: parentId,
          message: 'replied to your comment',
        });
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('[Social] Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * Get recording comments
 * GET /api/v1/social/recordings/:id/comments
 */
router.get('/recordings/:id/comments', optionalAuth, async (req: Request, res: Response) => {
  try {
    const recordingId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;

    const comments = await db
      .select({
        id: recordingComments.id,
        content: recordingComments.content,
        parentId: recordingComments.parentId,
        isEdited: recordingComments.isEdited,
        likeCount: recordingComments.likeCount,
        createdAt: recordingComments.createdAt,
        userId: recordingComments.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(recordingComments)
      .innerJoin(users, eq(recordingComments.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(recordingComments.recordingId, recordingId))
      .orderBy(desc(recordingComments.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(comments);
  } catch (error) {
    console.error('[Social] Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * Update comment
 * PUT /api/v1/social/comments/:id
 */
router.put('/comments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const commentId = req.params.id;
    const { content } = req.body;

    const [comment] = await db
      .select()
      .from(recordingComments)
      .where(eq(recordingComments.id, commentId));

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Cannot edit another user\'s comment' });
    }

    const [updated] = await db
      .update(recordingComments)
      .set({
        content,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(recordingComments.id, commentId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[Social] Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/**
 * Delete comment
 * DELETE /api/v1/social/comments/:id
 */
router.delete('/comments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const commentId = req.params.id;

    const [comment] = await db
      .select()
      .from(recordingComments)
      .where(eq(recordingComments.id, commentId));

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Cannot delete another user\'s comment' });
    }

    // Delete likes first
    await db.delete(commentLikes).where(eq(commentLikes.commentId, commentId));
    await db.delete(recordingComments).where(eq(recordingComments.id, commentId));

    res.json({ success: true });
  } catch (error) {
    console.error('[Social] Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Get notifications
 * GET /api/v1/social/notifications
 */
router.get('/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { limit = 50, offset = 0, unreadOnly } = req.query;

    let query = db
      .select({
        id: notifications.id,
        type: notifications.type,
        message: notifications.message,
        resourceType: notifications.resourceType,
        resourceId: notifications.resourceId,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        actorId: notifications.actorId,
        actorUsername: users.username,
        actorDisplayName: userProfiles.displayName,
        actorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const results = await query;

    // Get unread count
    const unreadCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );

    res.json({
      notifications: results,
      unreadCount: Number(unreadCountResult[0]?.count || 0),
    });
  } catch (error) {
    console.error('[Social] Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * Mark notifications as read
 * POST /api/v1/social/notifications/read
 */
router.post('/notifications/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { ids } = req.body; // Array of notification IDs, or empty for all

    if (ids && ids.length > 0) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, userId),
            sql`${notifications.id} = ANY(${ids})`
          )
        );
    } else {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Social] Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;
