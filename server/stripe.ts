/**
 * Stripe Integration Module
 * Handles subscriptions, payments, and webhooks
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from './db';
import { eq } from 'drizzle-orm';
import {
  users,
  subscriptions,
  paymentHistory,
  usageRecords,
  auditLogs,
} from '../shared/schema';
import { TIER_LIMITS, TierName } from '../shared/tiers';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Get or create Stripe customer for user
 */
async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  // Check for existing subscription with customer ID
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  if (existingSub?.stripeCustomerId) {
    return existingSub.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}

/**
 * Get subscription status
 * GET /api/v1/billing/subscription
 */
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (!subscription) {
      // Return free tier info
      return res.json({
        tier: 'free',
        status: 'active',
        limits: TIER_LIMITS.free,
      });
    }

    res.json({
      ...subscription,
      limits: TIER_LIMITS[subscription.tier as TierName] || TIER_LIMITS.free,
    });
  } catch (error) {
    console.error('[Stripe] Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * Create checkout session for subscription
 * POST /api/v1/billing/checkout
 */
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const userEmail = (req.user as any).email;
    const { tier, successUrl, cancelUrl } = req.body;

    if (!['pro', 'studio'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const tierConfig = TIER_LIMITS[tier as TierName];
    if (!tierConfig.priceId) {
      return res.status(400).json({ error: 'Tier not available for purchase' });
    }

    const customerId = await getOrCreateCustomer(userId, userEmail);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.APP_URL}/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.APP_URL}/billing?canceled=true`,
      metadata: {
        userId,
        tier,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
        },
      },
      allow_promotion_codes: true,
    });

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'billing.checkout_created',
      resource: 'subscription',
      metadata: { tier, sessionId: session.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[Stripe] Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * Create customer portal session for managing subscription
 * POST /api/v1/billing/portal
 */
router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { returnUrl } = req.body;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl || `${process.env.APP_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] Portal error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * Get usage summary for current period
 * GET /api/v1/billing/usage
 */
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const tier = (subscription?.tier as TierName) || 'free';
    const limits = TIER_LIMITS[tier];

    // Get current period usage
    const now = new Date();
    const periodStart = subscription?.currentPeriodStart || new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = subscription?.currentPeriodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usage = await db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.userId, userId));

    const usageSummary: Record<string, { used: number; limit: number; remaining: number }> = {
      recordings: {
        used: 0,
        limit: limits.recordings,
        remaining: limits.recordings,
      },
      storageBytes: {
        used: 0,
        limit: limits.storageBytes,
        remaining: limits.storageBytes,
      },
      aiRequests: {
        used: 0,
        limit: limits.aiRequestsPerMonth,
        remaining: limits.aiRequestsPerMonth,
      },
    };

    // Aggregate usage from records
    usage.forEach((record: typeof usage[0]) => {
      const key = record.usageType === 'ai_requests' ? 'aiRequests' : record.usageType;
      if (usageSummary[key]) {
        usageSummary[key].used += record.quantity;
        const limit = usageSummary[key].limit;
        usageSummary[key].remaining = limit === -1 ? Infinity : Math.max(0, limit - usageSummary[key].used);
      }
    });

    res.json({
      tier,
      periodStart,
      periodEnd,
      usage: usageSummary,
    });
  } catch (error) {
    console.error('[Stripe] Usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

/**
 * Cancel subscription
 * POST /api/v1/billing/cancel
 */
router.post('/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const { immediately } = req.body;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    if (immediately) {
      // Cancel immediately
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      // Cancel at period end
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Update local record
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: !immediately,
        status: immediately ? 'canceled' : subscription.status,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'billing.subscription_cancelled',
      resource: 'subscription',
      resourceId: subscription.id,
      metadata: { immediately },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, immediately });
  } catch (error) {
    console.error('[Stripe] Cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * Reactivate canceled subscription
 * POST /api/v1/billing/reactivate
 */
router.post('/reactivate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    if (!subscription.cancelAtPeriodEnd) {
      return res.status(400).json({ error: 'Subscription is not scheduled for cancellation' });
    }

    // Reactivate
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // Update local record
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));

    // Log the action
    await db.insert(auditLogs).values({
      userId,
      action: 'billing.subscription_reactivated',
      resource: 'subscription',
      resourceId: subscription.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Stripe] Reactivate error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

/**
 * Stripe webhook handler
 * POST /api/v1/billing/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe] Webhook secret not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  console.log(`[Stripe] Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error(`[Stripe] Webhook handler error for ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as TierName;

  if (!userId || !tier) {
    console.error('[Stripe] Missing metadata in checkout session');
    return;
  }

  // Subscription is created via subscription.created webhook
  console.log(`[Stripe] Checkout completed for user ${userId}, tier ${tier}`);
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const tier = (subscription.metadata?.tier as TierName) || 'pro';

  if (!userId) {
    console.error('[Stripe] Missing userId in subscription metadata');
    return;
  }

  const subscriptionData = {
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id,
    tier,
    status: subscription.status === 'active' ? 'active' :
            subscription.status === 'trialing' ? 'trialing' :
            subscription.status === 'past_due' ? 'past_due' : 'canceled',
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    trialEndsAt: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) : null,
    updatedAt: new Date(),
  };

  // Upsert subscription
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  if (existing.length > 0) {
    await db
      .update(subscriptions)
      .set(subscriptionData)
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      ...subscriptionData,
    });
  }

  // Log the action
  await db.insert(auditLogs).values({
    userId,
    action: 'billing.subscription_updated',
    resource: 'subscription',
    metadata: { tier, status: subscriptionData.status },
  });

  console.log(`[Stripe] Subscription updated for user ${userId}: ${tier} (${subscriptionData.status})`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Stripe] Missing userId in subscription metadata');
    return;
  }

  // Downgrade to free tier
  await db
    .update(subscriptions)
    .set({
      tier: 'free',
      status: 'canceled',
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, userId));

  // Log the action
  await db.insert(auditLogs).values({
    userId,
    action: 'billing.subscription_deleted',
    resource: 'subscription',
  });

  console.log(`[Stripe] Subscription deleted for user ${userId}, downgraded to free`);
}

/**
 * Handle invoice paid
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string;

  // Find user by Stripe customer ID
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId));

  if (!subscription) {
    console.error('[Stripe] No subscription found for customer:', customerId);
    return;
  }

  // Record payment
  await db.insert(paymentHistory).values({
    userId: subscription.userId,
    stripePaymentIntentId: (invoice as any).payment_intent as string,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    description: `Subscription payment - ${subscription.tier}`,
    receiptUrl: invoice.hosted_invoice_url,
  });

  // Reset usage records for new period
  await db.delete(usageRecords).where(eq(usageRecords.userId, subscription.userId));

  console.log(`[Stripe] Invoice paid for user ${subscription.userId}: $${invoice.amount_paid / 100}`);
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId));

  if (!subscription) {
    return;
  }

  // Record failed payment
  await db.insert(paymentHistory).values({
    userId: subscription.userId,
    stripePaymentIntentId: (invoice as any).payment_intent as string,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    description: `Payment failed - ${subscription.tier}`,
  });

  // Update subscription status
  await db
    .update(subscriptions)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(subscriptions.userId, subscription.userId));

  console.log(`[Stripe] Invoice payment failed for user ${subscription.userId}`);

  // TODO: Send notification email to user
}

export default router;
