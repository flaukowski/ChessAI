import { cn } from "@/lib/utils";

export type WorkspaceRole = "admin" | "editor" | "viewer";

interface RoleBadgeProps {
  role: WorkspaceRole;
  className?: string;
}

const roleConfig: Record<
  WorkspaceRole,
  { label: string; bgColor: string; textColor: string }
> = {
  admin: {
    label: "Admin",
    bgColor: "bg-red-500/20",
    textColor: "text-red-400",
  },
  editor: {
    label: "Editor",
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-400",
  },
  viewer: {
    label: "Viewer",
    bgColor: "bg-gray-500/20",
    textColor: "text-gray-400",
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.label}
    </span>
  );
}
