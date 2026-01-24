/**
 * Admin Subscriptions Management Page
 * Subscription list, tier filters, and revenue charts
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/lib/space-child-auth";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Crown,
  Shield,
  User,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";

interface Subscription {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  tier: "free" | "pro" | "enterprise";
  status: "active" | "cancelled" | "past_due" | "trialing";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amount: number;
  interval: "month" | "year";
  createdAt: string;
}

interface RevenueData {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  revenueGrowth: number;
  averageRevenuePerUser: number;
  subscriptionsByTier: {
    free: number;
    pro: number;
    enterprise: number;
  };
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    subscriptions: number;
  }>;
  subscriptions: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type TierFilter = "all" | "pro" | "enterprise";
type StatusFilter = "all" | "active" | "cancelled" | "past_due" | "trialing";
type TimeRange = "7d" | "30d" | "90d" | "12m";

function TierBadge({ tier }: { tier: Subscription["tier"] }) {
  switch (tier) {
    case "enterprise":
      return (
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Enterprise
        </Badge>
      );
    case "pro":
      return (
        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
          <Shield className="w-3 h-3 mr-1" />
          Pro
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
          <User className="w-3 h-3 mr-1" />
          Free
        </Badge>
      );
  }
}

function StatusBadge({ status }: { status: Subscription["status"] }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>
      );
    case "past_due":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Past Due</Badge>
      );
    case "trialing":
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Trial</Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RevenueChart({ data }: { data: RevenueData["monthlyRevenue"] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-gray-400">No revenue data available</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue));

  return (
    <div className="h-64 flex items-end gap-2 pt-8 pb-4">
      {data.map((item, index) => {
        const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div className="relative w-full flex justify-center">
              <div
                className="w-full max-w-12 bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-t-sm transition-all hover:from-cyan-400 hover:to-cyan-300"
                style={{ height: `${Math.max(height, 4)}%`, minHeight: "8px" }}
              />
              <div className="absolute -top-6 text-xs text-gray-400 whitespace-nowrap">
                {formatCurrency(item.revenue)}
              </div>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{item.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  loading,
  prefix = "",
}: {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  prefix?: string;
}) {
  if (loading) {
    return (
      <Card className="bg-slate-800 border-white/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-white/10">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">
              {prefix}
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {change >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                )}
                <span className={change >= 0 ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
                  {change >= 0 ? "+" : ""}
                  {change}%
                </span>
              </div>
            )}
          </div>
          <div className="p-3 bg-cyan-500/10 rounded-full">
            <Icon className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminSubscriptions() {
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const {
    data: revenueData,
    isLoading,
    error,
    refetch,
  } = useQuery<RevenueData>({
    queryKey: ["admin", "revenue", { page, pageSize, tier: tierFilter, status: statusFilter, timeRange }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        timeRange,
      });
      if (tierFilter !== "all") params.set("tier", tierFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await authFetch(`/api/v1/admin/revenue?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch revenue data");
      }
      return response.json();
    },
  });

  const subscriptions = revenueData?.subscriptions ?? [];
  const totalPages = revenueData?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Subscriptions & Revenue</h1>
            <p className="text-gray-400">Monitor subscription metrics and revenue performance</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[120px] bg-slate-700 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-white/10">
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-white/10 text-gray-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={revenueData?.totalRevenue ?? 0}
            icon={DollarSign}
            loading={isLoading}
            prefix="$"
          />
          <StatCard
            title="Monthly Recurring Revenue"
            value={revenueData?.monthlyRecurringRevenue ?? 0}
            change={revenueData?.revenueGrowth}
            icon={TrendingUp}
            loading={isLoading}
            prefix="$"
          />
          <StatCard
            title="Avg Revenue Per User"
            value={revenueData?.averageRevenuePerUser?.toFixed(2) ?? "0.00"}
            icon={Users}
            loading={isLoading}
            prefix="$"
          />
          <StatCard
            title="Total Paid Subscribers"
            value={(revenueData?.subscriptionsByTier?.pro ?? 0) + (revenueData?.subscriptionsByTier?.enterprise ?? 0)}
            icon={CreditCard}
            loading={isLoading}
          />
        </div>

        {/* Charts and Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2 bg-slate-800 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    Revenue Over Time
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Monthly revenue breakdown
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <RevenueChart data={revenueData?.monthlyRevenue ?? []} />
              )}
            </CardContent>
          </Card>

          {/* Tier Breakdown */}
          <Card className="bg-slate-800 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Subscription Breakdown</CardTitle>
              <CardDescription className="text-gray-400">Users by tier</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-500/20 rounded-full">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-white">Free</span>
                    </div>
                    <span className="text-2xl font-bold text-white">
                      {revenueData?.subscriptionsByTier?.free ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/20 rounded-full">
                        <Shield className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-white">Pro</span>
                    </div>
                    <span className="text-2xl font-bold text-cyan-400">
                      {revenueData?.subscriptionsByTier?.pro ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-full">
                        <Crown className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-white">Enterprise</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-400">
                      {revenueData?.subscriptionsByTier?.enterprise ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions Table */}
        <Card className="bg-slate-800 border-white/10">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  All Subscriptions
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {revenueData?.total ?? 0} total subscriptions
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v as TierFilter); setPage(1); }}>
                  <SelectTrigger className="w-[130px] bg-slate-700 border-white/10 text-white">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-white/10">
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
                  <SelectTrigger className="w-[130px] bg-slate-700 border-white/10 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-white/10">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="trialing">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : subscriptions.length > 0 ? (
              <>
                <div className="rounded-md border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400">User</TableHead>
                        <TableHead className="text-gray-400">Tier</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Amount</TableHead>
                        <TableHead className="text-gray-400">Period</TableHead>
                        <TableHead className="text-gray-400">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((subscription) => (
                        <TableRow key={subscription.id} className="border-white/10 hover:bg-white/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                <span className="text-lg font-medium text-cyan-400">
                                  {(subscription.userName?.[0] || subscription.userEmail[0]).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-white font-medium">
                                  {subscription.userName || "No name"}
                                </p>
                                <p className="text-sm text-gray-400">{subscription.userEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TierBadge tier={subscription.tier} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={subscription.status} />
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {formatCurrency(subscription.amount)}
                            <span className="text-gray-500 text-sm">/{subscription.interval}</span>
                          </TableCell>
                          <TableCell className="text-gray-400">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {formatDate(subscription.currentPeriodStart)} -{" "}
                                {formatDate(subscription.currentPeriodEnd)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {formatDate(subscription.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-400">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, revenueData?.total ?? 0)} of {revenueData?.total ?? 0}{" "}
                    subscriptions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="border-white/10 text-gray-300 hover:text-white disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-gray-400 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      className="border-white/10 text-gray-300 hover:text-white disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No subscriptions found</p>
                <p className="text-gray-500 text-sm">Try adjusting your filters</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <CreditCard className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-medium">Failed to load subscription data</p>
                  <p className="text-red-400/70 text-sm">
                    Please try refreshing the page or contact support if the issue persists.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="ml-auto border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminSubscriptions;
