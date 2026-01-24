import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertTriangle, Mic, HardDrive, Sparkles } from "lucide-react";

export interface Usage {
  recordings: number;
  storage: number; // in bytes
  aiRequests: number;
}

export interface UsageLimits {
  recordings: number;
  storage: number; // in bytes
  aiRequests: number;
}

interface UsageDisplayProps {
  usage: Usage;
  limits: UsageLimits;
  className?: string;
}

interface UsageItemProps {
  label: string;
  icon: React.ReactNode;
  current: number;
  limit: number;
  formatValue?: (value: number) => string;
  warningThreshold?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function UsageItem({
  label,
  icon,
  current,
  limit,
  formatValue = formatNumber,
  warningThreshold = 80,
}: UsageItemProps) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isWarning = percentage >= warningThreshold;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isWarning && !isAtLimit && (
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
          )}
          {isAtLimit && (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          )}
          <span
            className={cn(
              "text-muted-foreground",
              isWarning && !isAtLimit && "text-yellow-400",
              isAtLimit && "text-red-400"
            )}
          >
            {formatValue(current)} / {formatValue(limit)}
          </span>
        </div>
      </div>
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          isAtLimit && "[&>div]:bg-red-500",
          isWarning && !isAtLimit && "[&>div]:bg-yellow-500"
        )}
      />
      {isAtLimit && (
        <p className="text-xs text-red-400">
          You have reached your limit. Upgrade to continue.
        </p>
      )}
      {isWarning && !isAtLimit && (
        <p className="text-xs text-yellow-400">
          Approaching limit. Consider upgrading soon.
        </p>
      )}
    </div>
  );
}

export function UsageDisplay({ usage, limits, className }: UsageDisplayProps) {
  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <CardTitle className="text-xl">Usage</CardTitle>
        <CardDescription>
          Your current usage for this billing period
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <UsageItem
          label="Recordings"
          icon={<Mic className="h-4 w-4" />}
          current={usage.recordings}
          limit={limits.recordings}
        />

        <UsageItem
          label="Storage"
          icon={<HardDrive className="h-4 w-4" />}
          current={usage.storage}
          limit={limits.storage}
          formatValue={formatBytes}
        />

        <UsageItem
          label="AI Requests"
          icon={<Sparkles className="h-4 w-4" />}
          current={usage.aiRequests}
          limit={limits.aiRequests}
        />
      </CardContent>
    </Card>
  );
}
