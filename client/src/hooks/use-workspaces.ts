/**
 * Workspaces Hooks
 * React Query hooks for team workspace management
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  Workspace,
  WorkspaceMember,
  InsertWorkspace,
  WorkspaceRole,
} from "@shared/schema";

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceWithMembers extends Workspace {
  memberCount: number;
  role: WorkspaceRole;
}

export interface WorkspaceMemberWithUser extends WorkspaceMember {
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface InviteMemberInput {
  email: string;
  role: WorkspaceRole;
}

export interface UpdateMemberRoleInput {
  role: WorkspaceRole;
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
}

export interface InviteMemberResponse {
  success: boolean;
  inviteId: string;
  email: string;
}

export interface UpdateMemberRoleResponse {
  success: boolean;
  member: WorkspaceMember;
}

// ============================================================================
// Query Keys
// ============================================================================

export const workspaceKeys = {
  all: ["/api/v1/workspaces"] as const,
  list: () => ["/api/v1/workspaces"] as const,
  detail: (id: string) => ["/api/v1/workspaces", id] as const,
  members: (id: string) => ["/api/v1/workspaces", id, "members"] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get all workspaces the current user is a member of
 */
export function useWorkspaces() {
  return useQuery<WorkspaceWithMembers[]>({
    queryKey: workspaceKeys.list(),
  });
}

/**
 * Get a specific workspace by ID
 */
export function useWorkspace(id: string | undefined) {
  return useQuery<Workspace>({
    queryKey: workspaceKeys.detail(id!),
    enabled: !!id,
  });
}

/**
 * Get members of a workspace
 */
export function useWorkspaceMembers(id: string | undefined) {
  return useQuery<WorkspaceMemberWithUser[]>({
    queryKey: workspaceKeys.members(id!),
    enabled: !!id,
  });
}

/**
 * Create a new workspace
 */
export function useCreateWorkspace() {
  return useMutation<CreateWorkspaceResponse, Error, InsertWorkspace>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/v1/workspaces", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

/**
 * Invite a member to a workspace
 */
export function useInviteMember(workspaceId: string) {
  return useMutation<InviteMemberResponse, Error, InviteMemberInput>({
    mutationFn: async (data) => {
      const res = await apiRequest(
        "POST",
        `/api/v1/workspaces/${workspaceId}/invite`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId),
      });
    },
  });
}

/**
 * Update a member's role in a workspace
 */
export function useUpdateMemberRole(workspaceId: string) {
  return useMutation<
    UpdateMemberRoleResponse,
    Error,
    { userId: string; role: WorkspaceRole }
  >({
    mutationFn: async ({ userId, role }) => {
      const res = await apiRequest(
        "PUT",
        `/api/v1/workspaces/${workspaceId}/members/${userId}`,
        { role }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspaceId),
      });
    },
  });
}
