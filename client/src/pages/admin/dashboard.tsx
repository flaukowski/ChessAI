/**
 * Admin Dashboard Page
 * Overview stats, recent activity, and quick actions
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { authFetch } from "@/lib/space-child-auth";
import {
  Users,
  CreditCard,
  DollarSign,
  Mic,
  TrendingUp,
  TrendingDown,
  Activity,
  UserPlus,
  Settings,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Link } from "wouter";

interface OverviewStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  totalRecordings: number;
  userGrowth: number;
  subscriptionGrowth: number;
  revenueGrowth: number;
  recordingsGrowth: number;
}

interface ActivityItem {
  id: string;
  type: "user_registered" | "subscription_created" | "subscription_cancelled" | "recording_created";
  description: string;
  timestamp: string;
  metadata?: {
    userId?: string;
    userEmail?: string;
    tier?: string;
    amount?: number;
  };
}

interface OverviewResponse {
  stats: OverviewStats;
  recentActivity: ActivityItem[];
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
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  prefix?: string;
}) {
  const isPositive = change >= 0;

  if (loading) {
    return (
      <Card className="bg-slate-800 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
        <div className="p-2 bg-cyan-500/10 rounded-full">
          <Icon className="w-4 h-4 text-cyan-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">
          {prefix}
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-green-400" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-400" />
          )}
          <span className={isPositive ? "text-green-400" : "text-red-400"}>
            {isPositive ? "+" : ""}
            {change}%
          </span>
          <span className="text-gray-500 text-sm">vs last month</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  switch (type) {
    case "user_registered":
      return <UserPlus className="w-4 h-4 text-green-400" />;
    case "subscription_created":
      return <CreditCard className="w-4 h-4 text-cyan-400" />;
    case "subscription_cancelled":
      return <CreditCard className="w-4 h-4 text-red-400" />;
    case "recording_created":
      return <Mic className="w-4 h-4 text-purple-400" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
}

function ActivityBadge({ type }: { type: ActivityItem["type"] }) {
  switch (type) {
    case "user_registered":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">New User</Badge>;
    case "subscription_created":
      return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Subscription</Badge>;
    case "subscription_cancelled":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>;
    case "recording_created":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Recording</Badge>;
    default:
      return <Badge variant="secondary">Activity</Badge>;
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function AdminDashboard() {
  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useQuery<OverviewResponse>({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const response = await authFetch("/api/v1/admin/overview");
      if (!response.ok) {
        throw new Error("Failed to fetch overview data");
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400">Welcome back! Here's what's happening with AudioNoise.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-white/10 text-gray-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={overview?.stats.totalUsers ?? 0}
            change={overview?.stats.userGrowth ?? 0}
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            title="Active Subscriptions"
            value={overview?.stats.activeSubscriptions ?? 0}
            change={overview?.stats.subscriptionGrowth ?? 0}
            icon={CreditCard}
            loading={isLoading}
          />
          <StatCard
            title="Monthly Revenue"
            value={overview?.stats.monthlyRevenue ?? 0}
            change={overview?.stats.revenueGrowth ?? 0}
            icon={DollarSign}
            loading={isLoading}
            prefix="$"
          />
          <StatCard
            title="Total Recordings"
            value={overview?.stats.totalRecordings ?? 0}
            change={overview?.stats.recordingsGrowth ?? 0}
            icon={Mic}
            loading={isLoading}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 bg-slate-800 border-white/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                  <CardDescription className="text-gray-400">
                    Latest events across the platform
                  </CardDescription>
                </div>
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : overview?.recentActivity && overview.recentActivity.length > 0 ? (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {overview.recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="p-2 bg-slate-700 rounded-full">
                          <ActivityIcon type={activity.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <ActivityBadge type={activity.type} />
                          </div>
                          <p className="text-sm text-white">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-slate-800 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
              <CardDescription className="text-gray-400">
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/admin/users">
                <Button
                  variant="outline"
                  className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
                >
                  <Users className="w-4 h-4 mr-3" />
                  Manage Users
                </Button>
              </Link>
              <Link href="/admin/subscriptions">
                <Button
                  variant="outline"
                  className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
                >
                  <CreditCard className="w-4 h-4 mr-3" />
                  View Subscriptions
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
              >
                <UserPlus className="w-4 h-4 mr-3" />
                Invite New User
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
              >
                <Download className="w-4 h-4 mr-3" />
                Download User Data
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
              >
                <Settings className="w-4 h-4 mr-3" />
                System Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <Activity className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-medium">Failed to load dashboard data</p>
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

export default AdminDashboard;
