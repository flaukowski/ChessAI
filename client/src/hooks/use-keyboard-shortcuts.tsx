/**
 * Keyboard Shortcuts System
 * Provides global keyboard shortcut handling for the audio application
 */

import { useEffect, useCallback, createContext, useContext, useState, type ReactNode } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  category: 'playback' | 'effects' | 'navigation' | 'general';
  enabled?: boolean;
}

interface KeyboardShortcutsContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (key: string) => void;
  setShortcutEnabled: (key: string, enabled: boolean) => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

// Generate a unique ID for shortcuts based on key combination
const getShortcutId = (shortcut: Pick<KeyboardShortcut, 'key' | 'ctrl' | 'shift' | 'alt' | 'meta'>): string => {
  const parts = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');
  if (shortcut.meta) parts.push('meta');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
};

// Format shortcut for display
export const formatShortcut = (shortcut: Pick<KeyboardShortcut, 'key' | 'ctrl' | 'shift' | 'alt' | 'meta'>): string => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const parts = [];

  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');

  // Format special keys
  const keyDisplay = {
    ' ': 'Space',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'escape': 'Esc',
    'enter': '↵',
    'backspace': '⌫',
    'delete': 'Del',
    'tab': 'Tab',
  }[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase();

  parts.push(keyDisplay);
  return parts.join(isMac ? '' : '+');
};

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [isEnabled, setEnabled] = useState(true);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts(prev => {
      const id = getShortcutId(shortcut);
      // Remove existing shortcut with same ID
      const filtered = prev.filter(s => getShortcutId(s) !== id);
      return [...filtered, { ...shortcut, enabled: shortcut.enabled ?? true }];
    });
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts(prev => prev.filter(s => s.key.toLowerCase() !== key.toLowerCase()));
  }, []);

  const setShortcutEnabled = useCallback((key: string, enabled: boolean) => {
    setShortcuts(prev => prev.map(s =>
      s.key.toLowerCase() === key.toLowerCase() ? { ...s, enabled } : s
    ));
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEnabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const shortcut = shortcuts.find(s => {
        if (s.enabled === false) return false;
        if (s.key.toLowerCase() !== event.key.toLowerCase()) return false;
        if (s.ctrl && !event.ctrlKey) return false;
        if (s.shift && !event.shiftKey) return false;
        if (s.alt && !event.altKey) return false;
        if (s.meta && !event.metaKey) return false;
        // Also check inverse - if shortcut doesn't require modifier, event shouldn't have it
        if (!s.ctrl && event.ctrlKey) return false;
        if (!s.shift && event.shiftKey) return false;
        if (!s.alt && event.altKey) return false;
        if (!s.meta && event.metaKey) return false;
        return true;
      });

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, isEnabled]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts,
        registerShortcut,
        unregisterShortcut,
        setShortcutEnabled,
        isEnabled,
        setEnabled,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}

/**
 * Hook to register a keyboard shortcut
 * Automatically unregisters when the component unmounts
 */
export function useKeyboardShortcut(
  shortcut: Omit<KeyboardShortcut, 'action'>,
  action: () => void,
  deps: React.DependencyList = []
) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    registerShortcut({ ...shortcut, action });
    return () => {
      const id = getShortcutId(shortcut);
      unregisterShortcut(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcut.key, shortcut.ctrl, shortcut.shift, shortcut.alt, shortcut.meta, ...deps]);
}

/**
 * Default application shortcuts
 * These are commonly used shortcuts that can be registered at the app level
 */
export const defaultShortcuts = {
  playback: {
    playPause: { key: ' ', description: 'Play/Pause', category: 'playback' as const },
    stop: { key: 'Escape', description: 'Stop', category: 'playback' as const },
    rewind: { key: 'Home', description: 'Rewind to start', category: 'playback' as const },
  },
  effects: {
    bypass: { key: 'b', description: 'Toggle effect bypass', category: 'effects' as const },
    reset: { key: 'r', ctrl: true, description: 'Reset effect parameters', category: 'effects' as const },
  },
  navigation: {
    studio: { key: '1', ctrl: true, description: 'Go to Studio', category: 'navigation' as const },
    settings: { key: ',', ctrl: true, description: 'Open Settings', category: 'navigation' as const },
  },
  general: {
    help: { key: '?', shift: true, description: 'Show keyboard shortcuts', category: 'general' as const },
    undo: { key: 'z', ctrl: true, description: 'Undo', category: 'general' as const },
    redo: { key: 'z', ctrl: true, shift: true, description: 'Redo', category: 'general' as const },
    save: { key: 's', ctrl: true, description: 'Save preset', category: 'general' as const },
  },
};
