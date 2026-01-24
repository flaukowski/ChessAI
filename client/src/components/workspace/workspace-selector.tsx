"use client";

import * as React from "react";
import { ChevronDown, Building2, User, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface Workspace {
  id: string;
  name: string;
  role?: "admin" | "editor" | "viewer";
}

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelect: (workspace: Workspace | null) => void;
  onCreateNew?: () => void;
  className?: string;
}

export function WorkspaceSelector({
  workspaces,
  currentWorkspace,
  onSelect,
  onCreateNew,
  className,
}: WorkspaceSelectorProps) {
  const displayName = currentWorkspace?.name || "Personal";
  const isPersonal = !currentWorkspace;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-2 px-3 py-2 h-auto",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {isPersonal ? (
              <User className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{displayName}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Personal option */}
        <DropdownMenuItem
          onClick={() => onSelect(null)}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Personal</span>
          </div>
          {isPersonal && <Check className="h-4 w-4" />}
        </DropdownMenuItem>

        {workspaces.length > 0 && <DropdownMenuSeparator />}

        {/* Workspace list */}
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => onSelect(workspace)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{workspace.name}</span>
            </div>
            {currentWorkspace?.id === workspace.id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}

        {onCreateNew && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCreateNew}
              className="flex items-center gap-2 cursor-pointer text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
