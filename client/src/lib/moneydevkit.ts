/**
 * MoneyDevKit Integration for SonicVision
 * Handles subscription billing for Free and Pro tiers
 */

const MONEYDEVKIT_API = '/api/billing';

export interface SubscriptionTier {
  id: 'free' | 'pro';
  name: string;
  price: number;
  interval: 'month';
  features: string[];
}

export const TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'AI Music Generation (5/day)',
      'Basic Audio Export',
      'Standard Quality (128kbps)',
      'Community Access',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5,
    interval: 'month',
    features: [
      'Unlimited AI Music Generation',
      'AudioNoise DSP Effects Suite',
      'Real-time Audio Processing',
      'Hi-Fi Export (320kbps + WAV)',
      'Stem Separation',
      'Priority Generation Queue',
      'Commercial License',
      'Priority Support',
    ],
  },
];

export interface UserSubscription {
  tier: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'none';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export async function getCurrentSubscription(): Promise<UserSubscription> {
  try {
    const response = await fetch(`${MONEYDEVKIT_API}/subscription`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return { tier: 'free', status: 'none' };
    }
    return response.json();
  } catch {
    return { tier: 'free', status: 'none' };
  }
}

export async function createCheckoutSession(tierId: 'pro'): Promise<{ url: string }> {
  const response = await fetch(`${MONEYDEVKIT_API}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tierId, priceId: 'price_sonicvision_pro_monthly' }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }
  
  return response.json();
}

export async function createPortalSession(): Promise<{ url: string }> {
  const response = await fetch(`${MONEYDEVKIT_API}/portal`, {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to create portal session');
  }
  
  return response.json();
}

export async function cancelSubscription(): Promise<void> {
  const response = await fetch(`${MONEYDEVKIT_API}/cancel`, {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to cancel subscription');
  }
}

export function getTierById(id: 'free' | 'pro'): SubscriptionTier {
  return TIERS.find(t => t.id === id) || TIERS[0];
}

export function isPro(subscription: UserSubscription): boolean {
  return subscription.tier === 'pro' && subscription.status === 'active';
}
