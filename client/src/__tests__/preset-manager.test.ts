import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPresets,
  savePreset,
  updatePreset,
  deletePreset,
  getPreset,
  exportPresetToJson,
  importPresetFromJson,
  encodePresetForUrl,
  decodePresetFromUrl,
  initializeDefaultPresets,
  DEFAULT_PRESETS,
  Preset,
} from '../lib/preset-manager';

const STORAGE_KEY = 'audionoise-presets';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _getStore: () => store,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Preset Manager', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('getPresets', () => {
    it('should return empty array when no presets exist', () => {
      const presets = getPresets();
      expect(presets).toEqual([]);
    });

    it('should return saved presets', () => {
      const testPresets = [
        { id: 'test-1', name: 'Test Preset', createdAt: Date.now(), updatedAt: Date.now(), inputGain: 1, outputGain: 1, effects: [] },
      ];
      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(testPresets));

      const presets = getPresets();
      expect(presets).toEqual(testPresets);
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'invalid json');
      const presets = getPresets();
      expect(presets).toEqual([]);
    });
  });

  describe('savePreset', () => {
    it('should save a new preset', () => {
      const preset = savePreset({
        name: 'My Preset',
        description: 'Test description',
        inputGain: 1.5,
        outputGain: 0.8,
        effects: [{ type: 'distortion', enabled: true, params: { drive: 0.5 } }],
      });

      expect(preset.id).toMatch(/^preset-\d+-\w+$/);
      expect(preset.name).toBe('My Preset');
      expect(preset.description).toBe('Test description');
      expect(preset.inputGain).toBe(1.5);
      expect(preset.outputGain).toBe(0.8);
      expect(preset.effects).toHaveLength(1);
      expect(preset.createdAt).toBeDefined();
      expect(preset.updatedAt).toBeDefined();
    });

    it('should add to existing presets', () => {
      savePreset({ name: 'First', inputGain: 1, outputGain: 1, effects: [] });
      savePreset({ name: 'Second', inputGain: 1, outputGain: 1, effects: [] });

      const presets = getPresets();
      expect(presets).toHaveLength(2);
      expect(presets[0].name).toBe('First');
      expect(presets[1].name).toBe('Second');
    });
  });

  describe('updatePreset', () => {
    it('should update an existing preset', () => {
      const preset = savePreset({ name: 'Original', inputGain: 1, outputGain: 1, effects: [] });

      const updated = updatePreset(preset.id, { name: 'Updated', inputGain: 2 });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
      expect(updated!.inputGain).toBe(2);
      expect(updated!.outputGain).toBe(1);
      expect(updated!.createdAt).toBe(preset.createdAt);
    });

    it('should return null for non-existent preset', () => {
      const result = updatePreset('non-existent-id', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should persist the update', () => {
      const preset = savePreset({ name: 'Original', inputGain: 1, outputGain: 1, effects: [] });
      updatePreset(preset.id, { name: 'Updated' });

      const presets = getPresets();
      expect(presets[0].name).toBe('Updated');
    });
  });

  describe('deletePreset', () => {
    it('should delete an existing preset', () => {
      const preset = savePreset({ name: 'To Delete', inputGain: 1, outputGain: 1, effects: [] });
      
      const result = deletePreset(preset.id);
      
      expect(result).toBe(true);
      expect(getPresets()).toHaveLength(0);
    });

    it('should return false for non-existent preset', () => {
      const result = deletePreset('non-existent-id');
      expect(result).toBe(false);
    });

    it('should only delete the specified preset', () => {
      const preset1 = savePreset({ name: 'Keep', inputGain: 1, outputGain: 1, effects: [] });
      const preset2 = savePreset({ name: 'Delete', inputGain: 1, outputGain: 1, effects: [] });

      deletePreset(preset2.id);

      const presets = getPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe(preset1.id);
    });
  });

  describe('getPreset', () => {
    it('should return a preset by ID', () => {
      const saved = savePreset({ name: 'Test', inputGain: 1, outputGain: 1, effects: [] });
      
      const found = getPreset(saved.id);
      
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Test');
    });

    it('should return null for non-existent ID', () => {
      const result = getPreset('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('exportPresetToJson', () => {
    it('should export preset to JSON format', () => {
      const preset: Preset = {
        id: 'test-id',
        name: 'Export Test',
        description: 'Test description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        inputGain: 1.5,
        outputGain: 0.8,
        effects: [{ type: 'delay', enabled: true, params: { time: 500, feedback: 0.5 } }],
      };

      const json = exportPresetToJson(preset);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.description).toBe('Test description');
      expect(parsed.inputGain).toBe(1.5);
      expect(parsed.outputGain).toBe(0.8);
      expect(parsed.effects).toHaveLength(1);
      expect(parsed.effects[0].type).toBe('delay');
    });

    it('should not include id and timestamps in export', () => {
      const preset: Preset = {
        id: 'test-id',
        name: 'Test',
        createdAt: 12345,
        updatedAt: 67890,
        inputGain: 1,
        outputGain: 1,
        effects: [],
      };

      const json = exportPresetToJson(preset);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBeUndefined();
      expect(parsed.createdAt).toBeUndefined();
      expect(parsed.updatedAt).toBeUndefined();
    });
  });

  describe('importPresetFromJson', () => {
    it('should import a valid JSON preset', () => {
      const json = JSON.stringify({
        version: 1,
        name: 'Imported',
        description: 'Imported preset',
        inputGain: 1.2,
        outputGain: 0.9,
        effects: [{ type: 'chorus', enabled: true, params: { rate: 0.5 } }],
      });

      const preset = importPresetFromJson(json);

      expect(preset.name).toBe('Imported');
      expect(preset.description).toBe('Imported preset');
      expect(preset.inputGain).toBe(1.2);
      expect(preset.outputGain).toBe(0.9);
      expect(preset.effects).toHaveLength(1);
      expect(preset.id).toBeDefined();
    });

    it('should use custom name if provided', () => {
      const json = JSON.stringify({
        version: 1,
        name: 'Original Name',
        inputGain: 1,
        outputGain: 1,
        effects: [],
      });

      const preset = importPresetFromJson(json, 'Custom Name');
      expect(preset.name).toBe('Custom Name');
    });

    it('should throw error for unsupported version', () => {
      const json = JSON.stringify({
        version: 2,
        name: 'Test',
        effects: [],
      });

      expect(() => importPresetFromJson(json)).toThrow('Unsupported preset version');
    });

    it('should use defaults for missing fields', () => {
      const json = JSON.stringify({
        version: 1,
        name: 'Minimal',
      });

      const preset = importPresetFromJson(json);
      expect(preset.inputGain).toBe(1);
      expect(preset.outputGain).toBe(1);
      expect(preset.effects).toEqual([]);
    });
  });

  describe('encodePresetForUrl', () => {
    it('should encode preset for URL sharing', () => {
      const preset: Preset = {
        id: 'test-id',
        name: 'URL Preset',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        inputGain: 1.2,
        outputGain: 0.8,
        effects: [{ type: 'delay', enabled: true, params: { time: 300 } }],
      };

      const encoded = encodePresetForUrl(preset);
      
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should produce decodable output', () => {
      const preset: Preset = {
        id: 'test-id',
        name: 'Roundtrip Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        inputGain: 1.5,
        outputGain: 0.7,
        effects: [
          { type: 'distortion', enabled: true, params: { drive: 0.6 } },
          { type: 'delay', enabled: false, params: { time: 200 } },
        ],
      };

      const encoded = encodePresetForUrl(preset);
      const decoded = decodePresetFromUrl(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe('Roundtrip Test');
      expect(decoded!.inputGain).toBe(1.5);
      expect(decoded!.outputGain).toBe(0.7);
      expect(decoded!.effects).toHaveLength(2);
      expect(decoded!.effects[0].type).toBe('distortion');
      expect(decoded!.effects[0].enabled).toBe(true);
      expect(decoded!.effects[1].type).toBe('delay');
      expect(decoded!.effects[1].enabled).toBe(false);
    });
  });

  describe('decodePresetFromUrl', () => {
    it('should decode a valid encoded preset', () => {
      const data = { v: 1, n: 'Decoded', ig: 1.3, og: 0.9, fx: [] };
      const encoded = btoa(encodeURIComponent(JSON.stringify(data)));

      const decoded = decodePresetFromUrl(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe('Decoded');
      expect(decoded!.inputGain).toBe(1.3);
      expect(decoded!.outputGain).toBe(0.9);
    });

    it('should return null for invalid version', () => {
      const data = { v: 99, n: 'Bad Version', ig: 1, og: 1, fx: [] };
      const encoded = btoa(encodeURIComponent(JSON.stringify(data)));

      const decoded = decodePresetFromUrl(encoded);
      expect(decoded).toBeNull();
    });

    it('should return null for invalid base64', () => {
      const decoded = decodePresetFromUrl('invalid-base64!!!');
      expect(decoded).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const encoded = btoa(encodeURIComponent('not json'));
      const decoded = decodePresetFromUrl(encoded);
      expect(decoded).toBeNull();
    });

    it('should use default values for missing fields', () => {
      const data = { v: 1 };
      const encoded = btoa(encodeURIComponent(JSON.stringify(data)));

      const decoded = decodePresetFromUrl(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.name).toBe('Shared Preset');
      expect(decoded!.inputGain).toBe(1);
      expect(decoded!.outputGain).toBe(1);
      expect(decoded!.effects).toEqual([]);
    });
  });

  describe('DEFAULT_PRESETS', () => {
    it('should have required presets', () => {
      expect(DEFAULT_PRESETS.length).toBeGreaterThan(0);
      
      const names = DEFAULT_PRESETS.map(p => p.name);
      expect(names).toContain('Clean Tone');
      expect(names).toContain('Crunch');
      expect(names).toContain('High Gain');
    });

    it('should have valid preset structure', () => {
      for (const preset of DEFAULT_PRESETS) {
        expect(preset.name).toBeDefined();
        expect(typeof preset.inputGain).toBe('number');
        expect(typeof preset.outputGain).toBe('number');
        expect(Array.isArray(preset.effects)).toBe(true);
        
        for (const effect of preset.effects) {
          expect(effect.type).toBeDefined();
          expect(typeof effect.enabled).toBe('boolean');
          expect(typeof effect.params).toBe('object');
        }
      }
    });
  });

  describe('initializeDefaultPresets', () => {
    it('should initialize default presets when none exist', () => {
      initializeDefaultPresets();

      const presets = getPresets();
      expect(presets.length).toBe(DEFAULT_PRESETS.length);
    });

    it('should not overwrite existing presets', () => {
      savePreset({ name: 'User Preset', inputGain: 1, outputGain: 1, effects: [] });

      initializeDefaultPresets();

      const presets = getPresets();
      expect(presets.length).toBe(1);
      expect(presets[0].name).toBe('User Preset');
    });
  });
});
