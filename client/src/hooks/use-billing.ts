/**
 * Billing Hooks
 * React Query hooks for billing and subscription management
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Subscription, UsageRecord } from "@shared/schema";
import type { TierName } from "@shared/tiers";

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionResponse {
  subscription: Subscription | null;
  tier: TierName;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface UsageResponse {
  recordings: number;
  storageBytes: number;
  aiRequests: number;
  limits: {
    recordings: number;
    storageBytes: number;
    aiRequestsPerMonth: number;
  };
}

export interface CheckoutResponse {
  url: string;
  sessionId: string;
}

export interface BillingPortalResponse {
  url: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const billingKeys = {
  all: ["/api/v1/billing"] as const,
  subscription: () => ["/api/v1/billing/subscription"] as const,
  usage: () => ["/api/v1/billing/usage"] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get current user's subscription details
 */
export function useSubscription() {
  return useQuery<SubscriptionResponse>({
    queryKey: billingKeys.subscription(),
  });
}

/**
 * Get current user's usage statistics
 */
export function useUsage() {
  return useQuery<UsageResponse>({
    queryKey: billingKeys.usage(),
  });
}

/**
 * Create a checkout session for upgrading to a tier
 */
export function useCheckout() {
  return useMutation<CheckoutResponse, Error, { tier: TierName }>({
    mutationFn: async ({ tier }) => {
      const res = await apiRequest("POST", "/api/v1/billing/checkout", { tier });
      return res.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Create a billing portal session for managing subscription
 */
export function useBillingPortal() {
  return useMutation<BillingPortalResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v1/billing/portal");
      return res.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe billing portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Cancel current subscription
 */
export function useCancelSubscription() {
  return useMutation<CancelSubscriptionResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v1/billing/cancel");
      return res.json();
    },
    onSuccess: () => {
      // Invalidate subscription data to reflect cancellation
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
    },
  });
}
