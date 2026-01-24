/**
 * Social Hooks
 * React Query hooks for social and community features
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  UserProfile,
  UpdateUserProfile,
  Notification,
  RecordingComment,
  InsertComment,
} from "@shared/schema";

// ============================================================================
// Types
// ============================================================================

export interface PublicUserProfile extends UserProfile {
  username: string;
  isFollowing: boolean;
}

export interface NotificationWithActor extends Notification {
  actor?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface CommentWithUser extends RecordingComment {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  isLiked: boolean;
  replies?: CommentWithUser[];
}

export interface FollowResponse {
  success: boolean;
  followerCount: number;
}

export interface UnfollowResponse {
  success: boolean;
  followerCount: number;
}

export interface LikeRecordingResponse {
  success: boolean;
  likeCount: number;
  isLiked: boolean;
}

export interface AddCommentResponse {
  comment: CommentWithUser;
}

// ============================================================================
// Query Keys
// ============================================================================

export const socialKeys = {
  all: ["/api/v1/social"] as const,
  profile: () => ["/api/v1/social/profile"] as const,
  userProfile: (username: string) =>
    ["/api/v1/social/users", username] as const,
  notifications: () => ["/api/v1/social/notifications"] as const,
  recordingComments: (recordingId: string) =>
    ["/api/v1/social/recordings", recordingId, "comments"] as const,
};

// ============================================================================
// Profile Hooks
// ============================================================================

/**
 * Get current user's profile
 */
export function useProfile() {
  return useQuery<UserProfile>({
    queryKey: socialKeys.profile(),
  });
}

/**
 * Update current user's profile
 */
export function useUpdateProfile() {
  return useMutation<UserProfile, Error, UpdateUserProfile>({
    mutationFn: async (data) => {
      const res = await apiRequest("PUT", "/api/v1/social/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.profile() });
    },
  });
}

/**
 * Get a user's public profile by username
 */
export function useUserProfile(username: string | undefined) {
  return useQuery<PublicUserProfile>({
    queryKey: socialKeys.userProfile(username!),
    enabled: !!username,
  });
}

// ============================================================================
// Follow Hooks
// ============================================================================

/**
 * Follow a user
 */
export function useFollow(userId: string) {
  return useMutation<FollowResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/v1/social/follow/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate profile queries to update follower counts
      queryClient.invalidateQueries({ queryKey: socialKeys.profile() });
      // Invalidate the specific user's profile if we have their username cached
      queryClient.invalidateQueries({ queryKey: ["/api/v1/social/users"] });
    },
  });
}

/**
 * Unfollow a user
 */
export function useUnfollow(userId: string) {
  return useMutation<UnfollowResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/v1/social/follow/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate profile queries to update follower counts
      queryClient.invalidateQueries({ queryKey: socialKeys.profile() });
      // Invalidate the specific user's profile if we have their username cached
      queryClient.invalidateQueries({ queryKey: ["/api/v1/social/users"] });
    },
  });
}

// ============================================================================
// Notification Hooks
// ============================================================================

/**
 * Get current user's notifications
 */
export function useNotifications() {
  return useQuery<NotificationWithActor[]>({
    queryKey: socialKeys.notifications(),
  });
}

// ============================================================================
// Recording Interaction Hooks
// ============================================================================

/**
 * Like a recording
 */
export function useLikeRecording(recordingId: string) {
  return useMutation<LikeRecordingResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/v1/social/recordings/${recordingId}/like`
      );
      return res.json();
    },
    onSuccess: () => {
      // Invalidate recording queries to update like counts
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/recordings", recordingId],
      });
    },
  });
}

/**
 * Get comments for a recording
 */
export function useComments(recordingId: string | undefined) {
  return useQuery<CommentWithUser[]>({
    queryKey: socialKeys.recordingComments(recordingId!),
    enabled: !!recordingId,
  });
}

/**
 * Add a comment to a recording
 */
export function useAddComment(recordingId: string) {
  return useMutation<AddCommentResponse, Error, InsertComment>({
    mutationFn: async (data) => {
      const res = await apiRequest(
        "POST",
        `/api/v1/social/recordings/${recordingId}/comments`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: socialKeys.recordingComments(recordingId),
      });
    },
  });
}
