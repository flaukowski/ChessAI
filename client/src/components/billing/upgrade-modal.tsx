import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TierBadge, SubscriptionTier } from "./tier-badge";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: SubscriptionTier;
  onUpgrade: (tier: SubscriptionTier) => Promise<void>;
}

interface PlanFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  studio: boolean | string;
}

const plans: {
  tier: SubscriptionTier;
  name: string;
  price: number;
  description: string;
}[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    description: "Get started with basic features",
  },
  {
    tier: "pro",
    name: "Pro",
    price: 9.99,
    description: "For serious musicians and creators",
  },
  {
    tier: "studio",
    name: "Studio",
    price: 24.99,
    description: "Professional studio features",
  },
];

const features: PlanFeature[] = [
  { name: "Recordings per month", free: "10", pro: "100", studio: "Unlimited" },
  { name: "Storage", free: "500 MB", pro: "10 GB", studio: "100 GB" },
  { name: "AI Requests", free: "5", pro: "100", studio: "Unlimited" },
  { name: "Basic effects", free: true, pro: true, studio: true },
  { name: "Premium effects", free: false, pro: true, studio: true },
  { name: "High-quality export", free: false, pro: true, studio: true },
  { name: "AI Mastering", free: false, pro: true, studio: true },
  { name: "Collaboration", free: false, pro: false, studio: true },
  { name: "Priority support", free: false, pro: false, studio: true },
  { name: "Custom branding", free: false, pro: false, studio: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium">{value}</span>;
  }
  return value ? (
    <Check className="h-4 w-4 text-green-400" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground/50" />
  );
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function UpgradeModal({
  open,
  onOpenChange,
  currentTier,
  onUpgrade,
}: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] =
    React.useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleCheckout = async () => {
    if (!selectedTier || selectedTier === currentTier) return;

    setIsLoading(true);
    try {
      await onUpgrade(selectedTier);
    } finally {
      setIsLoading(false);
    }
  };

  const tierOrder: SubscriptionTier[] = ["free", "pro", "studio"];
  const currentTierIndex = tierOrder.indexOf(currentTier);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4">
          {plans.map((plan) => {
            const tierIndex = tierOrder.indexOf(plan.tier);
            const isCurrentPlan = plan.tier === currentTier;
            const isDowngrade = tierIndex < currentTierIndex;
            const isSelected = plan.tier === selectedTier;

            return (
              <div
                key={plan.tier}
                onClick={() => {
                  if (!isCurrentPlan && !isDowngrade) {
                    setSelectedTier(plan.tier);
                  }
                }}
                className={cn(
                  "relative rounded-lg border p-4 cursor-pointer transition-all",
                  isSelected && "border-primary ring-2 ring-primary",
                  isCurrentPlan && "border-muted bg-muted/50 cursor-default",
                  isDowngrade && "opacity-50 cursor-not-allowed",
                  !isSelected &&
                    !isCurrentPlan &&
                    !isDowngrade &&
                    "hover:border-primary/50"
                )}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <TierBadge tier={plan.tier} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {formatPrice(plan.price)}
                      {plan.price > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          /mo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.tier} className="text-center p-3 font-medium">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature.name}
                  className={cn(
                    "border-b last:border-b-0",
                    index % 2 === 0 && "bg-muted/20"
                  )}
                >
                  <td className="p-3 text-sm">{feature.name}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center">
                      <FeatureValue value={feature.free} />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center">
                      <FeatureValue value={feature.pro} />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center">
                      <FeatureValue value={feature.studio} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={
              !selectedTier || selectedTier === currentTier || isLoading
            }
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedTier && selectedTier !== currentTier
              ? `Upgrade to ${plans.find((p) => p.tier === selectedTier)?.name}`
              : "Select a Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to call the checkout API
export async function initiateCheckout(
  tier: SubscriptionTier
): Promise<{ checkoutUrl: string }> {
  const response = await fetch("/api/v1/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tier }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to initiate checkout");
  }

  return response.json();
}
