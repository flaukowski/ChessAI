/**
 * Tests for the Undo/Redo History Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UndoHistoryManager, type PedalboardSnapshot } from '@/lib/undo-history';

describe('UndoHistoryManager', () => {
  let manager: UndoHistoryManager;

  const createSnapshot = (inputGain = 1, outputGain = 1, effectCount = 0): PedalboardSnapshot => ({
    inputGain,
    outputGain,
    globalBypass: false,
    effects: Array(effectCount).fill(null).map((_, i) => ({
      type: 'eq',
      enabled: true,
      params: { mix: 0.5 + i * 0.1 },
    })),
  });

  beforeEach(() => {
    manager = new UndoHistoryManager(50);
    vi.useFakeTimers();
  });

  describe('initialize', () => {
    it('should initialize with a snapshot', () => {
      const snapshot = createSnapshot();
      manager.initialize(snapshot);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('recordChangeImmediate', () => {
    it('should add an entry to the undo stack', () => {
      const initial = createSnapshot(1);
      const changed = createSnapshot(1.5);

      manager.initialize(initial);
      manager.recordChangeImmediate('Change gain', changed);

      expect(manager.canUndo()).toBe(true);
      expect(manager.getUndoDescription()).toBe('Change gain');
    });

    it('should clear redo stack on new change', () => {
      const initial = createSnapshot(1);
      const changed1 = createSnapshot(1.5);
      const changed2 = createSnapshot(2);

      manager.initialize(initial);
      manager.recordChangeImmediate('Change 1', changed1);
      manager.undo();
      expect(manager.canRedo()).toBe(true);

      // Wait for isUndoRedoInProgress to clear
      vi.advanceTimersByTime(60);

      manager.recordChangeImmediate('Change 2', changed2);
      expect(manager.canRedo()).toBe(false);
    });

    it('should skip if snapshot has not changed', () => {
      const initial = createSnapshot(1);

      manager.initialize(initial);
      manager.recordChangeImmediate('No change', initial);

      expect(manager.canUndo()).toBe(false);
    });

    it('should respect max history limit', () => {
      const small = new UndoHistoryManager(3);
      small.initialize(createSnapshot(0));

      small.recordChangeImmediate('Change 1', createSnapshot(1));
      small.recordChangeImmediate('Change 2', createSnapshot(2));
      small.recordChangeImmediate('Change 3', createSnapshot(3));
      small.recordChangeImmediate('Change 4', createSnapshot(4));

      // Should only have 3 entries in undo stack
      const history = small.getUndoHistory();
      expect(history.length).toBe(3);
      expect(history[0].description).toBe('Change 4');
    });
  });

  describe('recordChange (debounced)', () => {
    it('should debounce rapid changes', () => {
      manager.initialize(createSnapshot(1));

      manager.recordChange('Change 1', createSnapshot(1.1));
      manager.recordChange('Change 2', createSnapshot(1.2));
      manager.recordChange('Change 3', createSnapshot(1.3));

      // Before debounce timeout
      expect(manager.canUndo()).toBe(false);

      // After debounce timeout
      vi.advanceTimersByTime(350);
      expect(manager.canUndo()).toBe(true);
      // Should use the first description
      expect(manager.getUndoDescription()).toBe('Change 1');
    });

    it('should record final state after debounce', () => {
      manager.initialize(createSnapshot(1));

      manager.recordChange('Adjust knob', createSnapshot(1.1));
      manager.recordChange('Adjust knob', createSnapshot(1.5));
      manager.recordChange('Adjust knob', createSnapshot(2.0));

      vi.advanceTimersByTime(350);

      const snapshot = manager.undo();
      // Should restore to original state before any changes
      expect(snapshot?.inputGain).toBe(1);
    });
  });

  describe('undo', () => {
    it('should restore previous state', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change', createSnapshot(2));

      const restored = manager.undo();

      expect(restored?.inputGain).toBe(1);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(true);
    });

    it('should return null if nothing to undo', () => {
      manager.initialize(createSnapshot());
      expect(manager.undo()).toBe(null);
    });

    it('should handle multiple undos', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change 1', createSnapshot(2));
      manager.recordChangeImmediate('Change 2', createSnapshot(3));
      manager.recordChangeImmediate('Change 3', createSnapshot(4));

      expect(manager.undo()?.inputGain).toBe(3);
      expect(manager.undo()?.inputGain).toBe(2);
      expect(manager.undo()?.inputGain).toBe(1);
      expect(manager.undo()).toBe(null);
    });
  });

  describe('redo', () => {
    it('should restore undone state', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change', createSnapshot(2));
      manager.undo();

      const restored = manager.redo();

      expect(restored?.inputGain).toBe(2);
      expect(manager.canRedo()).toBe(false);
      expect(manager.canUndo()).toBe(true);
    });

    it('should return null if nothing to redo', () => {
      manager.initialize(createSnapshot());
      expect(manager.redo()).toBe(null);
    });

    it('should handle multiple redo operations', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change 1', createSnapshot(2));
      manager.recordChangeImmediate('Change 2', createSnapshot(3));

      manager.undo();
      manager.undo();

      expect(manager.redo()?.inputGain).toBe(2);
      expect(manager.redo()?.inputGain).toBe(3);
      expect(manager.redo()).toBe(null);
    });
  });

  describe('callbacks', () => {
    it('should notify on changes', () => {
      const callback = vi.fn();
      manager.onChange(callback);
      manager.initialize(createSnapshot(1));

      expect(callback).toHaveBeenCalledWith(false, false, undefined);

      manager.recordChangeImmediate('Change', createSnapshot(2));
      expect(callback).toHaveBeenCalledWith(true, false, 'Change');

      manager.undo();
      vi.advanceTimersByTime(60); // Wait for isUndoRedoInProgress to clear
      expect(callback).toHaveBeenCalledWith(false, true, undefined);
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = manager.onChange(callback);
      manager.initialize(createSnapshot());
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      manager.recordChangeImmediate('Change', createSnapshot(2));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('history retrieval', () => {
    it('should return undo history in reverse order', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change 1', createSnapshot(2));
      manager.recordChangeImmediate('Change 2', createSnapshot(3));

      const history = manager.getUndoHistory();
      expect(history[0].description).toBe('Change 2');
      expect(history[1].description).toBe('Change 1');
    });

    it('should return redo history in reverse order', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change 1', createSnapshot(2));
      manager.recordChangeImmediate('Change 2', createSnapshot(3));

      manager.undo();
      vi.advanceTimersByTime(60); // Wait for isUndoRedoInProgress
      manager.undo();
      vi.advanceTimersByTime(60);

      const history = manager.getRedoHistory();
      // Redo stack is LIFO: first undo puts Change2 at bottom, second undo puts Change1 at top
      // Reversed for display: most recent undo first
      expect(history[0].description).toBe('Change 1');
      expect(history[1].description).toBe('Change 2');
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      manager.initialize(createSnapshot(1));
      manager.recordChangeImmediate('Change 1', createSnapshot(2));
      manager.recordChangeImmediate('Change 2', createSnapshot(3));
      manager.undo();

      manager.clear();

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('snapshot comparison', () => {
    it('should detect changes in inputGain', () => {
      const snap1 = createSnapshot(1);
      const snap2 = createSnapshot(2);

      manager.initialize(snap1);
      manager.recordChangeImmediate('Change', snap2);

      expect(manager.canUndo()).toBe(true);
    });

    it('should detect changes in effects', () => {
      const snap1 = createSnapshot(1, 1, 1);
      const snap2 = createSnapshot(1, 1, 2);

      manager.initialize(snap1);
      manager.recordChangeImmediate('Add effect', snap2);

      expect(manager.canUndo()).toBe(true);
    });

    it('should detect changes in effect params', () => {
      const snap1: PedalboardSnapshot = {
        inputGain: 1,
        outputGain: 1,
        globalBypass: false,
        effects: [{ type: 'eq', enabled: true, params: { mix: 0.5 } }],
      };
      const snap2: PedalboardSnapshot = {
        inputGain: 1,
        outputGain: 1,
        globalBypass: false,
        effects: [{ type: 'eq', enabled: true, params: { mix: 0.8 } }],
      };

      manager.initialize(snap1);
      manager.recordChangeImmediate('Change param', snap2);

      expect(manager.canUndo()).toBe(true);
    });

    it('should not record identical snapshots', () => {
      const snap = createSnapshot(1, 1, 1);

      manager.initialize(snap);
      manager.recordChangeImmediate('No change', { ...snap });

      expect(manager.canUndo()).toBe(false);
    });
  });
});
