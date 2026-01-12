/**
 * MoneyDevKit Billing Routes for SonicVision
 * Handles subscription management via Stripe
 */

import { Router, Request, Response } from 'express';

const router = Router();

// In production, these would come from environment variables
const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_sonicvision_pro_monthly',
};

// Subscription tiers configuration
const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['5 AI generations/day', 'Basic export', '128kbps quality'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 500, // $5.00 in cents
    features: ['Unlimited AI generations', 'AudioNoise DSP', 'Hi-Fi export', 'Priority support'],
  },
};

// Get current subscription status
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    // In production, fetch from database based on authenticated user
    const userId = (req.session as any)?.userId;
    
    if (!userId) {
      return res.json({ tier: 'free', status: 'none' });
    }

    // Mock subscription data - replace with actual database lookup
    // const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
    
    res.json({
      tier: 'free',
      status: 'none',
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create checkout session for upgrading to Pro
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { tierId } = req.body;
    
    if (tierId !== 'pro') {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    // In production, use Stripe SDK:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   payment_method_types: ['card'],
    //   line_items: [{ price: STRIPE_PRICES.pro, quantity: 1 }],
    //   success_url: `${process.env.APP_URL}/studio?upgraded=true`,
    //   cancel_url: `${process.env.APP_URL}/#pricing`,
    //   customer_email: req.user?.email,
    // });

    // Mock checkout URL for demo
    const checkoutUrl = `https://checkout.stripe.com/demo?tier=${tierId}&price=$5`;
    
    res.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create customer portal session for managing subscription
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // In production, use Stripe SDK:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const session = await stripe.billingPortal.sessions.create({
    //   customer: customerId,
    //   return_url: `${process.env.APP_URL}/studio`,
    // });

    // Mock portal URL for demo
    const portalUrl = 'https://billing.stripe.com/demo/portal';
    
    res.json({ url: portalUrl });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Cancel subscription
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // In production:
    // const subscription = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // await stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: true });

    res.json({ success: true, message: 'Subscription will be canceled at end of billing period' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // In production, verify webhook signature:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const event = stripe.webhooks.constructEvent(
    //   req.body,
    //   req.headers['stripe-signature'],
    //   process.env.STRIPE_WEBHOOK_SECRET
    // );

    const event = req.body;

    switch (event.type) {
      case 'checkout.session.completed':
        // Create subscription record in database
        console.log('Checkout completed:', event.data.object);
        break;
      
      case 'customer.subscription.updated':
        // Update subscription status
        console.log('Subscription updated:', event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        // Mark subscription as canceled
        console.log('Subscription deleted:', event.data.object);
        break;
      
      case 'invoice.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook failed' });
  }
});

export default router;
