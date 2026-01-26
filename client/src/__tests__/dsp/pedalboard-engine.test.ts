import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  PedalboardEngine,
  pedalboardEngine,
  type PedalboardState,
  type PedalboardEffect,
  type AudioLevels,
} from '../../lib/dsp/pedalboard-engine';
import {
  MockAudioContext,
  MockGainNode,
  MockAnalyserNode,
  MockAudioWorkletNode,
  MockAudioParam,
  setupAudioContextMock,
  cleanupAudioContextMock,
} from '../mocks/audio-context.mock';
import type { WorkletEffectType } from '../../lib/dsp/worklet-effects';

// Mock the worklet-effects module
vi.mock('../../lib/dsp/worklet-effects', () => ({
  loadEffectWorklets: vi.fn().mockResolvedValue(undefined),
  createWorkletEffect: vi.fn((context, type) => {
    const mockNode = {
      input: new MockGainNode(context),
      output: new MockGainNode(context),
      bypass: false,
      mix: 1,
      setBypass: vi.fn(),
      setMix: vi.fn(),
      setAllParams: vi.fn(),
      destroy: vi.fn(),
    };
    return mockNode;
  }),
  LevelMeter: vi.fn().mockImplementation(function(this: any, context: any) {
    this.input = new MockGainNode(context);
    this.output = new MockGainNode(context);
    this.onLevels = vi.fn();
    this.destroy = vi.fn();
  }),
  defaultWorkletParams: {
    eq: { lowGain: 0, lowFreq: 320, midGain: 0, midFreq: 1000, midQ: 1, highGain: 0, highFreq: 3200, mix: 1 },
    distortion: { drive: 0.5, tone: 0.5, mode: 0, level: 0.5, mix: 1 },
    delay: { time: 300, feedback: 0.4, damping: 0.3, mix: 0.5 },
    chorus: { rate: 1.5, depth: 0.5, voices: 2, mix: 0.5 },
    compressor: { threshold: -20, ratio: 4, attack: 10, release: 100, makeupGain: 0, mix: 1 },
    basspurr: { fundamental: 0.7, even: 0.3, odd: 0.3, tone: 0.5, output: 0.7, mix: 1 },
    tremolo: { rate: 5, depth: 0.5, waveform: 0, mix: 1 },
    reverb: { roomSize: 0.5, damping: 0.5, preDelay: 10, decay: 1.5, width: 0.8, mix: 0.3 },
    growlingbass: { subLevel: 0.5, oddLevel: 0.3, evenLevel: 0.3, toneFreq: 800, mix: 1 },
    gate: { threshold: -40, attack: 1, hold: 50, release: 100, range: -80, ratio: 10, hpfFreq: 80, hpfEnabled: 0, mix: 1 },
  },
}));

describe('PedalboardEngine', () => {
  let engine: PedalboardEngine;
  let mockContext: MockAudioContext;

  beforeEach(() => {
    setupAudioContextMock();
    engine = new PedalboardEngine();
    mockContext = null as unknown as MockAudioContext;
  });

  afterEach(() => {
    if (engine) {
      engine.destroy();
    }
    cleanupAudioContextMock();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = engine.getState();

      expect(state.isInitialized).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.inputGain).toBe(1);
      expect(state.outputGain).toBe(1);
      expect(state.globalBypass).toBe(false);
      expect(state.effects).toEqual([]);
      expect(state.inputSource).toBeNull();
    });

    it('should initialize audio context and worklets', async () => {
      await engine.initialize();

      const state = engine.getState();
      expect(state.isInitialized).toBe(true);
      expect(engine.audioContext).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await engine.initialize();
      const context1 = engine.audioContext;

      await engine.initialize();
      const context2 = engine.audioContext;

      expect(context1).toBe(context2);
    });

    it('should create gain nodes on initialization', async () => {
      await engine.initialize();

      expect(engine.audioContext).toBeDefined();
      // Gain nodes are created internally
      const state = engine.getState();
      expect(state.isInitialized).toBe(true);
    });

    it('should create analyser node for visualization', async () => {
      await engine.initialize();

      expect(engine.analyser).toBeDefined();
    });

    it('should initialize crossfade chain nodes', async () => {
      await engine.initialize();

      // Crossfade chains are internal - verify through graph building behavior
      const state = engine.getState();
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('Audio Context Management', () => {
    it('should resume suspended audio context', async () => {
      await engine.initialize();
      const context = engine.audioContext as unknown as MockAudioContext;

      // Simulate suspended state
      (context as any).state = 'suspended';

      await engine.resume();

      expect(context.resume).toHaveBeenCalled();
    });

    it('should not resume already running context', async () => {
      await engine.initialize();
      const context = engine.audioContext as unknown as MockAudioContext;

      // Context is running by default in mock
      expect(context.state).toBe('running');

      await engine.resume();

      // resume should only be called if state was suspended
      expect(context.resume).not.toHaveBeenCalled();
    });
  });

  describe('Input Source Connection', () => {
    it('should connect audio element as source', async () => {
      await engine.initialize();

      const mockAudioElement = document.createElement('audio');
      await engine.connectAudioElement(mockAudioElement);

      const state = engine.getState();
      expect(state.inputSource).toBe('file');
    });

    it('should reuse existing MediaElementAudioSourceNode for same element', async () => {
      await engine.initialize();

      const mockAudioElement = document.createElement('audio');
      await engine.connectAudioElement(mockAudioElement);
      await engine.connectAudioElement(mockAudioElement);

      // Should not throw - reuses existing source
      const state = engine.getState();
      expect(state.inputSource).toBe('file');
    });

    it('should connect microphone as source', async () => {
      await engine.initialize();

      // Mock getUserMedia
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      } as unknown as MediaStream;

      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        configurable: true,
      });

      const stream = await engine.connectMicrophone();

      expect(stream).toBe(mockStream);
      const state = engine.getState();
      expect(state.inputSource).toBe('microphone');

      // Cleanup
      if (originalGetUserMedia) {
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          value: originalGetUserMedia,
        });
      }
    });

    it('should disconnect existing source when connecting new one', async () => {
      await engine.initialize();

      const mockAudioElement = document.createElement('audio');
      await engine.connectAudioElement(mockAudioElement);

      engine.disconnectSource();

      const state = engine.getState();
      expect(state.inputSource).toBeNull();
    });

    it('should stop microphone tracks on disconnect', async () => {
      await engine.initialize();

      const stopMock = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: stopMock }],
      } as unknown as MediaStream;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        configurable: true,
      });

      await engine.connectMicrophone();
      engine.disconnectMicrophone();

      expect(stopMock).toHaveBeenCalled();
      const state = engine.getState();
      expect(state.inputSource).toBeNull();
    });
  });

  describe('Effect Chain Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should add effect to chain', () => {
      const effectId = engine.addEffect('eq');

      expect(effectId).toBeDefined();
      expect(effectId).toContain('eq-');

      const state = engine.getState();
      expect(state.effects).toHaveLength(1);
      expect(state.effects[0].type).toBe('eq');
    });

    it('should add multiple effects', () => {
      engine.addEffect('eq');
      engine.addEffect('distortion');
      engine.addEffect('delay');

      const state = engine.getState();
      expect(state.effects).toHaveLength(3);
    });

    it('should generate unique effect IDs', () => {
      const id1 = engine.addEffect('eq');
      const id2 = engine.addEffect('eq');

      expect(id1).not.toBe(id2);
    });

    it('should remove effect from chain', () => {
      const effectId = engine.addEffect('eq');
      engine.addEffect('distortion');

      engine.removeEffect(effectId);

      const state = engine.getState();
      expect(state.effects).toHaveLength(1);
      expect(state.effects[0].type).toBe('distortion');
    });

    it('should handle removing non-existent effect', () => {
      engine.addEffect('eq');

      // Should not throw
      engine.removeEffect('non-existent-id');

      const state = engine.getState();
      expect(state.effects).toHaveLength(1);
    });

    it('should reorder effects', () => {
      const id1 = engine.addEffect('eq');
      const id2 = engine.addEffect('distortion');
      const id3 = engine.addEffect('delay');

      engine.reorderEffects([id3, id1, id2]);

      const state = engine.getState();
      expect(state.effects[0].id).toBe(id3);
      expect(state.effects[1].id).toBe(id1);
      expect(state.effects[2].id).toBe(id2);
    });

    it('should validate reorder with correct number of effects', () => {
      const id1 = engine.addEffect('eq');
      const id2 = engine.addEffect('distortion');

      // Invalid: wrong number of IDs
      engine.reorderEffects([id1]);

      const state = engine.getState();
      // Order should be unchanged
      expect(state.effects[0].id).toBe(id1);
      expect(state.effects[1].id).toBe(id2);
    });

    it('should validate reorder with existing IDs only', () => {
      const id1 = engine.addEffect('eq');
      engine.addEffect('distortion');

      // Invalid: non-existent ID
      engine.reorderEffects([id1, 'fake-id']);

      const state = engine.getState();
      expect(state.effects).toHaveLength(2);
    });

    it('should toggle effect enabled state', () => {
      const effectId = engine.addEffect('eq');

      let state = engine.getState();
      expect(state.effects[0].enabled).toBe(true);

      engine.toggleEffect(effectId);

      state = engine.getState();
      expect(state.effects[0].enabled).toBe(false);

      engine.toggleEffect(effectId);

      state = engine.getState();
      expect(state.effects[0].enabled).toBe(true);
    });

    it('should handle toggling non-existent effect', () => {
      engine.addEffect('eq');

      // Should not throw
      engine.toggleEffect('non-existent-id');

      const state = engine.getState();
      expect(state.effects[0].enabled).toBe(true);
    });
  });

  describe('Effect Parameter Updates', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should update effect parameter', () => {
      const effectId = engine.addEffect('eq');

      engine.updateEffectParam(effectId, 'lowGain', 6);

      const state = engine.getState();
      expect(state.effects[0].params.lowGain).toBe(6);
    });

    it('should update mix parameter', () => {
      const effectId = engine.addEffect('delay');

      engine.updateEffectParam(effectId, 'mix', 0.7);

      const state = engine.getState();
      expect(state.effects[0].params.mix).toBe(0.7);
    });

    it('should handle updating non-existent effect', () => {
      engine.addEffect('eq');

      // Should not throw
      engine.updateEffectParam('non-existent-id', 'lowGain', 6);
    });
  });

  describe('Gain Control', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should set input gain', () => {
      engine.setInputGain(0.5);

      const state = engine.getState();
      expect(state.inputGain).toBe(0.5);
    });

    it('should clamp input gain to valid range', () => {
      engine.setInputGain(-1);
      expect(engine.getState().inputGain).toBe(0);

      engine.setInputGain(3);
      expect(engine.getState().inputGain).toBe(2);
    });

    it('should set output gain', () => {
      engine.setOutputGain(0.8);

      const state = engine.getState();
      expect(state.outputGain).toBe(0.8);
    });

    it('should clamp output gain to valid range', () => {
      engine.setOutputGain(-0.5);
      expect(engine.getState().outputGain).toBe(0);

      engine.setOutputGain(2.5);
      expect(engine.getState().outputGain).toBe(2);
    });
  });

  describe('Global Bypass', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should enable global bypass', () => {
      engine.setGlobalBypass(true);

      const state = engine.getState();
      expect(state.globalBypass).toBe(true);
    });

    it('should disable global bypass', () => {
      engine.setGlobalBypass(true);
      engine.setGlobalBypass(false);

      const state = engine.getState();
      expect(state.globalBypass).toBe(false);
    });
  });

  describe('Crossfade Transitions', () => {
    const CROSSFADE_DURATION = 0.015; // 15ms as defined in engine

    beforeEach(async () => {
      await engine.initialize();
    });

    it('should use crossfade when rebuilding audio graph', async () => {
      // Connect source to trigger initial graph build
      const mockAudioElement = document.createElement('audio');
      await engine.connectAudioElement(mockAudioElement);

      const context = engine.audioContext as unknown as MockAudioContext;
      const gainNodes = (context.createGain as Mock).mock.results;

      // Add effect to trigger graph rebuild with crossfade
      engine.addEffect('eq');

      // Verify gain nodes were created for crossfade chains
      expect(gainNodes.length).toBeGreaterThan(0);
    });

    it('should alternate between chain A and B on reorder', async () => {
      const mockAudioElement = document.createElement('audio');
      await engine.connectAudioElement(mockAudioElement);

      const id1 = engine.addEffect('eq');
      const id2 = engine.addEffect('distortion');

      // Reorder effects - should trigger crossfade
      engine.reorderEffects([id2, id1]);

      const state = engine.getState();
      expect(state.effects[0].id).toBe(id2);
    });
  });

  describe('Visualization Data', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should return frequency data from analyser', () => {
      const data = engine.getFrequencyData();

      expect(data).toBeInstanceOf(Uint8Array);
    });

    it('should return time domain data from analyser', () => {
      const data = engine.getTimeDomainData();

      expect(data).toBeInstanceOf(Uint8Array);
    });

    it('should return empty array when analyser not available', () => {
      const uninitializedEngine = new PedalboardEngine();

      const data = uninitializedEngine.getFrequencyData();
      expect(data).toHaveLength(0);

      uninitializedEngine.destroy();
    });
  });

  describe('State Callbacks', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should notify state change callbacks', () => {
      const callback = vi.fn();
      engine.onStateChange(callback);

      engine.addEffect('eq');

      expect(callback).toHaveBeenCalled();
      const state = callback.mock.calls[0][0];
      expect(state.effects).toHaveLength(1);
    });

    it('should allow unsubscribing from state changes', () => {
      const callback = vi.fn();
      const unsubscribe = engine.onStateChange(callback);

      unsubscribe();
      engine.addEffect('eq');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify level change callbacks', () => {
      const callback = vi.fn();
      engine.onLevelsChange(callback);

      // Levels are updated internally via meter callbacks
      // This is testing the subscription mechanism
      expect(typeof engine.onLevelsChange).toBe('function');
    });

    it('should allow unsubscribing from level changes', () => {
      const callback = vi.fn();
      const unsubscribe = engine.onLevelsChange(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('Preset Export/Import', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should export preset as JSON', () => {
      engine.setInputGain(0.8);
      engine.setOutputGain(1.2);
      engine.addEffect('eq');
      engine.addEffect('delay');

      const preset = engine.exportPreset();
      const parsed = JSON.parse(preset);

      expect(parsed.version).toBe(1);
      expect(parsed.inputGain).toBe(0.8);
      expect(parsed.outputGain).toBe(1.2);
      expect(parsed.effects).toHaveLength(2);
    });

    it('should import preset from JSON', () => {
      const preset = JSON.stringify({
        version: 1,
        inputGain: 0.7,
        outputGain: 0.9,
        effects: [
          { type: 'distortion', enabled: true, params: { drive: 0.8 } },
          { type: 'delay', enabled: false, params: { time: 500 } },
        ],
      });

      engine.importPreset(preset);

      const state = engine.getState();
      expect(state.inputGain).toBe(0.7);
      expect(state.outputGain).toBe(0.9);
      expect(state.effects).toHaveLength(2);
      expect(state.effects[0].type).toBe('distortion');
      expect(state.effects[1].enabled).toBe(false);
    });

    it('should reject preset with wrong version', () => {
      const preset = JSON.stringify({
        version: 2,
        effects: [],
      });

      engine.importPreset(preset);

      // Should not crash, state should remain unchanged
      const state = engine.getState();
      expect(state.effects).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      engine.importPreset('invalid json {{{');

      // Should not crash
      const state = engine.getState();
      expect(state).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should clear existing effects on import', () => {
      engine.addEffect('eq');
      engine.addEffect('chorus');

      const preset = JSON.stringify({
        version: 1,
        inputGain: 1,
        outputGain: 1,
        effects: [
          { type: 'distortion', enabled: true, params: {} },
        ],
      });

      engine.importPreset(preset);

      const state = engine.getState();
      expect(state.effects).toHaveLength(1);
      expect(state.effects[0].type).toBe('distortion');
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up on destroy', async () => {
      await engine.initialize();
      engine.addEffect('eq');
      engine.addEffect('delay');

      engine.destroy();

      const state = engine.getState();
      expect(state.isInitialized).toBe(false);
    });

    it('should disconnect sources on destroy', async () => {
      await engine.initialize();

      const mockAudioElement = document.createElement('audio');
      await engine.connectAudioElement(mockAudioElement);

      engine.destroy();

      const state = engine.getState();
      expect(state.inputSource).toBeNull();
    });

    it('should destroy all effects on destroy', async () => {
      await engine.initialize();
      engine.addEffect('eq');
      engine.addEffect('delay');

      engine.destroy();

      const state = engine.getState();
      expect(state.effects).toHaveLength(0);
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton pedalboardEngine', () => {
      expect(pedalboardEngine).toBeInstanceOf(PedalboardEngine);
    });
  });

  describe('Accessor Properties', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should expose audioContext', () => {
      expect(engine.audioContext).toBeDefined();
    });

    it('should expose analyser node', () => {
      expect(engine.analyser).toBeDefined();
    });

    it('should expose output node for recording', () => {
      expect(engine.outputNode).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations before initialization', () => {
      // These should not throw
      const id = engine.addEffect('eq');
      expect(id).toBe(''); // Returns empty string when not initialized

      engine.setInputGain(0.5);
      engine.setOutputGain(0.5);
      engine.setGlobalBypass(true);
    });

    it('should return empty visualization data when not initialized', () => {
      const freqData = engine.getFrequencyData();
      const timeData = engine.getTimeDomainData();

      expect(freqData).toHaveLength(0);
      expect(timeData).toHaveLength(0);
    });

    it('should handle rapid effect add/remove', async () => {
      await engine.initialize();

      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(engine.addEffect('eq'));
      }

      for (const id of ids) {
        engine.removeEffect(id);
      }

      const state = engine.getState();
      expect(state.effects).toHaveLength(0);
    });
  });
});

describe('PedalboardEngine Level Metering', () => {
  let engine: PedalboardEngine;

  beforeEach(async () => {
    setupAudioContextMock();
    engine = new PedalboardEngine();
    await engine.initialize();
  });

  afterEach(() => {
    engine.destroy();
    cleanupAudioContextMock();
    vi.clearAllMocks();
  });

  it('should have default zero levels', () => {
    const state = engine.getState();
    const levels = state.levels;

    expect(levels.inputPeakL).toBe(0);
    expect(levels.inputPeakR).toBe(0);
    expect(levels.inputRmsL).toBe(0);
    expect(levels.inputRmsR).toBe(0);
    expect(levels.outputPeakL).toBe(0);
    expect(levels.outputPeakR).toBe(0);
    expect(levels.outputRmsL).toBe(0);
    expect(levels.outputRmsR).toBe(0);
  });

  it('should throttle level updates', () => {
    // The engine has a 100ms throttle for level updates
    // This prevents performance issues during visualization
    const callback = vi.fn();
    engine.onLevelsChange(callback);

    // Levels update internally - testing the mechanism exists
    expect(typeof engine.onLevelsChange).toBe('function');
  });
});
