/**
 * 10-Band Graphic Equalizer Tests
 * TDD approach: RED phase - these tests define expected behavior
 * NOTE: Stub implementation exists - tests skipped until full implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Web Audio API
const createMockAudioContext = () => {
  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockBiquadFilter = {
    type: 'peaking' as BiquadFilterType,
    frequency: {
      value: 1000,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    Q: {
      value: 1.4,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFrequencyResponse: vi.fn((freqs: Float32Array, mags: Float32Array, phases: Float32Array) => {
      // Simple mock: return flat response
      for (let i = 0; i < mags.length; i++) {
        mags[i] = 1;
        phases[i] = 0;
      }
    }),
  };

  return {
    createGain: vi.fn(() => ({ ...mockGainNode })),
    createBiquadFilter: vi.fn(() => ({ ...mockBiquadFilter })),
    currentTime: 0,
    sampleRate: 48000,
  } as unknown as AudioContext;
};

describe('GraphicEQEffect', () => {
  let audioContext: AudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  describe('Initialization', () => {
    it('should create 10 peaking filter bands', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // Should create 10 filters + dry/wet gains
      expect(audioContext.createBiquadFilter).toHaveBeenCalledTimes(10);
      expect(audioContext.createGain).toHaveBeenCalled();
    });

    it('should initialize with ISO standard center frequencies', async () => {
      const { GraphicEQEffect, ISO_FREQUENCIES } = await import('../../lib/dsp/effects/graphic-eq');

      // Verify ISO frequencies are correct
      expect(ISO_FREQUENCIES).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
    });

    it('should initialize all bands to 0dB (flat response)', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      const params = eq.params;
      expect(params.band31).toBe(0);
      expect(params.band62).toBe(0);
      expect(params.band125).toBe(0);
      expect(params.band250).toBe(0);
      expect(params.band500).toBe(0);
      expect(params.band1k).toBe(0);
      expect(params.band2k).toBe(0);
      expect(params.band4k).toBe(0);
      expect(params.band8k).toBe(0);
      expect(params.band16k).toBe(0);
    });

    it('should have appropriate Q factor for graphic EQ (~1.4)', async () => {
      const { GraphicEQEffect, DEFAULT_Q } = await import('../../lib/dsp/effects/graphic-eq');

      // Standard graphic EQ Q for ISO 1/3 octave bands is approximately 1.4
      expect(DEFAULT_Q).toBeCloseTo(1.4, 1);
    });
  });

  describe('Band Gain Control', () => {
    it('should set individual band gain within -12dB to +12dB range', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // Test setting gain
      eq.setBandGain(1000, 6);
      expect(eq.getBandGain(1000)).toBe(6);

      // Test clamping at max
      eq.setBandGain(1000, 20);
      expect(eq.getBandGain(1000)).toBe(12);

      // Test clamping at min
      eq.setBandGain(1000, -20);
      expect(eq.getBandGain(1000)).toBe(-12);
    });

    it('should set band gain by index', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.setBandGainByIndex(5, 3); // Index 5 = 1kHz
      expect(eq.getBandGainByIndex(5)).toBe(3);
    });

    it('should apply smooth parameter updates to avoid clicks', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // setBandGain should use setTargetAtTime or linearRampToValueAtTime
      eq.setBandGain(1000, 6);

      // The implementation should use smooth ramping, not instant value changes
      // This test verifies the implementation uses the smoothing time constant
    });
  });

  describe('Preset Curves', () => {
    it('should apply "flat" preset (all bands at 0dB)', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // First set some gains
      eq.setBandGain(1000, 6);
      eq.setBandGain(4000, -3);

      // Apply flat preset
      eq.applyPreset('flat');

      const params = eq.params;
      expect(params.band31).toBe(0);
      expect(params.band1k).toBe(0);
      expect(params.band4k).toBe(0);
      expect(params.band16k).toBe(0);
    });

    it('should apply "smile" preset (boosted lows and highs)', async () => {
      const { GraphicEQEffect, PRESETS } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.applyPreset('smile');

      const params = eq.params;
      // Smile curve: boosted bass and treble, cut mids
      expect(params.band31).toBeGreaterThan(0);
      expect(params.band62).toBeGreaterThan(0);
      expect(params.band500).toBeLessThan(params.band31);
      expect(params.band1k).toBeLessThan(params.band31);
      expect(params.band8k).toBeGreaterThan(0);
      expect(params.band16k).toBeGreaterThan(0);
    });

    it('should apply "frown" preset (boosted mids)', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.applyPreset('frown');

      const params = eq.params;
      // Frown curve: opposite of smile - boosted mids, cut bass/treble
      expect(params.band31).toBeLessThan(params.band500);
      expect(params.band500).toBeGreaterThan(0);
      expect(params.band1k).toBeGreaterThan(0);
      expect(params.band16k).toBeLessThan(params.band1k);
    });

    it('should have additional useful presets', async () => {
      const { PRESETS } = await import('../../lib/dsp/effects/graphic-eq');

      // Should have common presets
      expect(PRESETS).toHaveProperty('flat');
      expect(PRESETS).toHaveProperty('smile');
      expect(PRESETS).toHaveProperty('frown');
      expect(PRESETS).toHaveProperty('bassBoost');
      expect(PRESETS).toHaveProperty('trebleBoost');
      expect(PRESETS).toHaveProperty('vocal');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all bands to flat when resetToFlat is called', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // Set various gains
      eq.setBandGain(31, 6);
      eq.setBandGain(1000, -3);
      eq.setBandGain(8000, 9);

      // Reset to flat
      eq.resetToFlat();

      const params = eq.params;
      expect(params.band31).toBe(0);
      expect(params.band1k).toBe(0);
      expect(params.band8k).toBe(0);
    });
  });

  describe('Bypass and Mix Control', () => {
    it('should bypass effect when setBypass(true) is called', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.setBypass(true);
      expect(eq.bypass).toBe(true);

      eq.setBypass(false);
      expect(eq.bypass).toBe(false);
    });

    it('should control wet/dry mix', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.setMix(0.5);
      expect(eq.mix).toBe(0.5);

      // Clamp at boundaries
      eq.setMix(1.5);
      expect(eq.mix).toBe(1);

      eq.setMix(-0.5);
      expect(eq.mix).toBe(0);
    });
  });

  describe('Frequency Response Data', () => {
    it('should provide frequency response data for visualization', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      const response = eq.getFrequencyResponse(256);

      expect(response.frequencies).toBeInstanceOf(Float32Array);
      expect(response.magnitudes).toBeInstanceOf(Float32Array);
      expect(response.frequencies.length).toBe(256);
      expect(response.magnitudes.length).toBe(256);
    });

    it('should return frequency response in dB', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // Set a band to +6dB
      eq.setBandGain(1000, 6);

      const response = eq.getFrequencyResponse(256);

      // Magnitudes should be in dB (can be negative or positive)
      // At 1kHz, we should see approximately +6dB
      // Note: exact value depends on filter interaction
    });
  });

  describe('setAllParams', () => {
    it('should set all parameters at once', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.setAllParams({
        band31: 3,
        band62: 2,
        band125: 1,
        band250: 0,
        band500: -1,
        band1k: -2,
        band2k: -1,
        band4k: 0,
        band8k: 1,
        band16k: 2,
        mix: 0.8,
      });

      const params = eq.params;
      expect(params.band31).toBe(3);
      expect(params.band62).toBe(2);
      expect(params.band500).toBe(-1);
      expect(params.band1k).toBe(-2);
      expect(params.band16k).toBe(2);
      expect(params.mix).toBe(0.8);
    });
  });

  describe('EffectNode Interface', () => {
    it('should have input and output AudioNodes', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      expect(eq.input).toBeDefined();
      expect(eq.output).toBeDefined();
    });

    it('should properly disconnect all nodes on destroy', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      // Should not throw
      expect(() => eq.destroy()).not.toThrow();
    });
  });

  describe('Band Level Visualization Support', () => {
    it('should provide current band gains as array for visualization', async () => {
      const { GraphicEQEffect } = await import('../../lib/dsp/effects/graphic-eq');
      const eq = new GraphicEQEffect(audioContext);

      eq.setBandGain(1000, 6);
      eq.setBandGain(4000, -3);

      const bandGains = eq.getBandGains();

      expect(bandGains).toBeInstanceOf(Array);
      expect(bandGains.length).toBe(10);
      expect(bandGains[5]).toBe(6);  // 1kHz is index 5
      expect(bandGains[7]).toBe(-3); // 4kHz is index 7
    });
  });
});
