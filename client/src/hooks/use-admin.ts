/**
 * Admin Hooks
 * React Query hooks for admin dashboard and analytics
 */

import { useQuery } from "@tanstack/react-query";
import type { User, Subscription } from "@shared/schema";
import type { TierName } from "@shared/tiers";

// ============================================================================
// Types
// ============================================================================

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalRecordings: number;
  totalStorage: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  subscriptionStats: {
    free: number;
    pro: number;
    studio: number;
  };
  topEffects: Array<{
    effectType: string;
    count: number;
  }>;
  recentActivity: Array<{
    type: string;
    userId: string;
    username: string;
    description: string;
    createdAt: string;
  }>;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
  subscription: {
    tier: TierName;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  usage: {
    recordings: number;
    storageBytes: number;
    aiRequests: number;
  };
  lastActive: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminRevenueData {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  conversionRate: number;
  revenueByTier: {
    pro: number;
    studio: number;
  };
  revenueHistory: Array<{
    date: string;
    revenue: number;
    subscriptions: number;
  }>;
  topPayingUsers: Array<{
    userId: string;
    username: string;
    totalPaid: number;
    tier: TierName;
  }>;
  paymentStats: {
    successful: number;
    failed: number;
    refunded: number;
  };
}

// ============================================================================
// Query Keys
// ============================================================================

export const adminKeys = {
  all: ["/api/v1/admin"] as const,
  overview: () => ["/api/v1/admin/overview"] as const,
  users: () => ["/api/v1/admin/users"] as const,
  revenue: () => ["/api/v1/admin/revenue"] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get admin dashboard overview statistics
 */
export function useAdminOverview() {
  return useQuery<AdminOverview>({
    queryKey: adminKeys.overview(),
  });
}

/**
 * Get list of all users for admin management
 */
export function useAdminUsers() {
  return useQuery<AdminUsersResponse>({
    queryKey: adminKeys.users(),
  });
}

/**
 * Get revenue analytics and financial data
 */
export function useAdminRevenue() {
  return useQuery<AdminRevenueData>({
    queryKey: adminKeys.revenue(),
  });
}
