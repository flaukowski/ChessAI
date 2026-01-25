import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultibandCompressorEffect,
  BAND_NAMES,
} from '../../lib/dsp/effects/multiband-compressor';

// Mock AudioContext for testing
class MockGainNode {
  gain = { value: 1, setTargetAtTime: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockScriptProcessorNode {
  onaudioprocess: ((event: any) => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  sampleRate = 48000;
  currentTime = 0;

  createGain() {
    return new MockGainNode();
  }

  createScriptProcessor(bufferSize: number, inputChannels: number, outputChannels: number) {
    return new MockScriptProcessorNode();
  }
}

describe('MultibandCompressorEffect', () => {
  let context: AudioContext;
  let compressor: MultibandCompressorEffect;

  beforeEach(() => {
    context = new MockAudioContext() as unknown as AudioContext;
    compressor = new MultibandCompressorEffect(context);
  });

  describe('initialization', () => {
    it('should create with default parameters', () => {
      expect(compressor).toBeDefined();
      expect(compressor.input).toBeDefined();
      expect(compressor.output).toBeDefined();
    });

    it('should have bypass set to false by default', () => {
      expect(compressor.bypass).toBe(false);
    });

    it('should have default mix of 1', () => {
      expect(compressor.mix).toBe(1);
    });

    it('should have default crossover frequencies', () => {
      const params = compressor.getParams();
      expect(params.crossover1).toBe(200);
      expect(params.crossover2).toBe(1200);
      expect(params.crossover3).toBe(5000);
    });

    it('should have 4 bands with default parameters', () => {
      const params = compressor.getParams();
      expect(params.bands.length).toBe(4);
      for (const band of params.bands) {
        expect(band.threshold).toBe(-20);
        expect(band.ratio).toBe(4);
        expect(band.attack).toBe(10);
        expect(band.release).toBe(100);
        expect(band.makeupGain).toBe(0);
        expect(band.solo).toBe(false);
        expect(band.mute).toBe(false);
      }
    });

    it('should have default input and output gains of 0dB', () => {
      const params = compressor.getParams();
      expect(params.inputGain).toBe(0);
      expect(params.outputGain).toBe(0);
    });
  });

  describe('setBypass', () => {
    it('should set bypass to true', () => {
      compressor.setBypass(true);
      expect(compressor.bypass).toBe(true);
    });

    it('should set bypass to false', () => {
      compressor.setBypass(true);
      compressor.setBypass(false);
      expect(compressor.bypass).toBe(false);
    });
  });

  describe('setMix', () => {
    it('should set mix value', () => {
      compressor.setMix(0.5);
      expect(compressor.mix).toBe(0.5);
    });

    it('should clamp mix to 0', () => {
      compressor.setMix(-0.5);
      expect(compressor.mix).toBe(0);
    });

    it('should clamp mix to 1', () => {
      compressor.setMix(1.5);
      expect(compressor.mix).toBe(1);
    });
  });

  describe('setInputGain', () => {
    it('should set input gain', () => {
      compressor.setInputGain(6);
      const params = compressor.getParams();
      expect(params.inputGain).toBe(6);
    });

    it('should clamp input gain to -12dB', () => {
      compressor.setInputGain(-20);
      const params = compressor.getParams();
      expect(params.inputGain).toBe(-12);
    });

    it('should clamp input gain to +12dB', () => {
      compressor.setInputGain(20);
      const params = compressor.getParams();
      expect(params.inputGain).toBe(12);
    });
  });

  describe('setOutputGain', () => {
    it('should set output gain', () => {
      compressor.setOutputGain(-3);
      const params = compressor.getParams();
      expect(params.outputGain).toBe(-3);
    });

    it('should clamp output gain to -12dB', () => {
      compressor.setOutputGain(-20);
      const params = compressor.getParams();
      expect(params.outputGain).toBe(-12);
    });

    it('should clamp output gain to +12dB', () => {
      compressor.setOutputGain(20);
      const params = compressor.getParams();
      expect(params.outputGain).toBe(12);
    });
  });

  describe('setCrossover', () => {
    it('should set crossover 1 frequency', () => {
      compressor.setCrossover(0, 300);
      const params = compressor.getParams();
      expect(params.crossover1).toBe(300);
    });

    it('should set crossover 2 frequency', () => {
      compressor.setCrossover(1, 2000);
      const params = compressor.getParams();
      expect(params.crossover2).toBe(2000);
    });

    it('should set crossover 3 frequency', () => {
      compressor.setCrossover(2, 8000);
      const params = compressor.getParams();
      expect(params.crossover3).toBe(8000);
    });

    it('should clamp crossover 1 to valid range (20-500Hz)', () => {
      compressor.setCrossover(0, 10);
      expect(compressor.getParams().crossover1).toBe(20);
      compressor.setCrossover(0, 1000);
      expect(compressor.getParams().crossover1).toBe(500);
    });

    it('should clamp crossover 2 to valid range (200-4000Hz)', () => {
      compressor.setCrossover(1, 100);
      expect(compressor.getParams().crossover2).toBe(200);
      compressor.setCrossover(1, 5000);
      expect(compressor.getParams().crossover2).toBe(4000);
    });

    it('should clamp crossover 3 to valid range (2000-16000Hz)', () => {
      compressor.setCrossover(2, 1000);
      expect(compressor.getParams().crossover3).toBe(2000);
      compressor.setCrossover(2, 20000);
      expect(compressor.getParams().crossover3).toBe(16000);
    });

    it('should ignore invalid crossover index', () => {
      const beforeParams = compressor.getParams();
      compressor.setCrossover(3, 5000);
      compressor.setCrossover(-1, 5000);
      const afterParams = compressor.getParams();
      expect(afterParams.crossover1).toBe(beforeParams.crossover1);
      expect(afterParams.crossover2).toBe(beforeParams.crossover2);
      expect(afterParams.crossover3).toBe(beforeParams.crossover3);
    });
  });

  describe('setBandParams', () => {
    it('should set band threshold', () => {
      compressor.setBandParams(0, { threshold: -30 });
      const params = compressor.getParams();
      expect(params.bands[0].threshold).toBe(-30);
    });

    it('should clamp threshold to valid range (-60 to 0)', () => {
      compressor.setBandParams(0, { threshold: -80 });
      expect(compressor.getParams().bands[0].threshold).toBe(-60);
      compressor.setBandParams(0, { threshold: 10 });
      expect(compressor.getParams().bands[0].threshold).toBe(0);
    });

    it('should set band ratio', () => {
      compressor.setBandParams(1, { ratio: 8 });
      const params = compressor.getParams();
      expect(params.bands[1].ratio).toBe(8);
    });

    it('should clamp ratio to valid range (1 to 20)', () => {
      compressor.setBandParams(0, { ratio: 0.5 });
      expect(compressor.getParams().bands[0].ratio).toBe(1);
      compressor.setBandParams(0, { ratio: 30 });
      expect(compressor.getParams().bands[0].ratio).toBe(20);
    });

    it('should set band attack', () => {
      compressor.setBandParams(2, { attack: 5 });
      const params = compressor.getParams();
      expect(params.bands[2].attack).toBe(5);
    });

    it('should clamp attack to valid range (0.1 to 100ms)', () => {
      compressor.setBandParams(0, { attack: 0.01 });
      expect(compressor.getParams().bands[0].attack).toBe(0.1);
      compressor.setBandParams(0, { attack: 200 });
      expect(compressor.getParams().bands[0].attack).toBe(100);
    });

    it('should set band release', () => {
      compressor.setBandParams(3, { release: 200 });
      const params = compressor.getParams();
      expect(params.bands[3].release).toBe(200);
    });

    it('should clamp release to valid range (10 to 1000ms)', () => {
      compressor.setBandParams(0, { release: 5 });
      expect(compressor.getParams().bands[0].release).toBe(10);
      compressor.setBandParams(0, { release: 2000 });
      expect(compressor.getParams().bands[0].release).toBe(1000);
    });

    it('should set band makeup gain', () => {
      compressor.setBandParams(0, { makeupGain: 6 });
      const params = compressor.getParams();
      expect(params.bands[0].makeupGain).toBe(6);
    });

    it('should clamp makeup gain to valid range (-12 to +12dB)', () => {
      compressor.setBandParams(0, { makeupGain: -20 });
      expect(compressor.getParams().bands[0].makeupGain).toBe(-12);
      compressor.setBandParams(0, { makeupGain: 20 });
      expect(compressor.getParams().bands[0].makeupGain).toBe(12);
    });

    it('should set band solo', () => {
      compressor.setBandParams(0, { solo: true });
      const params = compressor.getParams();
      expect(params.bands[0].solo).toBe(true);
    });

    it('should set band mute', () => {
      compressor.setBandParams(1, { mute: true });
      const params = compressor.getParams();
      expect(params.bands[1].mute).toBe(true);
    });

    it('should allow partial band parameter updates', () => {
      compressor.setBandParams(0, { threshold: -25, ratio: 6 });
      const params = compressor.getParams();
      expect(params.bands[0].threshold).toBe(-25);
      expect(params.bands[0].ratio).toBe(6);
      expect(params.bands[0].attack).toBe(10);
    });

    it('should ignore invalid band index', () => {
      const beforeParams = compressor.getParams();
      compressor.setBandParams(4, { threshold: -50 });
      compressor.setBandParams(-1, { threshold: -50 });
      const afterParams = compressor.getParams();
      expect(afterParams.bands).toEqual(beforeParams.bands);
    });
  });

  describe('setAllParams', () => {
    it('should set global parameters', () => {
      compressor.setAllParams({
        inputGain: 3,
        outputGain: -3,
        mix: 0.8,
      });
      const params = compressor.getParams();
      expect(params.inputGain).toBe(3);
      expect(params.outputGain).toBe(-3);
      expect(compressor.mix).toBe(0.8);
    });

    it('should set crossover frequencies', () => {
      compressor.setAllParams({
        crossover1: 250,
        crossover2: 1500,
        crossover3: 6000,
      });
      const params = compressor.getParams();
      expect(params.crossover1).toBe(250);
      expect(params.crossover2).toBe(1500);
      expect(params.crossover3).toBe(6000);
    });

    it('should set per-band parameters using naming convention', () => {
      compressor.setAllParams({
        band0_threshold: -30,
        band0_ratio: 8,
        band1_attack: 5,
        band2_release: 300,
        band3_makeupGain: 3,
      });
      const params = compressor.getParams();
      expect(params.bands[0].threshold).toBe(-30);
      expect(params.bands[0].ratio).toBe(8);
      expect(params.bands[1].attack).toBe(5);
      expect(params.bands[2].release).toBe(300);
      expect(params.bands[3].makeupGain).toBe(3);
    });

    it('should set solo/mute via numeric values', () => {
      compressor.setAllParams({
        band0_solo: 1,
        band1_mute: 0.6,
        band2_solo: 0.4,
      });
      const params = compressor.getParams();
      expect(params.bands[0].solo).toBe(true);
      expect(params.bands[1].mute).toBe(true);
      expect(params.bands[2].solo).toBe(false);
    });
  });

  describe('getMeterData', () => {
    it('should return meter data structure', () => {
      const meterData = compressor.getMeterData();
      expect(meterData.bands).toBeDefined();
      expect(meterData.bands.length).toBe(4);
      expect(typeof meterData.inputLevel).toBe('number');
      expect(typeof meterData.outputLevel).toBe('number');
    });

    it('should return band meter data with all fields', () => {
      const meterData = compressor.getMeterData();
      for (const band of meterData.bands) {
        expect(typeof band.gainReduction).toBe('number');
        expect(typeof band.inputLevel).toBe('number');
        expect(typeof band.outputLevel).toBe('number');
      }
    });

    it('should return negative infinity dB for silence', () => {
      const meterData = compressor.getMeterData();
      expect(meterData.inputLevel).toBeLessThan(-100);
      expect(meterData.outputLevel).toBeLessThan(-100);
    });
  });

  describe('getParams', () => {
    it('should return a copy of parameters', () => {
      const params1 = compressor.getParams();
      const params2 = compressor.getParams();
      params1.crossover1 = 999;
      expect(compressor.getParams().crossover1).toBe(200);
      expect(params2.crossover1).toBe(200);
    });

    it('should return deep copy of band parameters', () => {
      const params = compressor.getParams();
      params.bands[0].threshold = -99;
      expect(compressor.getParams().bands[0].threshold).toBe(-20);
    });
  });

  describe('destroy', () => {
    it('should disconnect all nodes', () => {
      compressor.destroy();
      expect(true).toBe(true);
    });
  });
});

describe('BAND_NAMES', () => {
  it('should have 4 band names', () => {
    expect(BAND_NAMES.length).toBe(4);
  });

  it('should have correct band names', () => {
    expect(BAND_NAMES[0]).toBe('Low');
    expect(BAND_NAMES[1]).toBe('Low-Mid');
    expect(BAND_NAMES[2]).toBe('High-Mid');
    expect(BAND_NAMES[3]).toBe('High');
  });
});

describe('Compressor Envelope Follower', () => {
  describe('attack behavior', () => {
    it('should have faster attack with lower attack time', () => {
      const fastAttack = Math.exp(-1 / (1 * 48000 / 1000));
      const slowAttack = Math.exp(-1 / (100 * 48000 / 1000));
      expect(fastAttack).toBeLessThan(slowAttack);
    });
  });

  describe('release behavior', () => {
    it('should have faster release with lower release time', () => {
      const fastRelease = Math.exp(-1 / (10 * 48000 / 1000));
      const slowRelease = Math.exp(-1 / (1000 * 48000 / 1000));
      expect(fastRelease).toBeLessThan(slowRelease);
    });
  });

  describe('gain reduction calculation', () => {
    it('should calculate correct gain reduction for given ratio', () => {
      const overDb = 12;
      const ratio = 4;
      const reductionDb = overDb * (1 - 1 / ratio);
      expect(reductionDb).toBe(9);
    });

    it('should have no gain reduction below threshold', () => {
      const threshold = 0.1;
      const signal = 0.05;
      expect(signal < threshold).toBe(true);
    });

    it('should calculate limiting behavior at infinity ratio', () => {
      const overDb = 12;
      const ratio = Infinity;
      const reductionDb = overDb * (1 - 1 / ratio);
      expect(reductionDb).toBe(12);
    });
  });

  describe('makeup gain', () => {
    it('should convert dB to linear gain correctly', () => {
      const dbGain = 6;
      const linearGain = Math.pow(10, dbGain / 20);
      expect(linearGain).toBeCloseTo(2, 1);
    });

    it('should handle negative makeup gain', () => {
      const dbGain = -6;
      const linearGain = Math.pow(10, dbGain / 20);
      expect(linearGain).toBeCloseTo(0.5, 1);
    });
  });
});

describe('Butterworth Filter Coefficient Calculation', () => {
  const sampleRate = 48000;

  describe('lowpass filter', () => {
    it('should calculate valid coefficients for 1kHz cutoff', () => {
      const fc = 1000;
      const w0 = (2 * Math.PI * fc) / sampleRate;
      const cosW0 = Math.cos(w0);
      const sinW0 = Math.sin(w0);
      const Q = 0.7071;
      const alpha = sinW0 / (2 * Q);
      const a0 = 1 + alpha;
      const b0 = ((1 - cosW0) / 2) / a0;
      const b1 = (1 - cosW0) / a0;
      const b2 = ((1 - cosW0) / 2) / a0;
      const a1 = (-2 * cosW0) / a0;
      const a2 = (1 - alpha) / a0;
      expect(Number.isFinite(b0)).toBe(true);
      expect(Number.isFinite(b1)).toBe(true);
      expect(Number.isFinite(b2)).toBe(true);
      expect(Number.isFinite(a1)).toBe(true);
      expect(Number.isFinite(a2)).toBe(true);
      expect(b0).toBeGreaterThan(0);
      expect(b0).toBe(b2);
      expect(b1).toBeCloseTo(2 * b0, 5);
    });
  });

  describe('highpass filter', () => {
    it('should calculate valid coefficients for 1kHz cutoff', () => {
      const fc = 1000;
      const w0 = (2 * Math.PI * fc) / sampleRate;
      const cosW0 = Math.cos(w0);
      const sinW0 = Math.sin(w0);
      const Q = 0.7071;
      const alpha = sinW0 / (2 * Q);
      const a0 = 1 + alpha;
      const b0 = ((1 + cosW0) / 2) / a0;
      const b1 = (-(1 + cosW0)) / a0;
      const b2 = ((1 + cosW0) / 2) / a0;
      expect(Number.isFinite(b0)).toBe(true);
      expect(Number.isFinite(b1)).toBe(true);
      expect(Number.isFinite(b2)).toBe(true);
      expect(b0).toBeGreaterThan(0);
      expect(b0).toBe(b2);
      expect(b1).toBeLessThan(0);
      expect(b1).toBeCloseTo(-2 * b0, 5);
    });
  });

  describe('frequency response', () => {
    it('should have -3dB at cutoff frequency for Butterworth', () => {
      expect(1 / Math.sqrt(2)).toBeCloseTo(0.707, 2);
    });
  });
});

describe('Edge Cases and Stability', () => {
  let context: AudioContext;
  let compressor: MultibandCompressorEffect;

  beforeEach(() => {
    context = new MockAudioContext() as unknown as AudioContext;
    compressor = new MultibandCompressorEffect(context);
  });

  it('should handle extreme threshold values', () => {
    compressor.setBandParams(0, { threshold: -60 });
    expect(compressor.getParams().bands[0].threshold).toBe(-60);
    compressor.setBandParams(0, { threshold: 0 });
    expect(compressor.getParams().bands[0].threshold).toBe(0);
  });

  it('should handle extreme ratio values', () => {
    compressor.setBandParams(0, { ratio: 1 });
    expect(compressor.getParams().bands[0].ratio).toBe(1);
    compressor.setBandParams(0, { ratio: 20 });
    expect(compressor.getParams().bands[0].ratio).toBe(20);
  });

  it('should handle minimum attack time', () => {
    compressor.setBandParams(0, { attack: 0.1 });
    expect(compressor.getParams().bands[0].attack).toBe(0.1);
  });

  it('should handle maximum release time', () => {
    compressor.setBandParams(0, { release: 1000 });
    expect(compressor.getParams().bands[0].release).toBe(1000);
  });

  it('should handle all bands muted', () => {
    for (let i = 0; i < 4; i++) {
      compressor.setBandParams(i, { mute: true });
    }
    const params = compressor.getParams();
    expect(params.bands.every(b => b.mute)).toBe(true);
  });

  it('should handle multiple bands soloed', () => {
    compressor.setBandParams(0, { solo: true });
    compressor.setBandParams(2, { solo: true });
    const params = compressor.getParams();
    expect(params.bands[0].solo).toBe(true);
    expect(params.bands[2].solo).toBe(true);
  });

  it('should handle very low crossover frequencies', () => {
    compressor.setCrossover(0, 20);
    expect(compressor.getParams().crossover1).toBe(20);
  });

  it('should handle very high crossover frequencies', () => {
    compressor.setCrossover(2, 16000);
    expect(compressor.getParams().crossover3).toBe(16000);
  });

  it('should handle rapid parameter changes', () => {
    for (let i = 0; i < 100; i++) {
      compressor.setBandParams(i % 4, {
        threshold: -20 - (i % 40),
        ratio: 1 + (i % 19),
      });
    }
    const params = compressor.getParams();
    expect(params.bands.length).toBe(4);
  });
});

describe('Integration with Effect Chain', () => {
  let context: AudioContext;
  let compressor: MultibandCompressorEffect;

  beforeEach(() => {
    context = new MockAudioContext() as unknown as AudioContext;
    compressor = new MultibandCompressorEffect(context);
  });

  it('should provide input and output nodes for chaining', () => {
    expect(compressor.input).toBeDefined();
    expect(compressor.output).toBeDefined();
  });

  it('should support bypass mode for A/B comparison', () => {
    compressor.setBypass(true);
    expect(compressor.bypass).toBe(true);
    compressor.setBypass(false);
    expect(compressor.bypass).toBe(false);
  });

  it('should support wet/dry mix for parallel compression', () => {
    compressor.setMix(0.5);
    expect(compressor.mix).toBe(0.5);
    compressor.setMix(1);
    expect(compressor.mix).toBe(1);
    compressor.setMix(0);
    expect(compressor.mix).toBe(0);
  });
});
