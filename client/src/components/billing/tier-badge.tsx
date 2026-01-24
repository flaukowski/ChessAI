import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SubscriptionTier = "free" | "pro" | "studio";

interface TierBadgeProps {
  tier: SubscriptionTier;
  className?: string;
}

const tierConfig: Record<
  SubscriptionTier,
  { label: string; className: string }
> = {
  free: {
    label: "Free",
    className: "bg-gray-500 text-white hover:bg-gray-500/80 border-gray-600",
  },
  pro: {
    label: "Pro",
    className: "bg-blue-500 text-white hover:bg-blue-500/80 border-blue-600",
  },
  studio: {
    label: "Studio",
    className:
      "bg-purple-500 text-white hover:bg-purple-500/80 border-purple-600",
  },
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <Badge className={cn(config.className, className)}>{config.label}</Badge>
  );
}
