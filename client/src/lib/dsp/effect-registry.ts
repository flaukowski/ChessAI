/**
 * Effect Plugin Registry
 * Central registry for all audio effects with metadata, factory functions, and UI configuration
 * Enables dynamic effect loading and third-party plugin support
 */

import { createWorkletEffect, type WorkletEffectType, type EffectNode, defaultWorkletParams } from './worklet-effects';

export interface EffectParameter {
  name: string;
  label: string;
  type: 'slider' | 'select' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  default: number;
  unit?: string;
  options?: { value: number; label: string }[];
}

export interface EffectMetadata {
  id: string;
  name: string;
  description: string;
  category: 'dynamics' | 'modulation' | 'time' | 'distortion' | 'filter' | 'utility';
  icon?: string;
  color?: string;
  tags: string[];
  parameters: EffectParameter[];
  presets?: { name: string; values: Record<string, number> }[];
}

export interface RegisteredEffect {
  metadata: EffectMetadata;
  factory: (context: AudioContext) => EffectNode;
  defaultParams: Record<string, number>;
}

class EffectRegistry {
  private effects: Map<string, RegisteredEffect> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Register a new effect type
   */
  register(effect: RegisteredEffect): void {
    if (this.effects.has(effect.metadata.id)) {
      console.warn(`Effect "${effect.metadata.id}" is already registered. Overwriting.`);
    }
    this.effects.set(effect.metadata.id, effect);
    this.notifyListeners();
  }

  /**
   * Unregister an effect type
   */
  unregister(id: string): boolean {
    const result = this.effects.delete(id);
    if (result) {
      this.notifyListeners();
    }
    return result;
  }

  /**
   * Get an effect by ID
   */
  get(id: string): RegisteredEffect | undefined {
    return this.effects.get(id);
  }

  /**
   * Get all registered effects
   */
  getAll(): RegisteredEffect[] {
    return Array.from(this.effects.values());
  }

  /**
   * Get effects by category
   */
  getByCategory(category: EffectMetadata['category']): RegisteredEffect[] {
    return this.getAll().filter(e => e.metadata.category === category);
  }

  /**
   * Search effects by name or tags
   */
  search(query: string): RegisteredEffect[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(e =>
      e.metadata.name.toLowerCase().includes(lowerQuery) ||
      e.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Create an instance of an effect
   */
  createInstance(id: string, context: AudioContext): EffectNode | null {
    const effect = this.effects.get(id);
    if (!effect) {
      console.error(`Effect "${id}" not found in registry`);
      return null;
    }
    return effect.factory(context);
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Singleton instance
export const effectRegistry = new EffectRegistry();

// Register built-in effects
const builtInEffects: RegisteredEffect[] = [
  {
    metadata: {
      id: 'eq',
      name: '3-Band EQ',
      description: 'Parametric equalizer with low shelf, mid peak, and high shelf bands',
      category: 'filter',
      color: '#22c55e',
      tags: ['eq', 'equalizer', 'tone', 'frequency'],
      parameters: [
        { name: 'lowGain', label: 'Low Gain', type: 'slider', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
        { name: 'lowFreq', label: 'Low Freq', type: 'slider', min: 20, max: 500, step: 1, default: 320, unit: 'Hz' },
        { name: 'midGain', label: 'Mid Gain', type: 'slider', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
        { name: 'midFreq', label: 'Mid Freq', type: 'slider', min: 200, max: 5000, step: 1, default: 1000, unit: 'Hz' },
        { name: 'midQ', label: 'Mid Q', type: 'slider', min: 0.1, max: 10, step: 0.1, default: 1 },
        { name: 'highGain', label: 'High Gain', type: 'slider', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
        { name: 'highFreq', label: 'High Freq', type: 'slider', min: 1000, max: 20000, step: 1, default: 3200, unit: 'Hz' },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 },
      ],
      presets: [
        { name: 'Flat', values: { lowGain: 0, midGain: 0, highGain: 0 } },
        { name: 'Bass Boost', values: { lowGain: 6, lowFreq: 100, midGain: -2, highGain: 0 } },
        { name: 'Treble Boost', values: { lowGain: 0, midGain: 0, highGain: 6, highFreq: 8000 } },
        { name: 'V-Curve', values: { lowGain: 4, midGain: -3, highGain: 4 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'eq'),
    defaultParams: defaultWorkletParams.eq,
  },
  {
    metadata: {
      id: 'distortion',
      name: 'Distortion',
      description: 'Multi-mode distortion with soft clip, hard clip, tube, and foldback modes',
      category: 'distortion',
      color: '#ef4444',
      tags: ['distortion', 'overdrive', 'fuzz', 'saturation'],
      parameters: [
        { name: 'drive', label: 'Drive', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'tone', label: 'Tone', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'mode', label: 'Mode', type: 'select', min: 0, max: 6, default: 0, options: [
          { value: 0, label: 'Soft Clip' },
          { value: 1, label: 'Hard Clip' },
          { value: 2, label: 'Tube' },
          { value: 3, label: 'Quadratic' },
          { value: 4, label: 'Foldback' },
          { value: 5, label: 'Tube Clip' },
          { value: 6, label: 'Diode' },
        ]},
        { name: 'level', label: 'Level', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 },
      ],
      presets: [
        { name: 'Mild Overdrive', values: { drive: 0.3, tone: 0.6, mode: 0, level: 0.6 } },
        { name: 'Crunch', values: { drive: 0.6, tone: 0.5, mode: 2, level: 0.5 } },
        { name: 'Heavy Distortion', values: { drive: 0.9, tone: 0.4, mode: 1, level: 0.4 } },
        { name: 'Synth Fuzz', values: { drive: 0.7, tone: 0.7, mode: 4, level: 0.5 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'distortion'),
    defaultParams: defaultWorkletParams.distortion,
  },
  {
    metadata: {
      id: 'delay',
      name: 'Delay',
      description: 'Digital delay with feedback and damping control',
      category: 'time',
      color: '#3b82f6',
      tags: ['delay', 'echo', 'repeat'],
      parameters: [
        { name: 'time', label: 'Time', type: 'slider', min: 1, max: 2000, step: 1, default: 300, unit: 'ms' },
        { name: 'feedback', label: 'Feedback', type: 'slider', min: 0, max: 0.95, step: 0.01, default: 0.4 },
        { name: 'damping', label: 'Damping', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
      ],
      presets: [
        { name: 'Slapback', values: { time: 80, feedback: 0.2, damping: 0.5 } },
        { name: 'Quarter Note', values: { time: 375, feedback: 0.4, damping: 0.3 } },
        { name: 'Tape Echo', values: { time: 350, feedback: 0.6, damping: 0.6 } },
        { name: 'Ambient', values: { time: 600, feedback: 0.7, damping: 0.7, mix: 0.3 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'delay'),
    defaultParams: defaultWorkletParams.delay,
  },
  {
    metadata: {
      id: 'chorus',
      name: 'Chorus',
      description: 'Multi-voice chorus with adjustable rate and depth',
      category: 'modulation',
      color: '#8b5cf6',
      tags: ['chorus', 'modulation', 'ensemble'],
      parameters: [
        { name: 'rate', label: 'Rate', type: 'slider', min: 0.1, max: 10, step: 0.1, default: 1.5, unit: 'Hz' },
        { name: 'depth', label: 'Depth', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'voices', label: 'Voices', type: 'slider', min: 1, max: 4, step: 1, default: 2 },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
      ],
      presets: [
        { name: 'Subtle', values: { rate: 0.8, depth: 0.3, voices: 2 } },
        { name: 'Classic', values: { rate: 1.5, depth: 0.5, voices: 2 } },
        { name: 'Rich Ensemble', values: { rate: 1.2, depth: 0.7, voices: 4 } },
        { name: 'Fast Vibrato', values: { rate: 5, depth: 0.4, voices: 1 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'chorus'),
    defaultParams: defaultWorkletParams.chorus,
  },
  {
    metadata: {
      id: 'compressor',
      name: 'Compressor',
      description: 'Dynamics compressor with adjustable threshold, ratio, and timing',
      category: 'dynamics',
      color: '#f59e0b',
      tags: ['compressor', 'dynamics', 'limiter'],
      parameters: [
        { name: 'threshold', label: 'Threshold', type: 'slider', min: -60, max: 0, step: 0.5, default: -20, unit: 'dB' },
        { name: 'ratio', label: 'Ratio', type: 'slider', min: 1, max: 20, step: 0.5, default: 4 },
        { name: 'attack', label: 'Attack', type: 'slider', min: 0.1, max: 100, step: 0.1, default: 10, unit: 'ms' },
        { name: 'release', label: 'Release', type: 'slider', min: 10, max: 1000, step: 1, default: 100, unit: 'ms' },
        { name: 'makeupGain', label: 'Makeup', type: 'slider', min: 0, max: 24, step: 0.5, default: 0, unit: 'dB' },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 },
      ],
      presets: [
        { name: 'Gentle', values: { threshold: -15, ratio: 2, attack: 20, release: 200 } },
        { name: 'Vocal', values: { threshold: -20, ratio: 4, attack: 5, release: 100, makeupGain: 3 } },
        { name: 'Bass', values: { threshold: -18, ratio: 6, attack: 10, release: 150, makeupGain: 4 } },
        { name: 'Limiter', values: { threshold: -3, ratio: 20, attack: 0.5, release: 50 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'compressor'),
    defaultParams: defaultWorkletParams.compressor,
  },
  {
    metadata: {
      id: 'tremolo',
      name: 'Tremolo',
      description: 'LFO-modulated amplitude effect with sine and triangle waveforms',
      category: 'modulation',
      color: '#ec4899',
      tags: ['tremolo', 'modulation', 'amplitude'],
      parameters: [
        { name: 'rate', label: 'Rate', type: 'slider', min: 0.5, max: 15, step: 0.1, default: 5, unit: 'Hz' },
        { name: 'depth', label: 'Depth', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'waveform', label: 'Waveform', type: 'select', min: 0, max: 1, default: 0, options: [
          { value: 0, label: 'Sine' },
          { value: 1, label: 'Triangle' },
        ]},
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 },
      ],
      presets: [
        { name: 'Subtle', values: { rate: 3, depth: 0.3, waveform: 0 } },
        { name: 'Classic', values: { rate: 6, depth: 0.6, waveform: 0 } },
        { name: 'Choppy', values: { rate: 8, depth: 1, waveform: 1 } },
        { name: 'Slow Throb', values: { rate: 1, depth: 0.5, waveform: 0 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'tremolo'),
    defaultParams: defaultWorkletParams.tremolo,
  },
  {
    metadata: {
      id: 'reverb',
      name: 'Reverb',
      description: 'Algorithmic reverb with room simulation and stereo width control',
      category: 'time',
      color: '#06b6d4',
      tags: ['reverb', 'space', 'room', 'hall'],
      parameters: [
        { name: 'roomSize', label: 'Room Size', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'damping', label: 'Damping', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'preDelay', label: 'Pre-Delay', type: 'slider', min: 0, max: 100, step: 1, default: 10, unit: 'ms' },
        { name: 'decay', label: 'Decay', type: 'slider', min: 0.1, max: 10, step: 0.1, default: 1.5, unit: 's' },
        { name: 'width', label: 'Width', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.8 },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
      ],
      presets: [
        { name: 'Small Room', values: { roomSize: 0.3, damping: 0.6, preDelay: 5, decay: 0.5, width: 0.5 } },
        { name: 'Medium Hall', values: { roomSize: 0.5, damping: 0.4, preDelay: 20, decay: 1.5, width: 0.8 } },
        { name: 'Large Hall', values: { roomSize: 0.8, damping: 0.3, preDelay: 40, decay: 3, width: 1 } },
        { name: 'Plate', values: { roomSize: 0.7, damping: 0.7, preDelay: 0, decay: 2, width: 1 } },
        { name: 'Cathedral', values: { roomSize: 0.95, damping: 0.2, preDelay: 60, decay: 6, width: 1, mix: 0.4 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'reverb'),
    defaultParams: defaultWorkletParams.reverb,
  },
  {
    metadata: {
      id: 'basspurr',
      name: 'BassPurr',
      description: 'Bass guitar harmonics generator with fundamental, even, and odd harmonic paths',
      category: 'distortion',
      color: '#a855f7',
      tags: ['bass', 'harmonics', 'enhancer'],
      parameters: [
        { name: 'fundamental', label: 'Fundamental', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.7 },
        { name: 'even', label: 'Even Harmonics', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
        { name: 'odd', label: 'Odd Harmonics', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
        { name: 'tone', label: 'Tone', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'output', label: 'Output', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.7 },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 },
      ],
      presets: [
        { name: 'Subtle Warmth', values: { fundamental: 0.8, even: 0.2, odd: 0.1, tone: 0.4 } },
        { name: 'Full Growl', values: { fundamental: 0.5, even: 0.5, odd: 0.6, tone: 0.6 } },
        { name: 'Clean Sub', values: { fundamental: 1, even: 0, odd: 0, tone: 0.3 } },
        { name: 'Harmonic Rich', values: { fundamental: 0.4, even: 0.6, odd: 0.5, tone: 0.7 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'basspurr'),
    defaultParams: defaultWorkletParams.basspurr,
  },
  {
    metadata: {
      id: 'growlingbass',
      name: 'Growling Bass',
      description: 'Growling/purring bass with octave-down subharmonic and filtered harmonic distortion',
      category: 'distortion',
      color: '#dc2626',
      tags: ['bass', 'subharmonic', 'octave', 'growl', 'harmonics'],
      parameters: [
        { name: 'subLevel', label: 'Sub Level', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.5 },
        { name: 'oddLevel', label: 'Odd Harmonics', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
        { name: 'evenLevel', label: 'Even Harmonics', type: 'slider', min: 0, max: 1, step: 0.01, default: 0.3 },
        { name: 'toneFreq', label: 'Tone', type: 'slider', min: 100, max: 4000, step: 10, default: 800, unit: 'Hz' },
        { name: 'mix', label: 'Mix', type: 'slider', min: 0, max: 1, step: 0.01, default: 1 },
      ],
      presets: [
        { name: 'Subtle Growl', values: { subLevel: 0.3, oddLevel: 0.2, evenLevel: 0.1, toneFreq: 600 } },
        { name: 'Heavy Purr', values: { subLevel: 0.6, oddLevel: 0.4, evenLevel: 0.3, toneFreq: 800 } },
        { name: 'Octave Down', values: { subLevel: 0.8, oddLevel: 0, evenLevel: 0, toneFreq: 400 } },
        { name: 'Aggressive', values: { subLevel: 0.5, oddLevel: 0.7, evenLevel: 0.5, toneFreq: 1200 } },
        { name: 'Synth Bass', values: { subLevel: 0.7, oddLevel: 0.3, evenLevel: 0.6, toneFreq: 1500 } },
      ],
    },
    factory: (ctx) => createWorkletEffect(ctx, 'growlingbass'),
    defaultParams: defaultWorkletParams.growlingbass,
  },
];

// Register all built-in effects
builtInEffects.forEach(effect => effectRegistry.register(effect));

// Export utility types and functions
export type EffectCategory = EffectMetadata['category'];
export const effectCategories: EffectCategory[] = ['dynamics', 'modulation', 'time', 'distortion', 'filter', 'utility'];

export const categoryLabels: Record<EffectCategory, string> = {
  dynamics: 'Dynamics',
  modulation: 'Modulation',
  time: 'Time-Based',
  distortion: 'Distortion',
  filter: 'Filter',
  utility: 'Utility',
};
