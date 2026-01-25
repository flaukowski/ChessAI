/**
 * Jam Sessions Signaling Server
 * WebRTC signaling, room management, and participant broadcasting
 */

import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { nanoid } from 'nanoid';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { workspaces, workspaceMembers } from '../shared/schema';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface JamSession {
  id: string;
  workspaceId: string;
  createdBy: string;
  createdAt: Date;
  participants: Map<string, JamParticipant>;
  maxParticipants: number;
}

interface JamParticipant {
  peerId: string;
  userId: string;
  username: string;
  ws: WebSocket;
  isMuted: boolean;
  isDeafened: boolean;
  joinedAt: Date;
}

interface SignalingMessage {
  type: string;
  [key: string]: any;
}

// ============================================================================
// Session Store
// ============================================================================

const sessions = new Map<string, JamSession>();
const peerToSession = new Map<string, string>();

// Session cleanup interval (remove stale sessions)
const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, sessionId) => {
    // Remove empty sessions older than timeout
    if (session.participants.size === 0 && now - session.createdAt.getTime() > SESSION_TIMEOUT_MS) {
      sessions.delete(sessionId);
      console.log(`[JamSessions] Cleaned up stale session ${sessionId}`);
    }
  });
}, CLEANUP_INTERVAL_MS);

// ============================================================================
// Workspace RBAC Helpers
// ============================================================================

async function getUserWorkspaceRole(workspaceId: string, userId: string): Promise<string | null> {
  // Check if owner
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!workspace) return null;
  if (workspace.ownerId === userId) return 'admin';

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

  return membership?.role || null;
}

function canJoinSession(role: string | null): boolean {
  // All workspace members can join jam sessions
  return role !== null;
}

function canCreateSession(role: string | null): boolean {
  // Only admins and editors can create sessions
  return role === 'admin' || role === 'editor';
}

// ============================================================================
// REST API Endpoints
// ============================================================================

/**
 * Create a new jam session
 * POST /api/v1/jam-sessions
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    // Check workspace permissions
    const role = await getUserWorkspaceRole(workspaceId, userId);
    if (!canCreateSession(role)) {
      return res.status(403).json({ error: 'Insufficient permissions to create jam session' });
    }

    // Check if there's already an active session for this workspace
    for (const [sessionId, session] of sessions) {
      if (session.workspaceId === workspaceId && session.participants.size > 0) {
        return res.json({ sessionId, existing: true });
      }
    }

    // Create new session
    const sessionId = nanoid(12);
    const session: JamSession = {
      id: sessionId,
      workspaceId,
      createdBy: userId,
      createdAt: new Date(),
      participants: new Map(),
      maxParticipants: 8, // Default max participants
    };

    sessions.set(sessionId, session);

    console.log(`[JamSessions] Created session ${sessionId} for workspace ${workspaceId}`);

    res.status(201).json({ sessionId });
  } catch (error) {
    console.error('[JamSessions] Create error:', error);
    res.status(500).json({ error: 'Failed to create jam session' });
  }
});

/**
 * Get session info
 * GET /api/v1/jam-sessions/:sessionId
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check workspace permissions
    const role = await getUserWorkspaceRole(session.workspaceId, userId);
    if (!canJoinSession(role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const participants = Array.from(session.participants.values()).map((p) => ({
      peerId: p.peerId,
      userId: p.userId,
      username: p.username,
      isMuted: p.isMuted,
      isDeafened: p.isDeafened,
      joinedAt: p.joinedAt,
    }));

    res.json({
      sessionId: session.id,
      workspaceId: session.workspaceId,
      createdAt: session.createdAt,
      participantCount: session.participants.size,
      maxParticipants: session.maxParticipants,
      participants,
    });
  } catch (error) {
    console.error('[JamSessions] Get error:', error);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

/**
 * List active sessions for a workspace
 * GET /api/v1/jam-sessions/workspace/:workspaceId
 */
router.get('/workspace/:workspaceId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { workspaceId } = req.params;

    // Check workspace permissions
    const role = await getUserWorkspaceRole(workspaceId, userId);
    if (!canJoinSession(role)) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const workspaceSessions: Array<{
      sessionId: string;
      participantCount: number;
      maxParticipants: number;
      createdAt: Date;
    }> = [];

    sessions.forEach((session, sessionId) => {
      if (session.workspaceId === workspaceId) {
        workspaceSessions.push({
          sessionId,
          participantCount: session.participants.size,
          maxParticipants: session.maxParticipants,
          createdAt: session.createdAt,
        });
      }
    });

    res.json(workspaceSessions);
  } catch (error) {
    console.error('[JamSessions] List error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * Delete a session (admin only)
 * DELETE /api/v1/jam-sessions/:sessionId
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check workspace permissions
    const role = await getUserWorkspaceRole(session.workspaceId, userId);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete sessions' });
    }

    // Notify all participants
    session.participants.forEach((participant) => {
      sendToClient(participant.ws, {
        type: 'session-ended',
        reason: 'Session was closed by an administrator',
      });
      participant.ws.close();
    });

    // Clean up peer mappings
    session.participants.forEach((_, peerId) => {
      peerToSession.delete(peerId);
    });

    sessions.delete(sessionId);

    console.log(`[JamSessions] Deleted session ${sessionId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[JamSessions] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ============================================================================
// WebSocket Signaling
// ============================================================================

function sendToClient(ws: WebSocket, message: SignalingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToSession(session: JamSession, message: SignalingMessage, excludePeerId?: string): void {
  session.participants.forEach((participant) => {
    if (participant.peerId !== excludePeerId) {
      sendToClient(participant.ws, message);
    }
  });
}

async function handleJoin(
  ws: WebSocket,
  session: JamSession,
  userId: string,
  username: string
): Promise<JamParticipant | null> {
  // Check if already joined
  for (const [_, p] of session.participants) {
    if (p.userId === userId) {
      sendToClient(ws, { type: 'error', message: 'Already joined this session' });
      return null;
    }
  }

  // Check max participants
  if (session.participants.size >= session.maxParticipants) {
    sendToClient(ws, { type: 'error', message: 'Session is full' });
    return null;
  }

  // Check workspace permissions
  const role = await getUserWorkspaceRole(session.workspaceId, userId);
  if (!canJoinSession(role)) {
    sendToClient(ws, { type: 'error', message: 'Not authorized to join this session' });
    return null;
  }

  const peerId = nanoid(8);
  const participant: JamParticipant = {
    peerId,
    userId,
    username,
    ws,
    isMuted: false,
    isDeafened: false,
    joinedAt: new Date(),
  };

  session.participants.set(peerId, participant);
  peerToSession.set(peerId, session.id);

  // Send join confirmation with participant list
  sendToClient(ws, {
    type: 'joined',
    peerId,
    sessionId: session.id,
  });

  // Send current participant list to new peer
  const participantList = Array.from(session.participants.values())
    .filter((p) => p.peerId !== peerId)
    .map((p) => ({
      peerId: p.peerId,
      userId: p.userId,
      username: p.username,
      isMuted: p.isMuted,
      isDeafened: p.isDeafened,
    }));

  sendToClient(ws, {
    type: 'participant-list',
    participants: participantList,
  });

  // Notify others about new participant
  broadcastToSession(
    session,
    {
      type: 'participant-joined',
      peerId,
      userId,
      username,
    },
    peerId
  );

  console.log(`[JamSessions] ${username} (${peerId}) joined session ${session.id}`);

  return participant;
}

function handleLeave(session: JamSession, peerId: string): void {
  const participant = session.participants.get(peerId);
  if (!participant) return;

  session.participants.delete(peerId);
  peerToSession.delete(peerId);

  // Notify others
  broadcastToSession(session, {
    type: 'participant-left',
    peerId,
    userId: participant.userId,
    username: participant.username,
  });

  console.log(`[JamSessions] ${participant.username} (${peerId}) left session ${session.id}`);
}

function handleOffer(
  session: JamSession,
  fromPeerId: string,
  message: SignalingMessage
): void {
  const targetPeer = session.participants.get(message.targetPeerId);
  const fromPeer = session.participants.get(fromPeerId);

  if (!targetPeer || !fromPeer) return;

  sendToClient(targetPeer.ws, {
    type: 'offer',
    peerId: fromPeerId,
    userId: fromPeer.userId,
    username: fromPeer.username,
    offer: message.offer,
  });
}

function handleAnswer(
  session: JamSession,
  fromPeerId: string,
  message: SignalingMessage
): void {
  const targetPeer = session.participants.get(message.targetPeerId);

  if (!targetPeer) return;

  sendToClient(targetPeer.ws, {
    type: 'answer',
    peerId: fromPeerId,
    answer: message.answer,
  });
}

function handleIceCandidate(
  session: JamSession,
  fromPeerId: string,
  message: SignalingMessage
): void {
  const targetPeer = session.participants.get(message.targetPeerId);

  if (!targetPeer) return;

  sendToClient(targetPeer.ws, {
    type: 'ice-candidate',
    peerId: fromPeerId,
    candidate: message.candidate,
  });
}

function handleMuteState(
  session: JamSession,
  peerId: string,
  message: SignalingMessage
): void {
  const participant = session.participants.get(peerId);
  if (!participant) return;

  participant.isMuted = message.isMuted;
  participant.isDeafened = message.isDeafened;

  // Broadcast to others
  broadcastToSession(
    session,
    {
      type: 'mute-state',
      peerId,
      isMuted: message.isMuted,
      isDeafened: message.isDeafened,
    },
    peerId
  );
}

// ============================================================================
// WebSocket Server Setup
// ============================================================================

export function setupJamSessionsWebSocket(server: Server): void {
  const wss = new WebSocketServer({
    server,
    path: '/api/v1/jam-sessions/ws',
  });

  // Also handle session-specific paths
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const pathMatch = url.pathname.match(/^\/api\/v1\/jam-sessions\/([^/]+)\/ws$/);

    if (pathMatch) {
      const sessionId = pathMatch[1];
      const session = sessions.get(sessionId);

      if (!session) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as any).sessionId = sessionId;
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    let currentPeerId: string | null = null;
    let currentSession: JamSession | null = null;

    // Get session ID from URL or attached property
    const sessionId = (ws as any).sessionId || (() => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const match = url.pathname.match(/^\/api\/v1\/jam-sessions\/([^/]+)\/ws$/);
      return match ? match[1] : null;
    })();

    if (sessionId) {
      currentSession = sessions.get(sessionId) || null;
    }

    ws.on('message', async (data) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());

        switch (message.type) {
          case 'join':
            if (!currentSession) {
              sendToClient(ws, { type: 'error', message: 'Session not found' });
              return;
            }
            const participant = await handleJoin(
              ws,
              currentSession,
              message.userId,
              message.username
            );
            if (participant) {
              currentPeerId = participant.peerId;
            }
            break;

          case 'offer':
            if (currentSession && currentPeerId) {
              handleOffer(currentSession, currentPeerId, message);
            }
            break;

          case 'answer':
            if (currentSession && currentPeerId) {
              handleAnswer(currentSession, currentPeerId, message);
            }
            break;

          case 'ice-candidate':
            if (currentSession && currentPeerId) {
              handleIceCandidate(currentSession, currentPeerId, message);
            }
            break;

          case 'mute-state':
            if (currentSession && currentPeerId) {
              handleMuteState(currentSession, currentPeerId, message);
            }
            break;

          case 'leave':
            if (currentSession && currentPeerId) {
              handleLeave(currentSession, currentPeerId);
              currentPeerId = null;
            }
            break;

          default:
            console.log(`[JamSessions] Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error('[JamSessions] Message handling error:', error);
        sendToClient(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      if (currentSession && currentPeerId) {
        handleLeave(currentSession, currentPeerId);
      }
    });

    ws.on('error', (error) => {
      console.error('[JamSessions] WebSocket error:', error);
      if (currentSession && currentPeerId) {
        handleLeave(currentSession, currentPeerId);
      }
    });

    // Send initial heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    ws.on('close', () => clearInterval(heartbeat));
  });

  console.log('[JamSessions] WebSocket signaling server initialized');
}

// ============================================================================
// Exports
// ============================================================================

export default router;

// Export session management functions for external use
export function getActiveSessionsCount(): number {
  return sessions.size;
}

export function getTotalParticipantsCount(): number {
  let total = 0;
  sessions.forEach((session) => {
    total += session.participants.size;
  });
  return total;
}

export function getSessionStats(): {
  activeSessions: number;
  totalParticipants: number;
  sessionsPerWorkspace: Map<string, number>;
} {
  const sessionsPerWorkspace = new Map<string, number>();
  let totalParticipants = 0;

  sessions.forEach((session) => {
    const count = sessionsPerWorkspace.get(session.workspaceId) || 0;
    sessionsPerWorkspace.set(session.workspaceId, count + 1);
    totalParticipants += session.participants.size;
  });

  return {
    activeSessions: sessions.size,
    totalParticipants,
    sessionsPerWorkspace,
  };
}
