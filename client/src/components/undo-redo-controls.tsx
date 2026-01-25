/**
 * Undo/Redo Controls Component
 * Provides UI for undo/redo actions with history dropdown
 */

import { memo, useState } from 'react';
import { Undo2, Redo2, History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undoHistory: Array<{ id: string; description: string; timestamp: number }>;
  redoHistory: Array<{ id: string; description: string; timestamp: number }>;
  onUndo: () => void;
  onRedo: () => void;
  onClearHistory?: () => void;
  showHistoryDropdown?: boolean;
  className?: string;
}

/**
 * Format relative time (e.g., "2 min ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Get keyboard shortcut hint based on platform
 */
function getShortcutHint(action: 'undo' | 'redo'): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifier = isMac ? 'Cmd' : 'Ctrl';

  if (action === 'undo') {
    return `${modifier}+Z`;
  }
  return isMac ? `${modifier}+Shift+Z` : `${modifier}+Y`;
}

export const UndoRedoControls = memo(function UndoRedoControls({
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  undoHistory,
  redoHistory,
  onUndo,
  onRedo,
  onClearHistory,
  showHistoryDropdown = true,
  className,
}: UndoRedoControlsProps) {
  const hasHistory = undoHistory.length > 0 || redoHistory.length > 0;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Undo Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 w-8"
              aria-label="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>
              Undo{undoDescription ? `: ${undoDescription}` : ''}
              <span className="ml-2 text-muted-foreground">({getShortcutHint('undo')})</span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Redo Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 w-8"
              aria-label="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>
              Redo{redoDescription ? `: ${redoDescription}` : ''}
              <span className="ml-2 text-muted-foreground">({getShortcutHint('redo')})</span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* History Dropdown */}
      {showHistoryDropdown && hasHistory && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="History"
            >
              <History className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
            {/* Redo history (future states) */}
            {redoHistory.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Redo Stack
                </DropdownMenuLabel>
                {redoHistory.slice(0, 5).map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    className="flex justify-between items-center text-muted-foreground"
                    disabled
                  >
                    <span className="truncate">{entry.description}</span>
                    <span className="text-xs ml-2">{formatRelativeTime(entry.timestamp)}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* Current state marker */}
            <DropdownMenuLabel className="text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Current State
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Undo history (past states) */}
            {undoHistory.length > 0 ? (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Undo Stack ({undoHistory.length})
                </DropdownMenuLabel>
                {undoHistory.slice(0, 10).map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    className="flex justify-between items-center"
                  >
                    <span className="truncate">{entry.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </DropdownMenuItem>
                ))}
                {undoHistory.length > 10 && (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    ... and {undoHistory.length - 10} more
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No history
              </DropdownMenuItem>
            )}

            {/* Clear history option */}
            {onClearHistory && hasHistory && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onClearHistory}
                  className="text-destructive focus:text-destructive"
                >
                  Clear History
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});
