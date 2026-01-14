/**
 * Preset Manager
 * localStorage-based preset save/load system
 */

export interface Preset {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  inputGain: number;
  outputGain: number;
  effects: Array<{
    type: string;
    enabled: boolean;
    params: Record<string, number>;
  }>;
}

const STORAGE_KEY = 'audionoise-presets';

/**
 * Get all saved presets
 */
export function getPresets(): Preset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load presets:', error);
    return [];
  }
}

/**
 * Save a preset
 */
export function savePreset(preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>): Preset {
  const presets = getPresets();
  const newPreset: Preset = {
    ...preset,
    id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  presets.push(newPreset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

  return newPreset;
}

/**
 * Update an existing preset
 */
export function updatePreset(id: string, updates: Partial<Omit<Preset, 'id' | 'createdAt'>>): Preset | null {
  const presets = getPresets();
  const index = presets.findIndex((p) => p.id === id);

  if (index === -1) return null;

  presets[index] = {
    ...presets[index],
    ...updates,
    updatedAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets[index];
}

/**
 * Delete a preset
 */
export function deletePreset(id: string): boolean {
  const presets = getPresets();
  const filtered = presets.filter((p) => p.id !== id);

  if (filtered.length === presets.length) return false;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Get a single preset by ID
 */
export function getPreset(id: string): Preset | null {
  const presets = getPresets();
  return presets.find((p) => p.id === id) || null;
}

/**
 * Export a preset to JSON string
 */
export function exportPresetToJson(preset: Preset): string {
  return JSON.stringify({
    version: 1,
    name: preset.name,
    description: preset.description,
    inputGain: preset.inputGain,
    outputGain: preset.outputGain,
    effects: preset.effects,
  }, null, 2);
}

/**
 * Import a preset from JSON string
 */
export function importPresetFromJson(json: string, name?: string): Preset {
  const data = JSON.parse(json);

  if (data.version !== 1) {
    throw new Error('Unsupported preset version');
  }

  return savePreset({
    name: name || data.name || 'Imported Preset',
    description: data.description,
    inputGain: data.inputGain ?? 1,
    outputGain: data.outputGain ?? 1,
    effects: data.effects || [],
  });
}

/**
 * Encode preset data for URL sharing
 */
export function encodePresetForUrl(preset: Preset): string {
  const data = {
    v: 1,
    n: preset.name,
    ig: preset.inputGain,
    og: preset.outputGain,
    fx: preset.effects.map((e) => ({
      t: e.type,
      e: e.enabled ? 1 : 0,
      p: e.params,
    })),
  };
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

/**
 * Decode preset data from URL
 */
export function decodePresetFromUrl(encoded: string): Omit<Preset, 'id' | 'createdAt' | 'updatedAt'> | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const data = JSON.parse(json);

    if (data.v !== 1) return null;

    return {
      name: data.n || 'Shared Preset',
      inputGain: data.ig ?? 1,
      outputGain: data.og ?? 1,
      effects: (data.fx || []).map((e: any) => ({
        type: e.t,
        enabled: e.e === 1,
        params: e.p,
      })),
    };
  } catch (error) {
    console.error('Failed to decode preset:', error);
    return null;
  }
}

/**
 * Default presets for new users
 */
export const DEFAULT_PRESETS: Array<Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Clean Tone',
    description: 'Crystal clear with subtle compression',
    inputGain: 1,
    outputGain: 1,
    effects: [
      {
        type: 'eq',
        enabled: true,
        params: { lowGain: -2, lowFreq: 200, midGain: 2, midFreq: 1000, midQ: 1, highGain: 4, highFreq: 5000, mix: 1 },
      },
      {
        type: 'compressor',
        enabled: true,
        params: { threshold: -20, ratio: 3, attack: 10, release: 100, makeupGain: 3, mix: 1 },
      },
    ],
  },
  {
    name: 'Crunch',
    description: 'Classic rock overdrive',
    inputGain: 1.2,
    outputGain: 0.9,
    effects: [
      {
        type: 'eq',
        enabled: true,
        params: { lowGain: 2, lowFreq: 200, midGain: 4, midFreq: 800, midQ: 1.5, highGain: -2, highFreq: 4000, mix: 1 },
      },
      {
        type: 'distortion',
        enabled: true,
        params: { drive: 0.4, tone: 0.6, mode: 0, level: 0.7, mix: 1 },
      },
      {
        type: 'compressor',
        enabled: true,
        params: { threshold: -15, ratio: 4, attack: 5, release: 80, makeupGain: 4, mix: 0.7 },
      },
    ],
  },
  {
    name: 'High Gain',
    description: 'Heavy distortion for metal',
    inputGain: 1.3,
    outputGain: 0.8,
    effects: [
      {
        type: 'eq',
        enabled: true,
        params: { lowGain: 4, lowFreq: 150, midGain: -4, midFreq: 500, midQ: 2, highGain: 6, highFreq: 3000, mix: 1 },
      },
      {
        type: 'distortion',
        enabled: true,
        params: { drive: 0.8, tone: 0.5, mode: 1, level: 0.6, mix: 1 },
      },
      {
        type: 'compressor',
        enabled: true,
        params: { threshold: -10, ratio: 6, attack: 2, release: 50, makeupGain: 6, mix: 1 },
      },
    ],
  },
  {
    name: 'Ambient',
    description: 'Spacey delays and chorus',
    inputGain: 1,
    outputGain: 1,
    effects: [
      {
        type: 'chorus',
        enabled: true,
        params: { rate: 0.5, depth: 0.6, voices: 3, mix: 0.4 },
      },
      {
        type: 'delay',
        enabled: true,
        params: { time: 400, feedback: 0.5, damping: 0.4, mix: 0.35 },
      },
      {
        type: 'eq',
        enabled: true,
        params: { lowGain: -4, lowFreq: 300, midGain: 0, midFreq: 1000, midQ: 1, highGain: 6, highFreq: 6000, mix: 1 },
      },
    ],
  },
  {
    name: 'Vocal Polish',
    description: 'Smooth and present vocals',
    inputGain: 1.1,
    outputGain: 1,
    effects: [
      {
        type: 'eq',
        enabled: true,
        params: { lowGain: -6, lowFreq: 120, midGain: 3, midFreq: 2500, midQ: 1.5, highGain: 4, highFreq: 8000, mix: 1 },
      },
      {
        type: 'compressor',
        enabled: true,
        params: { threshold: -18, ratio: 4, attack: 15, release: 150, makeupGain: 4, mix: 1 },
      },
      {
        type: 'chorus',
        enabled: true,
        params: { rate: 0.3, depth: 0.2, voices: 2, mix: 0.15 },
      },
    ],
  },
];

/**
 * Initialize default presets if none exist
 */
export function initializeDefaultPresets(): void {
  const presets = getPresets();
  if (presets.length === 0) {
    DEFAULT_PRESETS.forEach((preset) => savePreset(preset));
  }
}
