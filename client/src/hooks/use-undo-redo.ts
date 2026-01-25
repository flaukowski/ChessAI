/**
 * React hook for undo/redo functionality
 * Provides keyboard shortcuts and state management for the undo/redo system
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  undoHistoryManager,
  type PedalboardSnapshot,
} from '@/lib/undo-history';
import { pedalboardEngine, type PedalboardEffect } from '@/lib/dsp/pedalboard-engine';
import { type WorkletEffectType } from '@/lib/dsp/worklet-effects';

export interface UseUndoRedoReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undoHistory: Array<{ id: string; description: string; timestamp: number }>;
  redoHistory: Array<{ id: string; description: string; timestamp: number }>;

  // Actions
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Recording helpers (for use by pedalboard operations)
  recordEffectAdd: (effectType: string) => void;
  recordEffectRemove: (effectType: string) => void;
  recordEffectReorder: () => void;
  recordEffectToggle: (effectType: string, enabled: boolean) => void;
  recordParamChange: (effectType: string, paramName: string) => void;
  recordGainChange: (gainType: 'input' | 'output') => void;
  recordBypassChange: (bypassed: boolean) => void;
  recordPresetLoad: (presetName?: string) => void;
}

/**
 * Convert pedalboard state to a snapshot
 */
function createSnapshot(): PedalboardSnapshot {
  const state = pedalboardEngine.getState();
  return {
    inputGain: state.inputGain,
    outputGain: state.outputGain,
    globalBypass: state.globalBypass,
    effects: state.effects.map(e => ({
      type: e.type,
      enabled: e.enabled,
      params: { ...e.params },
    })),
  };
}

/**
 * Apply a snapshot to the pedalboard engine
 */
function applySnapshot(snapshot: PedalboardSnapshot): void {
  // Build the preset JSON format that importPreset expects
  const presetJson = JSON.stringify({
    version: 1,
    inputGain: snapshot.inputGain,
    outputGain: snapshot.outputGain,
    effects: snapshot.effects.map(e => ({
      type: e.type,
      enabled: e.enabled,
      params: e.params,
    })),
  });

  pedalboardEngine.importPreset(presetJson);

  // Also restore global bypass (not part of preset format)
  pedalboardEngine.setGlobalBypass(snapshot.globalBypass);
}

/**
 * Hook for undo/redo functionality with keyboard shortcuts
 */
export function useUndoRedo(): UseUndoRedoReturn {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);
  const [redoDescription, setRedoDescription] = useState<string | null>(null);
  const [undoHistory, setUndoHistory] = useState<Array<{ id: string; description: string; timestamp: number }>>([]);
  const [redoHistory, setRedoHistory] = useState<Array<{ id: string; description: string; timestamp: number }>>([]);

  const isInitializedRef = useRef(false);

  // Initialize history manager with current state
  useEffect(() => {
    if (!isInitializedRef.current) {
      const initialSnapshot = createSnapshot();
      undoHistoryManager.initialize(initialSnapshot);
      isInitializedRef.current = true;
    }

    // Subscribe to history changes
    const unsubscribe = undoHistoryManager.onChange((canUndoNew, canRedoNew) => {
      setCanUndo(canUndoNew);
      setCanRedo(canRedoNew);
      setUndoDescription(undoHistoryManager.getUndoDescription());
      setRedoDescription(undoHistoryManager.getRedoDescription());
      setUndoHistory(undoHistoryManager.getUndoHistory());
      setRedoHistory(undoHistoryManager.getRedoHistory());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
      const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey;
      const isRedo = (event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey;
      // Also support Ctrl+Y for redo on Windows
      const isRedoAlt = event.ctrlKey && event.key === 'y';

      if (isUndo) {
        event.preventDefault();
        const snapshot = undoHistoryManager.undo();
        if (snapshot) {
          applySnapshot(snapshot);
        }
      } else if (isRedo || isRedoAlt) {
        event.preventDefault();
        const snapshot = undoHistoryManager.redo();
        if (snapshot) {
          applySnapshot(snapshot);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Undo action
  const undo = useCallback(() => {
    const snapshot = undoHistoryManager.undo();
    if (snapshot) {
      applySnapshot(snapshot);
    }
  }, []);

  // Redo action
  const redo = useCallback(() => {
    const snapshot = undoHistoryManager.redo();
    if (snapshot) {
      applySnapshot(snapshot);
    }
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    undoHistoryManager.clear();
  }, []);

  // Recording helpers
  const recordEffectAdd = useCallback((effectType: string) => {
    undoHistoryManager.recordChangeImmediate(
      `Add ${effectType} effect`,
      createSnapshot()
    );
  }, []);

  const recordEffectRemove = useCallback((effectType: string) => {
    undoHistoryManager.recordChangeImmediate(
      `Remove ${effectType} effect`,
      createSnapshot()
    );
  }, []);

  const recordEffectReorder = useCallback(() => {
    undoHistoryManager.recordChangeImmediate(
      'Reorder effects',
      createSnapshot()
    );
  }, []);

  const recordEffectToggle = useCallback((effectType: string, enabled: boolean) => {
    undoHistoryManager.recordChangeImmediate(
      `${enabled ? 'Enable' : 'Disable'} ${effectType}`,
      createSnapshot()
    );
  }, []);

  const recordParamChange = useCallback((effectType: string, paramName: string) => {
    undoHistoryManager.recordChange(
      `Adjust ${effectType} ${paramName}`,
      createSnapshot()
    );
  }, []);

  const recordGainChange = useCallback((gainType: 'input' | 'output') => {
    undoHistoryManager.recordChange(
      `Adjust ${gainType} gain`,
      createSnapshot()
    );
  }, []);

  const recordBypassChange = useCallback((bypassed: boolean) => {
    undoHistoryManager.recordChangeImmediate(
      bypassed ? 'Enable global bypass' : 'Disable global bypass',
      createSnapshot()
    );
  }, []);

  const recordPresetLoad = useCallback((presetName?: string) => {
    undoHistoryManager.recordChangeImmediate(
      presetName ? `Load preset: ${presetName}` : 'Load preset',
      createSnapshot()
    );
  }, []);

  return {
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    undoHistory,
    redoHistory,
    undo,
    redo,
    clearHistory,
    recordEffectAdd,
    recordEffectRemove,
    recordEffectReorder,
    recordEffectToggle,
    recordParamChange,
    recordGainChange,
    recordBypassChange,
    recordPresetLoad,
  };
}
