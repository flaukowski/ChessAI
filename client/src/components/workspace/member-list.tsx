"use client";

import * as React from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge, type WorkspaceRole } from "./role-badge";

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: WorkspaceRole;
}

interface MemberListProps {
  workspaceId: string;
  members: WorkspaceMember[];
  currentUserRole: WorkspaceRole;
  onRoleChange?: (memberId: string, newRole: WorkspaceRole) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  className?: string;
}

export function MemberList({
  workspaceId,
  members,
  currentUserRole,
  onRoleChange,
  onRemoveMember,
  className,
}: MemberListProps) {
  const [loadingStates, setLoadingStates] = React.useState<
    Record<string, boolean>
  >({});

  const isAdmin = currentUserRole === "admin";

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    if (!onRoleChange) return;

    setLoadingStates((prev) => ({ ...prev, [memberId]: true }));
    try {
      await onRoleChange(memberId, newRole);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!onRemoveMember) return;

    setLoadingStates((prev) => ({ ...prev, [`remove-${memberId}`]: true }));
    try {
      await onRemoveMember(memberId);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [`remove-${memberId}`]: false }));
    }
  };

  // API helper functions for external use
  const updateMemberRole = async (memberId: string, newRole: WorkspaceRole) => {
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to update member role");
    }
    return response.json();
  };

  const removeMember = async (memberId: string) => {
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to remove member");
    }
    return response.json();
  };

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Member</TableHead>
            <TableHead>Role</TableHead>
            {isAdmin && <TableHead className="w-[70px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 3 : 2}
                className="h-24 text-center text-muted-foreground"
              >
                No members found.
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={member.avatarUrl}
                      alt={member.displayName || member.email}
                      size="sm"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {member.displayName || "Unknown User"}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {member.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {isAdmin && member.role !== "admin" ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.uid, value as WorkspaceRole)
                      }
                      disabled={loadingStates[member.uid]}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {member.role !== "admin" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={loadingStates[`remove-${member.uid}`]}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRemoveMember(member.uid)}
                            className="text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Export API helper functions for use in parent components
export const memberListApi = {
  updateRole: async (
    workspaceId: string,
    memberId: string,
    newRole: WorkspaceRole
  ) => {
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to update member role");
    }
    return response.json();
  },

  remove: async (workspaceId: string, memberId: string) => {
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to remove member");
    }
    return response.json();
  },
};
