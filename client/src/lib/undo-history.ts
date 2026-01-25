/**
 * Undo/Redo History Manager for AudioNoise Web
 * Implements the Command pattern with state snapshots for effect chain modifications
 */

export interface EffectSnapshot {
  type: string;
  enabled: boolean;
  params: Record<string, number>;
}

export interface PedalboardSnapshot {
  inputGain: number;
  outputGain: number;
  globalBypass: boolean;
  effects: EffectSnapshot[];
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  description: string;
  snapshot: PedalboardSnapshot;
}

export type HistoryChangeCallback = (canUndo: boolean, canRedo: boolean, description?: string) => void;

/**
 * History Manager for undo/redo functionality
 * Uses state snapshots rather than commands for simplicity and reliability
 */
export class UndoHistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxHistory: number;
  private callbacks: HistoryChangeCallback[] = [];
  private currentSnapshot: PedalboardSnapshot | null = null;
  private isUndoRedoInProgress = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs = 300; // Debounce rapid changes (e.g., knob turning)
  private pendingDescription: string | null = null;

  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
  }

  /**
   * Initialize with the current state (call once at startup)
   */
  initialize(snapshot: PedalboardSnapshot): void {
    this.currentSnapshot = this.cloneSnapshot(snapshot);
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  /**
   * Record a state change (debounced for rapid changes like knob turning)
   */
  recordChange(description: string, newSnapshot: PedalboardSnapshot): void {
    // Skip if this change was triggered by undo/redo
    if (this.isUndoRedoInProgress) return;

    // Skip if snapshot hasn't actually changed
    if (this.currentSnapshot && this.snapshotsEqual(this.currentSnapshot, newSnapshot)) {
      return;
    }

    // Store the pending description (use first description in a debounce window)
    if (this.pendingDescription === null) {
      this.pendingDescription = description;
    }

    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the actual recording
    this.debounceTimer = setTimeout(() => {
      this.commitChange(this.pendingDescription || description, newSnapshot);
      this.pendingDescription = null;
      this.debounceTimer = null;
    }, this.debounceMs);
  }

  /**
   * Record a state change immediately (no debouncing)
   * Use for discrete actions like add/remove effect
   */
  recordChangeImmediate(description: string, newSnapshot: PedalboardSnapshot): void {
    // Skip if this change was triggered by undo/redo
    if (this.isUndoRedoInProgress) return;

    // Clear any pending debounced change
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.pendingDescription = null;
    }

    // Skip if snapshot hasn't actually changed
    if (this.currentSnapshot && this.snapshotsEqual(this.currentSnapshot, newSnapshot)) {
      return;
    }

    this.commitChange(description, newSnapshot);
  }

  /**
   * Actually commit a change to the undo stack
   */
  private commitChange(description: string, newSnapshot: PedalboardSnapshot): void {
    // Push current state to undo stack before updating
    if (this.currentSnapshot) {
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        description,
        snapshot: this.cloneSnapshot(this.currentSnapshot),
      };

      this.undoStack.push(entry);

      // Trim stack if over limit
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
    }

    // Clear redo stack on new action
    this.redoStack = [];

    // Update current snapshot
    this.currentSnapshot = this.cloneSnapshot(newSnapshot);

    this.notifyChange();
  }

  /**
   * Undo the last action
   * Returns the snapshot to restore, or null if nothing to undo
   */
  undo(): PedalboardSnapshot | null {
    if (!this.canUndo()) return null;

    this.isUndoRedoInProgress = true;

    // Clear any pending debounced changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.pendingDescription = null;
    }

    const entry = this.undoStack.pop()!;

    // Push current state to redo stack
    if (this.currentSnapshot) {
      this.redoStack.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        description: entry.description,
        snapshot: this.cloneSnapshot(this.currentSnapshot),
      });
    }

    // Restore the previous state
    this.currentSnapshot = this.cloneSnapshot(entry.snapshot);

    this.notifyChange();

    // Allow a brief delay before accepting new changes
    setTimeout(() => {
      this.isUndoRedoInProgress = false;
    }, 50);

    return this.cloneSnapshot(entry.snapshot);
  }

  /**
   * Redo the last undone action
   * Returns the snapshot to restore, or null if nothing to redo
   */
  redo(): PedalboardSnapshot | null {
    if (!this.canRedo()) return null;

    this.isUndoRedoInProgress = true;

    // Clear any pending debounced changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.pendingDescription = null;
    }

    const entry = this.redoStack.pop()!;

    // Push current state to undo stack
    if (this.currentSnapshot) {
      this.undoStack.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        description: entry.description,
        snapshot: this.cloneSnapshot(this.currentSnapshot),
      });
    }

    // Restore the redo state
    this.currentSnapshot = this.cloneSnapshot(entry.snapshot);

    this.notifyChange();

    // Allow a brief delay before accepting new changes
    setTimeout(() => {
      this.isUndoRedoInProgress = false;
    }, 50);

    return this.cloneSnapshot(entry.snapshot);
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the last undoable action
   */
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the last redoable action
   */
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Get the full undo history for display
   */
  getUndoHistory(): Array<{ id: string; description: string; timestamp: number }> {
    return this.undoStack.map(e => ({
      id: e.id,
      description: e.description,
      timestamp: e.timestamp,
    })).reverse();
  }

  /**
   * Get the full redo history for display
   */
  getRedoHistory(): Array<{ id: string; description: string; timestamp: number }> {
    return this.redoStack.map(e => ({
      id: e.id,
      description: e.description,
      timestamp: e.timestamp,
    })).reverse();
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  /**
   * Subscribe to history changes
   */
  onChange(callback: HistoryChangeCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all callbacks of history change
   */
  private notifyChange(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();
    const description = this.getUndoDescription() || undefined;
    this.callbacks.forEach(cb => cb(canUndo, canRedo, description));
  }

  /**
   * Deep clone a snapshot
   */
  private cloneSnapshot(snapshot: PedalboardSnapshot): PedalboardSnapshot {
    return {
      inputGain: snapshot.inputGain,
      outputGain: snapshot.outputGain,
      globalBypass: snapshot.globalBypass,
      effects: snapshot.effects.map(e => ({
        type: e.type,
        enabled: e.enabled,
        params: { ...e.params },
      })),
    };
  }

  /**
   * Compare two snapshots for equality
   */
  private snapshotsEqual(a: PedalboardSnapshot, b: PedalboardSnapshot): boolean {
    if (a.inputGain !== b.inputGain) return false;
    if (a.outputGain !== b.outputGain) return false;
    if (a.globalBypass !== b.globalBypass) return false;
    if (a.effects.length !== b.effects.length) return false;

    for (let i = 0; i < a.effects.length; i++) {
      const ea = a.effects[i];
      const eb = b.effects[i];
      if (ea.type !== eb.type) return false;
      if (ea.enabled !== eb.enabled) return false;

      const keysA = Object.keys(ea.params);
      const keysB = Object.keys(eb.params);
      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (ea.params[key] !== eb.params[key]) return false;
      }
    }

    return true;
  }

  /**
   * Check if an undo/redo operation is currently in progress
   */
  isOperationInProgress(): boolean {
    return this.isUndoRedoInProgress;
  }
}

// Singleton instance for global access
export const undoHistoryManager = new UndoHistoryManager(50);
