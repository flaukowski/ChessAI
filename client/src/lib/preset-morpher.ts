/**
 * Preset Morpher
 * Smooth transitions between effect configurations with animation support
 *
 * Features:
 * - Linear interpolation between preset states
 * - Morphing progress control (0-1)
 * - Parameter trajectory animation using requestAnimationFrame
 * - Multiple easing functions (linear, ease-in-out, exponential)
 * - Crossfade for effect chain differences
 */

import type { Preset } from './preset-manager';
import { PedalboardEngine } from './dsp/pedalboard-engine';
import type { WorkletEffectType } from './dsp/worklet-effects';

/**
 * Easing function type
 */
export type EasingFunction = (t: number) => number;

/**
 * Built-in easing functions for morph animations
 */
export const easingFunctions = {
  /**
   * Linear interpolation - constant rate of change
   */
  linear: (t: number): number => t,

  /**
   * Ease-in-out - smooth acceleration and deceleration
   * Uses cubic bezier approximation for natural motion
   */
  easeInOut: (t: number): number => {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },

  /**
   * Ease-in - starts slow, accelerates
   */
  easeIn: (t: number): number => {
    return t * t * t;
  },

  /**
   * Ease-out - starts fast, decelerates
   */
  easeOut: (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  },

  /**
   * Exponential ease-in-out - dramatic acceleration/deceleration
   */
  exponential: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) {
      return Math.pow(2, 20 * t - 10) / 2;
    }
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  /**
   * Sine wave - gentle, organic motion
   */
  sine: (t: number): number => {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  },

  /**
   * Elastic - overshoots and bounces back
   */
  elastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  /**
   * Custom S-curve with adjustable steepness
   */
  sCurve: (steepness: number = 5) => (t: number): number => {
    return 1 / (1 + Math.exp(-steepness * (t - 0.5)));
  },
} as const;

/**
 * Effect configuration during morphing
 */
export interface MorphEffect {
  type: WorkletEffectType;
  enabled: boolean;
  params: Record<string, number>;
}

/**
 * Morphable preset state (subset of Preset relevant to audio)
 */
export interface MorphableState {
  inputGain: number;
  outputGain: number;
  effects: MorphEffect[];
}

/**
 * Effect match result for crossfading
 */
interface EffectMatch {
  type: WorkletEffectType;
  sourceIndex: number | null;
  targetIndex: number | null;
  sourceEffect: MorphEffect | null;
  targetEffect: MorphEffect | null;
}

/**
 * Animation state for tracking morph progress
 */
interface MorphAnimation {
  id: number;
  startTime: number;
  durationMs: number;
  sourceState: MorphableState;
  targetState: MorphableState;
  easing: EasingFunction;
  onProgress?: (progress: number, state: MorphableState) => void;
  onComplete?: () => void;
}

/**
 * Preset Morpher class
 * Handles smooth transitions between preset configurations
 */
export class PresetMorpher {
  private engine: PedalboardEngine | null;
  private currentAnimation: MorphAnimation | null = null;
  private animationFrameId: number | null = null;
  private lastMorphedState: MorphableState | null = null;

  constructor(engine: PedalboardEngine | null) {
    this.engine = engine;
  }

  /**
   * Interpolate a single numeric value between two values
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Interpolate between two parameter objects
   * Only interpolates numeric values; non-numeric values use target when t >= 0.5
   */
  private interpolateParams(
    paramsA: Record<string, number>,
    paramsB: Record<string, number>,
    t: number
  ): Record<string, number> {
    const result: Record<string, number> = {};

    // Get all unique parameter keys from both objects
    const allKeys = new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]);

    for (const key of allKeys) {
      const valueA = paramsA[key];
      const valueB = paramsB[key];

      if (valueA !== undefined && valueB !== undefined) {
        // Both have the parameter - interpolate
        result[key] = this.lerp(valueA, valueB, t);
      } else if (valueA !== undefined) {
        // Only source has it - fade out by multiplying by (1-t) for relevant params
        // For most params, just use source value until we switch
        result[key] = valueA;
      } else if (valueB !== undefined) {
        // Only target has it - use target value
        result[key] = valueB;
      }
    }

    return result;
  }

  /**
   * Match effects between two presets for morphing
   * Returns a list of matched effects for interpolation and crossfading
   */
  private matchEffects(
    sourceEffects: MorphEffect[],
    targetEffects: MorphEffect[]
  ): EffectMatch[] {
    const matches: EffectMatch[] = [];
    const usedSourceIndices = new Set<number>();
    const usedTargetIndices = new Set<number>();

    // First pass: match effects of the same type
    for (let ti = 0; ti < targetEffects.length; ti++) {
      const target = targetEffects[ti];

      // Find matching source effect (same type, not yet used)
      let matchedSourceIndex: number | null = null;
      for (let si = 0; si < sourceEffects.length; si++) {
        if (!usedSourceIndices.has(si) && sourceEffects[si].type === target.type) {
          matchedSourceIndex = si;
          break;
        }
      }

      if (matchedSourceIndex !== null) {
        usedSourceIndices.add(matchedSourceIndex);
        usedTargetIndices.add(ti);
        matches.push({
          type: target.type,
          sourceIndex: matchedSourceIndex,
          targetIndex: ti,
          sourceEffect: sourceEffects[matchedSourceIndex],
          targetEffect: target,
        });
      }
    }

    // Second pass: effects only in target (fade in)
    for (let ti = 0; ti < targetEffects.length; ti++) {
      if (!usedTargetIndices.has(ti)) {
        matches.push({
          type: targetEffects[ti].type,
          sourceIndex: null,
          targetIndex: ti,
          sourceEffect: null,
          targetEffect: targetEffects[ti],
        });
      }
    }

    // Third pass: effects only in source (fade out)
    for (let si = 0; si < sourceEffects.length; si++) {
      if (!usedSourceIndices.has(si)) {
        matches.push({
          type: sourceEffects[si].type,
          sourceIndex: si,
          targetIndex: null,
          sourceEffect: sourceEffects[si],
          targetEffect: null,
        });
      }
    }

    return matches;
  }

  /**
   * Create default (silent) effect params for a given effect type
   * Used for fade-in/fade-out of effects during morph
   */
  private getDefaultParams(type: WorkletEffectType): Record<string, number> {
    // Return parameters that produce no effect (identity/zero output)
    const defaults: Record<string, Record<string, number>> = {
      eq: { lowGain: 0, lowFreq: 320, midGain: 0, midFreq: 1000, midQ: 1, highGain: 0, highFreq: 3200, mix: 0 },
      distortion: { drive: 0, tone: 0.5, mode: 0, level: 0, mix: 0 },
      delay: { time: 300, feedback: 0, damping: 0.3, mix: 0 },
      chorus: { rate: 1.5, depth: 0, voices: 2, mix: 0 },
      compressor: { threshold: 0, ratio: 1, attack: 10, release: 100, makeupGain: 0, mix: 0 },
      basspurr: { fundamental: 1, even: 0, odd: 0, tone: 0.5, output: 1, mix: 0 },
      tremolo: { rate: 5, depth: 0, waveform: 0, mix: 0 },
      reverb: { roomSize: 0, damping: 0.5, preDelay: 10, decay: 0.1, width: 0.8, mix: 0 },
      growlingbass: { subLevel: 0, oddLevel: 0, evenLevel: 0, toneFreq: 800, mix: 0 },
      gate: { threshold: -60, attack: 1, hold: 50, release: 100, range: 0, ratio: 1, hpfFreq: 80, hpfEnabled: 0, mix: 0 },
    };
    return { ...(defaults[type] || {}) };
  }

  /**
   * Morph between two presets at a given progress value
   * @param presetA Source preset (progress = 0)
   * @param presetB Target preset (progress = 1)
   * @param progress Interpolation progress (0-1)
   * @returns Interpolated state
   */
  morphPresets(
    presetA: Preset | MorphableState,
    presetB: Preset | MorphableState,
    progress: number
  ): MorphableState {
    // Clamp progress to 0-1
    const t = Math.max(0, Math.min(1, progress));

    // Extract morphable state from presets
    const stateA = this.extractMorphableState(presetA);
    const stateB = this.extractMorphableState(presetB);

    // Interpolate gains
    const morphedState: MorphableState = {
      inputGain: this.lerp(stateA.inputGain, stateB.inputGain, t),
      outputGain: this.lerp(stateA.outputGain, stateB.outputGain, t),
      effects: [],
    };

    // Match and interpolate effects
    const matches = this.matchEffects(stateA.effects, stateB.effects);

    for (const match of matches) {
      if (match.sourceEffect && match.targetEffect) {
        // Both exist - interpolate parameters
        const morphedParams = this.interpolateParams(
          match.sourceEffect.params,
          match.targetEffect.params,
          t
        );

        // Interpolate enabled state (use target at 50%)
        const enabled = t < 0.5 ? match.sourceEffect.enabled : match.targetEffect.enabled;

        morphedState.effects.push({
          type: match.type,
          enabled,
          params: morphedParams,
        });
      } else if (match.sourceEffect && !match.targetEffect) {
        // Only in source - fade out
        const fadeT = 1 - t; // Inverse progress for fade out
        const defaultParams = this.getDefaultParams(match.type);
        const morphedParams = this.interpolateParams(
          match.sourceEffect.params,
          defaultParams,
          t
        );

        // Fade out mix parameter
        if (match.sourceEffect.params.mix !== undefined) {
          morphedParams.mix = match.sourceEffect.params.mix * fadeT;
        }

        morphedState.effects.push({
          type: match.type,
          enabled: match.sourceEffect.enabled && t < 0.9, // Disable near end
          params: morphedParams,
        });
      } else if (!match.sourceEffect && match.targetEffect) {
        // Only in target - fade in
        const defaultParams = this.getDefaultParams(match.type);
        const morphedParams = this.interpolateParams(
          defaultParams,
          match.targetEffect.params,
          t
        );

        // Fade in mix parameter
        if (match.targetEffect.params.mix !== undefined) {
          morphedParams.mix = match.targetEffect.params.mix * t;
        }

        morphedState.effects.push({
          type: match.type,
          enabled: match.targetEffect.enabled && t > 0.1, // Enable after start
          params: morphedParams,
        });
      }
    }

    this.lastMorphedState = morphedState;
    return morphedState;
  }

  /**
   * Extract morphable state from a preset or state object
   */
  private extractMorphableState(preset: Preset | MorphableState): MorphableState {
    return {
      inputGain: preset.inputGain,
      outputGain: preset.outputGain,
      effects: preset.effects.map(e => ({
        type: e.type as WorkletEffectType,
        enabled: e.enabled,
        params: { ...e.params },
      })),
    };
  }

  /**
   * Apply a morphed state to the pedalboard engine
   */
  applyMorphedState(state: MorphableState): void {
    if (!this.engine) return;

    // Apply gain values
    this.engine.setInputGain(state.inputGain);
    this.engine.setOutputGain(state.outputGain);

    // Get current engine state
    const engineState = this.engine.getState();
    const currentEffects = engineState.effects;

    // Match current effects with morphed effects
    const currentByType = new Map<string, string>(); // type -> id
    for (const effect of currentEffects) {
      if (!currentByType.has(effect.type)) {
        currentByType.set(effect.type, effect.id);
      }
    }

    const morphedByType = new Map<WorkletEffectType, MorphEffect>();
    for (const effect of state.effects) {
      if (!morphedByType.has(effect.type)) {
        morphedByType.set(effect.type, effect);
      }
    }

    // Update existing effects, add new ones
    for (const morphedEffect of state.effects) {
      const existingId = currentByType.get(morphedEffect.type);

      if (existingId) {
        // Update existing effect parameters
        for (const [param, value] of Object.entries(morphedEffect.params)) {
          this.engine.updateEffectParam(existingId, param, value);
        }

        // Update enabled state
        const currentEffect = currentEffects.find(e => e.id === existingId);
        if (currentEffect && currentEffect.enabled !== morphedEffect.enabled) {
          this.engine.toggleEffect(existingId);
        }

        currentByType.delete(morphedEffect.type);
      } else {
        // Add new effect
        const newId = this.engine.addEffect(morphedEffect.type);

        // Set parameters
        for (const [param, value] of Object.entries(morphedEffect.params)) {
          this.engine.updateEffectParam(newId, param, value);
        }

        // Set enabled state
        const addedEffect = this.engine.getState().effects.find(e => e.id === newId);
        if (addedEffect && addedEffect.enabled !== morphedEffect.enabled) {
          this.engine.toggleEffect(newId);
        }
      }
    }

    // Remove effects that are no longer needed
    for (const [_type, id] of currentByType) {
      this.engine.removeEffect(id);
    }
  }

  /**
   * Start an animated morph between two presets
   * @param presetA Source preset
   * @param presetB Target preset
   * @param durationMs Animation duration in milliseconds
   * @param easing Easing function (default: easeInOut)
   * @param onProgress Optional callback for progress updates
   * @param onComplete Optional callback when animation completes
   * @returns Animation ID that can be used to cancel
   */
  startMorphAnimation(
    presetA: Preset | MorphableState,
    presetB: Preset | MorphableState,
    durationMs: number,
    easing: EasingFunction | keyof typeof easingFunctions = 'easeInOut',
    onProgress?: (progress: number, state: MorphableState) => void,
    onComplete?: () => void
  ): number {
    // Cancel any existing animation
    this.cancelMorphAnimation();

    // Resolve easing function
    const easingFn = typeof easing === 'string' ? easingFunctions[easing] : easing;

    // Create animation state
    const animationId = Date.now();
    this.currentAnimation = {
      id: animationId,
      startTime: performance.now(),
      durationMs,
      sourceState: this.extractMorphableState(presetA),
      targetState: this.extractMorphableState(presetB),
      easing: easingFn,
      onProgress,
      onComplete,
    };

    // Start animation loop
    this.runAnimationFrame();

    return animationId;
  }

  /**
   * Animation frame handler
   */
  private runAnimationFrame = (): void => {
    if (!this.currentAnimation) return;

    const now = performance.now();
    const elapsed = now - this.currentAnimation.startTime;
    const rawProgress = Math.min(1, elapsed / this.currentAnimation.durationMs);

    // Apply easing
    const easedProgress = this.currentAnimation.easing(rawProgress);

    // Compute morphed state
    const morphedState = this.morphPresets(
      this.currentAnimation.sourceState,
      this.currentAnimation.targetState,
      easedProgress
    );

    // Apply to engine
    this.applyMorphedState(morphedState);

    // Notify progress
    if (this.currentAnimation.onProgress) {
      this.currentAnimation.onProgress(easedProgress, morphedState);
    }

    // Check if complete
    if (rawProgress >= 1) {
      const onComplete = this.currentAnimation.onComplete;
      this.currentAnimation = null;
      this.animationFrameId = null;

      if (onComplete) {
        onComplete();
      }
    } else {
      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(this.runAnimationFrame);
    }
  };

  /**
   * Cancel any running morph animation
   */
  cancelMorphAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.currentAnimation = null;
  }

  /**
   * Check if a morph animation is currently running
   */
  isAnimating(): boolean {
    return this.currentAnimation !== null;
  }

  /**
   * Get the current animation progress (0-1) or null if not animating
   */
  getAnimationProgress(): number | null {
    if (!this.currentAnimation) return null;

    const elapsed = performance.now() - this.currentAnimation.startTime;
    const rawProgress = Math.min(1, elapsed / this.currentAnimation.durationMs);
    return this.currentAnimation.easing(rawProgress);
  }

  /**
   * Get the last morphed state
   */
  getLastMorphedState(): MorphableState | null {
    return this.lastMorphedState;
  }

  /**
   * Create a snapshot of the current engine state as a morphable state
   */
  captureCurrentState(): MorphableState {
    if (!this.engine) {
      return { inputGain: 1, outputGain: 1, effects: [] };
    }
    const state = this.engine.getState();
    return {
      inputGain: state.inputGain,
      outputGain: state.outputGain,
      effects: state.effects.map(e => ({
        type: e.type as WorkletEffectType,
        enabled: e.enabled,
        params: { ...e.params },
      })),
    };
  }

  /**
   * Morph from current engine state to a target preset
   */
  morphToPreset(
    targetPreset: Preset | MorphableState,
    durationMs: number,
    easing: EasingFunction | keyof typeof easingFunctions = 'easeInOut',
    onProgress?: (progress: number, state: MorphableState) => void,
    onComplete?: () => void
  ): number {
    const currentState = this.captureCurrentState();
    return this.startMorphAnimation(
      currentState,
      targetPreset,
      durationMs,
      easing,
      onProgress,
      onComplete
    );
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelMorphAnimation();
    this.lastMorphedState = null;
  }
}

/**
 * Create a preset morpher instance for a given pedalboard engine
 */
export function createPresetMorpher(engine: PedalboardEngine): PresetMorpher {
  return new PresetMorpher(engine);
}

/**
 * Utility: Generate intermediate keyframes for complex morphs
 * Useful for creating smooth transitions through multiple waypoints
 */
export function generateMorphKeyframes(
  presets: (Preset | MorphableState)[],
  stepsPerSegment: number = 10
): MorphableState[] {
  if (presets.length < 2) {
    throw new Error('At least 2 presets required for keyframe generation');
  }

  const morpher = new PresetMorpher(null); // Temp morpher for interpolation only
  const keyframes: MorphableState[] = [];

  for (let i = 0; i < presets.length - 1; i++) {
    const sourcePreset = presets[i];
    const targetPreset = presets[i + 1];

    for (let step = 0; step <= stepsPerSegment; step++) {
      // Skip first keyframe of subsequent segments (avoid duplicates)
      if (i > 0 && step === 0) continue;

      const progress = step / stepsPerSegment;
      const state = morpher.morphPresets(sourcePreset, targetPreset, progress);
      keyframes.push(state);
    }
  }

  return keyframes;
}

/**
 * Utility: Calculate morph distance between two presets
 * Returns a normalized value (0-1) indicating how different the presets are
 */
export function calculateMorphDistance(
  presetA: Preset | MorphableState,
  presetB: Preset | MorphableState
): number {
  const stateA: MorphableState = {
    inputGain: presetA.inputGain,
    outputGain: presetA.outputGain,
    effects: presetA.effects.map(e => ({
      type: e.type as WorkletEffectType,
      enabled: e.enabled,
      params: { ...e.params },
    })),
  };

  const stateB: MorphableState = {
    inputGain: presetB.inputGain,
    outputGain: presetB.outputGain,
    effects: presetB.effects.map(e => ({
      type: e.type as WorkletEffectType,
      enabled: e.enabled,
      params: { ...e.params },
    })),
  };

  let totalDistance = 0;
  let paramCount = 0;

  // Gain distance
  totalDistance += Math.abs(stateA.inputGain - stateB.inputGain) / 2; // Max gain is 2
  totalDistance += Math.abs(stateA.outputGain - stateB.outputGain) / 2;
  paramCount += 2;

  // Effect presence distance
  const typesA = new Set(stateA.effects.map(e => e.type));
  const typesB = new Set(stateB.effects.map(e => e.type));
  const allTypes = new Set([...typesA, ...typesB]);

  for (const type of allTypes) {
    const effectA = stateA.effects.find(e => e.type === type);
    const effectB = stateB.effects.find(e => e.type === type);

    if (effectA && effectB) {
      // Both have effect - compare parameters
      const allParams = new Set([...Object.keys(effectA.params), ...Object.keys(effectB.params)]);
      for (const param of allParams) {
        const valueA = effectA.params[param] ?? 0;
        const valueB = effectB.params[param] ?? 0;
        // Normalize assuming most params are 0-1 range
        totalDistance += Math.abs(valueA - valueB);
        paramCount++;
      }

      // Enabled state
      if (effectA.enabled !== effectB.enabled) {
        totalDistance += 1;
      }
      paramCount++;
    } else {
      // One preset has it, other doesn't - maximum distance for this effect
      totalDistance += 5; // Arbitrary weight for missing effect
      paramCount += 5;
    }
  }

  return Math.min(1, totalDistance / paramCount);
}
