import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TierBadge, SubscriptionTier } from "./tier-badge";
import { cn } from "@/lib/utils";
import { Calendar, CreditCard, Settings } from "lucide-react";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing";

export interface Subscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  renewsAt: Date | null;
  price: number;
}

interface SubscriptionCardProps {
  subscription: Subscription;
  onUpgrade?: () => void;
  onManage?: () => void;
  className?: string;
}

const statusConfig: Record<
  SubscriptionStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-green-500/20 text-green-400 border-green-500/50",
  },
  canceled: {
    label: "Canceled",
    className: "bg-red-500/20 text-red-400 border-red-500/50",
  },
  past_due: {
    label: "Past Due",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  },
  trialing: {
    label: "Trial",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function SubscriptionCard({
  subscription,
  onUpgrade,
  onManage,
  className,
}: SubscriptionCardProps) {
  const { tier, status, renewsAt, price } = subscription;
  const statusInfo = statusConfig[status];
  const canUpgrade = tier !== "studio";
  const showManage = tier !== "free";

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Current Plan</CardTitle>
          <div className="flex items-center gap-2">
            <TierBadge tier={tier} />
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
          </div>
        </div>
        <CardDescription>
          Manage your subscription and billing settings
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {price > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Price:</span>
            <span className="font-medium">{formatPrice(price)}/month</span>
          </div>
        )}

        {renewsAt && status === "active" && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Renews:</span>
            <span className="font-medium">{formatDate(renewsAt)}</span>
          </div>
        )}

        {renewsAt && status === "canceled" && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Access until:</span>
            <span className="font-medium">{formatDate(renewsAt)}</span>
          </div>
        )}

        {status === "past_due" && (
          <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-400">
            Your payment is past due. Please update your payment method to
            continue your subscription.
          </div>
        )}

        {status === "trialing" && renewsAt && (
          <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-400">
            Your trial ends on {formatDate(renewsAt)}. Upgrade to continue
            access.
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        {canUpgrade && (
          <Button onClick={onUpgrade} className="flex-1">
            Upgrade Plan
          </Button>
        )}
        {showManage && (
          <Button
            variant="outline"
            onClick={onManage}
            className={canUpgrade ? "" : "flex-1"}
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
        )}
        {!canUpgrade && !showManage && (
          <Button onClick={onUpgrade} className="flex-1">
            Get Started
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
