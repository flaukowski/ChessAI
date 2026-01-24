/**
 * Team Workspaces Module
 * Handles workspace CRUD, membership, and RBAC
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  workspaceRecordings,
  recordings,
  users,
  subscriptions,
  auditLogs,
} from '../shared/schema';
import { WORKSPACE_ROLES, WorkspaceRole } from '../shared/schema';
import { generateSecureToken } from './encryption';
import { requireFeature, loadTierInfo } from './middleware/tier-gating';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Permission check helper
 */
function hasPermission(role: WorkspaceRole, action: string): boolean {
  const permissions: Record<WorkspaceRole, string[]> = {
    admin: ['view', 'create', 'edit', 'delete', 'invite', 'billing', 'manage'],
    editor: ['view', 'create', 'edit', 'delete_own'],
    viewer: ['view'],
  };
  return permissions[role]?.includes(action) || false;
}

/**
 * Get user's role in workspace
 */
async function getUserRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  // Check if owner
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (workspace?.ownerId === userId) {
    return 'admin';
  }

  // Check membership
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );

  return membership?.role as WorkspaceRole || null;
}

/**
 * Middleware to check workspace permission
 */
function requireWorkspacePermission(action: string) {
  return async (req: Request, res: Response, next: Function) => {
    const userId = (req.user as any).id;
    const workspaceId = req.params.workspaceId || req.params.id;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    const role = await getUserRole(workspaceId, userId);

    if (!role) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (!hasPermission(role, action)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: action,
        currentRole: role,
      });
    }

    (req as any).workspaceRole = role;
    next();
  };
}

/**
 * Create workspace
 * POST /api/v1/workspaces
 */
router.post('/', requireAuth, loadTierInfo, requireFeature('teams'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { name, slug, description, logoUrl, settings } = req.body;

    // Validate slug uniqueness
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug));

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Workspace slug already taken' });
    }

    // Get user's subscription for max members
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const maxMembers = subscription?.tier === 'studio' ? 50 : 5;

    // Create workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name,
        slug,
        description,
        logoUrl,
        settings,
        ownerId: userId,
        subscriptionId: subscription?.id,
        maxMembers,
      })
      .returning();

    // Add owner as admin member
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: 'admin',
    });

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'workspace.created',
      resource: 'workspace',
      resourceId: workspace.id,
      changes: { name, slug },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(workspace);
  } catch (error) {
    console.error('[Workspaces] Create error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

/**
 * List user's workspaces
 * GET /api/v1/workspaces
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    // Get workspaces where user is owner
    const ownedWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));

    // Get workspaces where user is member
    const memberships = await db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId));

    // Combine and deduplicate
    const workspaceMap = new Map();

    ownedWorkspaces.forEach((w: typeof ownedWorkspaces[0]) => {
      workspaceMap.set(w.id, { ...w, role: 'admin', isOwner: true });
    });

    memberships.forEach((m: typeof memberships[0]) => {
      if (!workspaceMap.has(m.workspace.id)) {
        workspaceMap.set(m.workspace.id, {
          ...m.workspace,
          role: m.role,
          isOwner: false,
          joinedAt: m.joinedAt,
        });
      }
    });

    res.json(Array.from(workspaceMap.values()));
  } catch (error) {
    console.error('[Workspaces] List error:', error);
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

/**
 * Get workspace details
 * GET /api/v1/workspaces/:id
 */
router.get('/:id', requireAuth, requireWorkspacePermission('view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Get member count
    const memberCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, id));

    // Get owner info
    const [owner] = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(eq(users.id, workspace.ownerId));

    res.json({
      ...workspace,
      memberCount: Number(memberCountResult[0]?.count || 0) + 1, // +1 for owner
      owner,
      role: (req as any).workspaceRole,
    });
  } catch (error) {
    console.error('[Workspaces] Get error:', error);
    res.status(500).json({ error: 'Failed to get workspace' });
  }
});

/**
 * Update workspace
 * PUT /api/v1/workspaces/:id
 */
router.put('/:id', requireAuth, requireWorkspacePermission('manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { name, description, logoUrl, settings } = req.body;

    const [workspace] = await db
      .update(workspaces)
      .set({
        name,
        description,
        logoUrl,
        settings,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'workspace.updated',
      resource: 'workspace',
      resourceId: id,
      changes: { name, description },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(workspace);
  } catch (error) {
    console.error('[Workspaces] Update error:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

/**
 * Delete workspace
 * DELETE /api/v1/workspaces/:id
 */
router.delete('/:id', requireAuth, requireWorkspacePermission('manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;

    // Only owner can delete
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));

    if (workspace?.ownerId !== userId) {
      return res.status(403).json({ error: 'Only workspace owner can delete' });
    }

    // Delete in order
    await db.delete(workspaceRecordings).where(eq(workspaceRecordings.workspaceId, id));
    await db.delete(workspaceInvites).where(eq(workspaceInvites.workspaceId, id));
    await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, id));
    await db.delete(workspaces).where(eq(workspaces.id, id));

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'workspace.deleted',
      resource: 'workspace',
      resourceId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Workspaces] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

/**
 * List workspace members
 * GET /api/v1/workspaces/:id/members
 */
router.get('/:id/members', requireAuth, requireWorkspacePermission('view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get owner
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));

    const [owner] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, workspace.ownerId));

    // Get members
    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, id))
      .orderBy(desc(workspaceMembers.joinedAt));

    res.json({
      owner: { ...owner, role: 'owner', isOwner: true },
      members: members.filter((m: typeof members[0]) => m.userId !== workspace.ownerId),
    });
  } catch (error) {
    console.error('[Workspaces] List members error:', error);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

/**
 * Create invite
 * POST /api/v1/workspaces/:id/invite
 */
router.post('/:id/invite', requireAuth, requireWorkspacePermission('invite'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { email, role } = req.body;

    // Check member limit
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id));

    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, id));

    if (Number(memberCount[0]?.count || 0) >= (workspace?.maxMembers || 5)) {
      return res.status(403).json({ error: 'Workspace member limit reached' });
    }

    // Check if user is already a member
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, id),
            eq(workspaceMembers.userId, existingUser.id)
          )
        );

      if (existingMember || workspace?.ownerId === existingUser.id) {
        return res.status(400).json({ error: 'User is already a member' });
      }
    }

    // Check for existing pending invite
    const [existingInvite] = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, id),
          eq(workspaceInvites.email, email),
          eq(workspaceInvites.acceptedAt, null as any)
        )
      );

    if (existingInvite) {
      return res.status(400).json({ error: 'Invite already pending' });
    }

    // Create invite
    const token = generateSecureToken(32);
    const [invite] = await db
      .insert(workspaceInvites)
      .values({
        workspaceId: id,
        email,
        role: role || 'viewer',
        token,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'workspace.invite_created',
      resource: 'workspace_invite',
      resourceId: invite.id,
      changes: { email, role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // TODO: Send invite email

    res.status(201).json({
      ...invite,
      inviteUrl: `${process.env.APP_URL}/workspace/invite/${token}`,
    });
  } catch (error) {
    console.error('[Workspaces] Create invite error:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

/**
 * Accept invite
 * POST /api/v1/workspaces/invite/:token/accept
 */
router.post('/invite/:token/accept', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = (req.user as any).id;
    const userEmail = (req.user as any).email;

    const [invite] = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.token, token),
          eq(workspaceInvites.acceptedAt, null as any)
        )
      );

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite has expired' });
    }

    if (invite.email !== userEmail) {
      return res.status(403).json({ error: 'This invite is for a different email address' });
    }

    // Add member
    await db.insert(workspaceMembers).values({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
    });

    // Mark invite as accepted
    await db
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.id));

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'workspace.invite_accepted',
      resource: 'workspace_invite',
      resourceId: invite.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, workspaceId: invite.workspaceId });
  } catch (error) {
    console.error('[Workspaces] Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

/**
 * Update member role
 * PUT /api/v1/workspaces/:workspaceId/members/:userId
 */
router.put('/:workspaceId/members/:userId', requireAuth, requireWorkspacePermission('manage'), async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId: targetUserId } = req.params;
    const adminId = (req.user as any).id;
    const { role } = req.body;

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Can't change owner's role
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (workspace?.ownerId === targetUserId) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    await db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId)
        )
      );

    // Log the action
    await db.insert(auditLogs).values({
      userId: adminId,
      action: 'workspace.member_role_updated',
      resource: 'workspace_member',
      resourceId: targetUserId,
      changes: { role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Workspaces] Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

/**
 * Remove member
 * DELETE /api/v1/workspaces/:workspaceId/members/:userId
 */
router.delete('/:workspaceId/members/:userId', requireAuth, requireWorkspacePermission('manage'), async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId: targetUserId } = req.params;
    const adminId = (req.user as any).id;

    // Can't remove owner
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (workspace?.ownerId === targetUserId) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId)
        )
      );

    // Log the action
    await db.insert(auditLogs).values({
      userId: adminId,
      action: 'workspace.member_removed',
      resource: 'workspace_member',
      resourceId: targetUserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Workspaces] Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

/**
 * Add recording to workspace
 * POST /api/v1/workspaces/:id/recordings
 */
router.post('/:id/recordings', requireAuth, requireWorkspacePermission('create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { recordingId } = req.body;

    // Verify recording exists and belongs to user
    const [recording] = await db
      .select()
      .from(recordings)
      .where(
        and(
          eq(recordings.id, recordingId),
          eq(recordings.userId, userId)
        )
      );

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Check if already added
    const [existing] = await db
      .select()
      .from(workspaceRecordings)
      .where(
        and(
          eq(workspaceRecordings.workspaceId, id),
          eq(workspaceRecordings.recordingId, recordingId)
        )
      );

    if (existing) {
      return res.status(400).json({ error: 'Recording already in workspace' });
    }

    const [workspaceRecording] = await db
      .insert(workspaceRecordings)
      .values({
        workspaceId: id,
        recordingId,
        addedBy: userId,
      })
      .returning();

    res.status(201).json(workspaceRecording);
  } catch (error) {
    console.error('[Workspaces] Add recording error:', error);
    res.status(500).json({ error: 'Failed to add recording' });
  }
});

/**
 * List workspace recordings
 * GET /api/v1/workspaces/:id/recordings
 */
router.get('/:id/recordings', requireAuth, requireWorkspacePermission('view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workspaceRecs = await db
      .select({
        id: workspaceRecordings.id,
        addedAt: workspaceRecordings.addedAt,
        addedBy: workspaceRecordings.addedBy,
        recording: recordings,
      })
      .from(workspaceRecordings)
      .innerJoin(recordings, eq(workspaceRecordings.recordingId, recordings.id))
      .where(eq(workspaceRecordings.workspaceId, id))
      .orderBy(desc(workspaceRecordings.addedAt));

    res.json(workspaceRecs);
  } catch (error) {
    console.error('[Workspaces] List recordings error:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

export default router;
