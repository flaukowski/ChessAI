/**
 * Keyboard Shortcuts Dialog
 * Displays all available keyboard shortcuts organized by category
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';
import { useKeyboardShortcuts, formatShortcut, type KeyboardShortcut } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

const categoryLabels: Record<KeyboardShortcut['category'], string> = {
  playback: 'Playback',
  effects: 'Effects',
  navigation: 'Navigation',
  general: 'General',
};

const categoryIcons: Record<KeyboardShortcut['category'], string> = {
  playback: '▶',
  effects: '🎛',
  navigation: '🧭',
  general: '⚙',
};

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  trigger,
}: KeyboardShortcutsDialogProps) {
  const { shortcuts } = useKeyboardShortcuts();

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  // Sort categories in a specific order
  const categoryOrder: KeyboardShortcut['category'][] = ['playback', 'effects', 'navigation', 'general'];
  const sortedCategories = categoryOrder.filter(cat => groupedShortcuts[cat]?.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick access keys for common actions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {sortedCategories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <span>{categoryIcons[category]}</span>
                {categoryLabels[category]}
              </h3>
              <div className="space-y-1">
                {groupedShortcuts[category].map((shortcut, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between py-1.5 px-2 rounded-md',
                      shortcut.enabled === false && 'opacity-50'
                    )}
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium bg-muted rounded border">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {sortedCategories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No shortcuts registered
            </p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> to toggle this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Simple button that opens the keyboard shortcuts dialog
 */
export function KeyboardShortcutsButton() {
  return (
    <KeyboardShortcutsDialog
      trigger={
        <Button variant="ghost" size="icon" title="Keyboard Shortcuts (Shift+?)">
          <Keyboard className="h-4 w-4" />
        </Button>
      }
    />
  );
}
