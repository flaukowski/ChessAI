/**
 * Billing & Subscription Management Page
 * Displays subscription status, usage metrics, billing history, and plan management
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  CreditCard,
  Loader2,
  Crown,
  Zap,
  HardDrive,
  Mic,
  Sparkles,
  Calendar,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLocation } from 'wouter';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import alienOctopusLogo from '@assets/IMG_20251007_202557_1766540112397_1768261396578.png';

// TypeScript interfaces
interface SubscriptionPlan {
  id: string;
  name: 'Free' | 'Pro' | 'Studio';
  price: number;
  interval: 'month' | 'year';
}

interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  plan: SubscriptionPlan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface UsageMetrics {
  recordings: {
    used: number;
    limit: number;
    unlimited: boolean;
  };
  storage: {
    usedMB: number;
    limitMB: number;
    unlimited: boolean;
  };
  aiRequests: {
    used: number;
    limit: number;
    unlimited: boolean;
    resetDate: string;
  };
}

interface BillingHistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoiceUrl?: string;
}

interface PlanDetails {
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  priceId: string;
}

const PLANS: PlanDetails[] = [
  {
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '5 recordings per month',
      '500MB storage',
      '10 AI requests per month',
      'Basic effects',
    ],
    priceId: 'free',
  },
  {
    name: 'Pro',
    price: 9.99,
    interval: 'month',
    features: [
      '50 recordings per month',
      '5GB storage',
      '100 AI requests per month',
      'All effects',
      'Priority support',
    ],
    priceId: 'price_pro_monthly',
  },
  {
    name: 'Studio',
    price: 24.99,
    interval: 'month',
    features: [
      'Unlimited recordings',
      '50GB storage',
      'Unlimited AI requests',
      'All effects',
      'Priority support',
      'Custom presets',
      'Team collaboration',
    ],
    priceId: 'price_studio_monthly',
  },
];

export default function Billing() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useSpaceChildAuth();

  // State
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);

  // Helper to get request options with credentials (uses HttpOnly cookies for auth)
  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
    };
  }, []);

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoadingSubscription(true);
      const response = await fetch('/api/v1/billing/subscription', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/');
          return;
        }
        throw new Error('Failed to fetch subscription');
      }

      const data = await response.json();
      setSubscription(data.subscription);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingSubscription(false);
    }
  }, [getAuthHeaders, navigate]);

  // Fetch usage data
  const fetchUsage = useCallback(async () => {
    try {
      setIsLoadingUsage(true);
      const response = await fetch('/api/v1/billing/usage', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }

      const data = await response.json();
      setUsage(data.usage);
    } catch (err: any) {
      console.error('Failed to fetch usage:', err);
    } finally {
      setIsLoadingUsage(false);
    }
  }, [getAuthHeaders]);

  // Fetch billing history
  const fetchBillingHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch('/api/v1/billing/history', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch billing history');
      }

      const data = await response.json();
      setBillingHistory(data.history || []);
    } catch (err: any) {
      console.error('Failed to fetch billing history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [getAuthHeaders]);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscription();
      fetchUsage();
      fetchBillingHistory();
    }
  }, [isAuthenticated, fetchSubscription, fetchUsage, fetchBillingHistory]);

  // Handle checkout for upgrade/downgrade
  const handleCheckout = async (priceId: string) => {
    try {
      setActionLoading('checkout');
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
      setUpgradeDialogOpen(false);
    }
  };

  // Handle manage billing (Stripe portal)
  const handleManageBilling = async () => {
    try {
      setActionLoading('portal');
      const response = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open billing portal');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle cancel subscription
  const handleCancelSubscription = async () => {
    try {
      setActionLoading('cancel');
      const response = await fetch('/api/v1/billing/cancel', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Refresh subscription data
      await fetchSubscription();
      setCancelDialogOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Get plan badge color
  const getPlanBadgeVariant = (planName: string) => {
    switch (planName) {
      case 'Studio':
        return 'default';
      case 'Pro':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'default';
      case 'past_due':
        return 'destructive';
      case 'canceled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  // Calculate usage percentage
  const getUsagePercentage = (used: number, limit: number, unlimited: boolean) => {
    if (unlimited) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  // Show loading state while auth is being verified
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0118] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <Loader2 className="w-12 h-12 text-cyan-500" />
          </motion.div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between h-16 px-6 max-w-6xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={alienOctopusLogo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl">AudioNoise Web</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Page Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-full bg-cyan-500/20">
              <CreditCard className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Billing & Subscription</h1>
              <p className="text-gray-400">Manage your subscription and view usage</p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Subscription & Usage */}
            <div className="lg:col-span-2 space-y-6">
              {/* Current Subscription Card */}
              <Card className="bg-slate-900 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    Current Subscription
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Your active plan and billing cycle
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSubscription ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  ) : subscription ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={getPlanBadgeVariant(subscription.plan.name)}
                          className="text-lg px-4 py-1"
                        >
                          {subscription.plan.name}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(subscription.status)}>
                          {subscription.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {subscription.status === 'canceled' && <XCircle className="w-3 h-3 mr-1" />}
                          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                        </Badge>
                      </div>

                      {subscription.plan.price > 0 && (
                        <p className="text-2xl font-bold text-white">
                          {formatCurrency(subscription.plan.price)}
                          <span className="text-sm font-normal text-gray-400">
                            /{subscription.plan.interval}
                          </span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Current period: {formatDate(subscription.currentPeriodStart)} -{' '}
                          {formatDate(subscription.currentPeriodEnd)}
                        </span>
                      </div>

                      {subscription.cancelAtPeriodEnd && (
                        <Alert className="bg-yellow-500/10 border-yellow-500/30">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          <AlertDescription className="text-yellow-400">
                            Your subscription will be canceled at the end of the current billing period.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex flex-wrap gap-3 pt-4">
                        {subscription.plan.name !== 'Studio' && (
                          <Button
                            onClick={() => setUpgradeDialogOpen(true)}
                            disabled={actionLoading !== null}
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            Upgrade Plan
                          </Button>
                        )}

                        {subscription.plan.price > 0 && (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleManageBilling}
                              disabled={actionLoading === 'portal'}
                            >
                              {actionLoading === 'portal' ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <ExternalLink className="w-4 h-4 mr-2" />
                              )}
                              Manage Billing
                            </Button>

                            {!subscription.cancelAtPeriodEnd && (
                              <Button
                                variant="destructive"
                                onClick={() => setCancelDialogOpen(true)}
                                disabled={actionLoading !== null}
                              >
                                Cancel Subscription
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-lg px-4 py-1">
                          Free
                        </Badge>
                      </div>
                      <p className="text-gray-400">
                        You are currently on the free plan. Upgrade to unlock more features!
                      </p>
                      <Button onClick={() => setUpgradeDialogOpen(true)}>
                        <Zap className="w-4 h-4 mr-2" />
                        Upgrade Plan
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Usage Metrics Card */}
              <Card className="bg-slate-900 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Usage This Month
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Track your resource usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingUsage ? (
                    <div className="space-y-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : usage ? (
                    <div className="space-y-6">
                      {/* Recordings Usage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mic className="w-4 h-4 text-cyan-400" />
                            <span className="font-medium text-white">Recordings</span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {usage.recordings.unlimited
                              ? `${usage.recordings.used} (Unlimited)`
                              : `${usage.recordings.used} / ${usage.recordings.limit}`}
                          </span>
                        </div>
                        {!usage.recordings.unlimited && (
                          <Progress
                            value={getUsagePercentage(
                              usage.recordings.used,
                              usage.recordings.limit,
                              usage.recordings.unlimited
                            )}
                            className="h-2"
                          />
                        )}
                      </div>

                      {/* Storage Usage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-green-400" />
                            <span className="font-medium text-white">Storage</span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {usage.storage.unlimited
                              ? `${(usage.storage.usedMB / 1024).toFixed(2)} GB (Unlimited)`
                              : `${(usage.storage.usedMB / 1024).toFixed(2)} GB / ${(usage.storage.limitMB / 1024).toFixed(0)} GB`}
                          </span>
                        </div>
                        {!usage.storage.unlimited && (
                          <Progress
                            value={getUsagePercentage(
                              usage.storage.usedMB,
                              usage.storage.limitMB,
                              usage.storage.unlimited
                            )}
                            className="h-2"
                          />
                        )}
                      </div>

                      {/* AI Requests Usage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="font-medium text-white">AI Requests</span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {usage.aiRequests.unlimited
                              ? `${usage.aiRequests.used} (Unlimited)`
                              : `${usage.aiRequests.used} / ${usage.aiRequests.limit}`}
                          </span>
                        </div>
                        {!usage.aiRequests.unlimited && (
                          <Progress
                            value={getUsagePercentage(
                              usage.aiRequests.used,
                              usage.aiRequests.limit,
                              usage.aiRequests.unlimited
                            )}
                            className="h-2"
                          />
                        )}
                        <p className="text-xs text-gray-500">
                          Resets on {formatDate(usage.aiRequests.resetDate)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400">Unable to load usage data</p>
                  )}
                </CardContent>
              </Card>

              {/* Billing History Card */}
              <Card className="bg-slate-900 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Billing History
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Your past invoices and payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingHistory ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : billingHistory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-gray-400">Date</TableHead>
                          <TableHead className="text-gray-400">Description</TableHead>
                          <TableHead className="text-gray-400">Amount</TableHead>
                          <TableHead className="text-gray-400">Status</TableHead>
                          <TableHead className="text-gray-400"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingHistory.map((item) => (
                          <TableRow key={item.id} className="border-white/10">
                            <TableCell className="text-white">{formatDate(item.date)}</TableCell>
                            <TableCell className="text-gray-300">{item.description}</TableCell>
                            <TableCell className="text-white">
                              {formatCurrency(item.amount, item.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === 'paid'
                                    ? 'default'
                                    : item.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.invoiceUrl && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={item.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-400 text-center py-8">No billing history yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Plan Comparison */}
            <div className="space-y-6">
              <Card className="bg-slate-900 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Available Plans</CardTitle>
                  <CardDescription className="text-gray-400">
                    Choose the plan that fits your needs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.name}
                      className={`p-4 rounded-lg border transition-all ${
                        subscription?.plan.name === plan.name
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-white">{plan.name}</h3>
                        <span className="text-lg font-bold text-white">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          {plan.price > 0 && (
                            <span className="text-xs font-normal text-gray-400">/mo</span>
                          )}
                        </span>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-400">
                        {plan.features.slice(0, 3).map((feature, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-gray-500">+{plan.features.length - 3} more</li>
                        )}
                      </ul>
                      {subscription?.plan.name !== plan.name && plan.price > 0 && (
                        <Button
                          className="w-full mt-3"
                          size="sm"
                          onClick={() => {
                            setSelectedPlan(plan);
                            setUpgradeDialogOpen(true);
                          }}
                        >
                          {subscription?.plan.name === 'Studio' ? 'Downgrade' : 'Upgrade'}
                        </Button>
                      )}
                      {subscription?.plan.name === plan.name && (
                        <Badge className="mt-3" variant="secondary">
                          Current Plan
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="bg-slate-900 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a
                    href="/support"
                    className="block p-3 rounded-lg border border-white/10 hover:border-cyan-500/50 transition-colors"
                  >
                    <p className="font-medium text-white">Contact Support</p>
                    <p className="text-sm text-gray-400">Get help with billing issues</p>
                  </a>
                  <a
                    href="/terms"
                    className="block p-3 rounded-lg border border-white/10 hover:border-purple-500/50 transition-colors"
                  >
                    <p className="font-medium text-white">Terms of Service</p>
                    <p className="text-sm text-gray-400">Read our terms and conditions</p>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Cancel Subscription</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel your subscription? You will continue to have access
              until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={actionLoading === 'cancel'}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={actionLoading === 'cancel'}
            >
              {actionLoading === 'cancel' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Cancel Subscription'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Plan Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Choose a Plan</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select the plan that best fits your needs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {PLANS.filter((p) => p.price > 0).map((plan) => (
              <div
                key={plan.name}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedPlan?.name === plan.name
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-white/10 hover:border-white/30'
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white text-lg">{plan.name}</h3>
                  <span className="text-xl font-bold text-white">
                    ${plan.price}
                    <span className="text-sm font-normal text-gray-400">/mo</span>
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-gray-400">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpgradeDialogOpen(false)}
              disabled={actionLoading === 'checkout'}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPlan && handleCheckout(selectedPlan.priceId)}
              disabled={!selectedPlan || actionLoading === 'checkout'}
            >
              {actionLoading === 'checkout' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Upgrade to {selectedPlan?.name}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          2025 AudioNoise Web. GPL v2 License.
        </div>
      </footer>
    </div>
  );
}
