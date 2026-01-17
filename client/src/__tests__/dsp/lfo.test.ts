import { describe, it, expect, beforeEach } from 'vitest';
import { LFO } from '../../lib/dsp/lfo';

describe('LFO (Low Frequency Oscillator)', () => {
  let lfo: LFO;
  const sampleRate = 48000;

  beforeEach(() => {
    lfo = new LFO(sampleRate);
  });

  describe('initialization', () => {
    it('should create an LFO with default sample rate', () => {
      const defaultLfo = new LFO();
      expect(defaultLfo).toBeDefined();
    });

    it('should create an LFO with custom sample rate', () => {
      const customLfo = new LFO(44100);
      expect(customLfo).toBeDefined();
    });
  });

  describe('setFrequency', () => {
    it('should set frequency and produce correct period', () => {
      lfo.setFrequency(1); // 1 Hz - one cycle per second
      lfo.reset();

      // Sample for one second
      const samples: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        samples.push(lfo.tick('sine'));
      }

      // Find zero crossings (positive to negative transitions)
      let zeroCrossings = 0;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] >= 0 && samples[i] < 0) {
          zeroCrossings++;
        }
      }

      // For 1 Hz, we should have approximately 1 full cycle (1 zero crossing from + to -)
      expect(zeroCrossings).toBeGreaterThanOrEqual(1);
      expect(zeroCrossings).toBeLessThanOrEqual(2);
    });

    it('should produce higher frequency with larger value', () => {
      // Test 10 Hz
      lfo.setFrequency(10);
      lfo.reset();

      const samples: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        samples.push(lfo.tick('sine'));
      }

      let zeroCrossings = 0;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] >= 0 && samples[i] < 0) {
          zeroCrossings++;
        }
      }

      // For 10 Hz, should have approximately 10 cycles
      expect(zeroCrossings).toBeGreaterThanOrEqual(9);
      expect(zeroCrossings).toBeLessThanOrEqual(11);
    });
  });

  describe('setMs', () => {
    it('should set period in milliseconds', () => {
      lfo.setMs(1000); // 1 second period = 1 Hz
      lfo.reset();

      const samples: number[] = [];
      for (let i = 0; i < sampleRate; i++) {
        samples.push(lfo.tick('sine'));
      }

      let zeroCrossings = 0;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] >= 0 && samples[i] < 0) {
          zeroCrossings++;
        }
      }

      expect(zeroCrossings).toBeGreaterThanOrEqual(1);
      expect(zeroCrossings).toBeLessThanOrEqual(2);
    });

    it('should clamp very small ms values', () => {
      // Should clamp to 0.1ms minimum (10kHz max)
      lfo.setMs(0.01);
      lfo.reset();

      // Should still produce valid output
      const output = lfo.tick('sine');
      expect(output).toBeGreaterThanOrEqual(-1);
      expect(output).toBeLessThanOrEqual(1);
    });
  });

  describe('sine waveform', () => {
    it('should produce values between -1 and 1', () => {
      lfo.setFrequency(100);
      lfo.reset();

      for (let i = 0; i < 1000; i++) {
        const value = lfo.tick('sine');
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should produce smooth transitions', () => {
      lfo.setFrequency(10);
      lfo.reset();

      let prevValue = lfo.tick('sine');
      let maxDelta = 0;

      for (let i = 0; i < 4800; i++) {
        const value = lfo.tick('sine');
        const delta = Math.abs(value - prevValue);
        maxDelta = Math.max(maxDelta, delta);
        prevValue = value;
      }

      // Sine wave should have smooth transitions
      // At 10 Hz with 48000 sample rate, max delta should be small
      expect(maxDelta).toBeLessThan(0.01);
    });

    it('should start at zero after reset', () => {
      lfo.setFrequency(1);

      // Tick several times
      for (let i = 0; i < 100; i++) {
        lfo.tick('sine');
      }

      lfo.reset();
      const firstValue = lfo.tick('sine');

      // After reset, should start near zero
      expect(Math.abs(firstValue)).toBeLessThan(0.1);
    });
  });

  describe('triangle waveform', () => {
    it('should produce values between -1 and 1', () => {
      lfo.setFrequency(100);
      lfo.reset();

      for (let i = 0; i < 1000; i++) {
        const value = lfo.tick('triangle');
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should have linear segments', () => {
      lfo.setFrequency(1);
      lfo.reset();

      // Sample a quarter of the cycle
      const quarterCycleSamples = Math.floor(sampleRate / 4);
      const samples: number[] = [];

      for (let i = 0; i < quarterCycleSamples; i++) {
        samples.push(lfo.tick('triangle'));
      }

      // In a quarter cycle of triangle, values should increase linearly
      // Check that the rate of change is roughly constant
      const deltas: number[] = [];
      for (let i = 1; i < samples.length; i++) {
        deltas.push(samples[i] - samples[i - 1]);
      }

      // All deltas should be similar (linear)
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      for (const delta of deltas) {
        expect(Math.abs(delta - avgDelta)).toBeLessThan(0.0001);
      }
    });
  });

  describe('sawtooth waveform', () => {
    it('should produce values between 0 and 1', () => {
      lfo.setFrequency(100);
      lfo.reset();

      for (let i = 0; i < 1000; i++) {
        const value = lfo.tick('sawtooth');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should ramp up linearly', () => {
      lfo.setFrequency(1);
      lfo.reset();

      let prevValue = 0;
      let rampingUp = true;

      for (let i = 0; i < sampleRate / 2; i++) {
        const value = lfo.tick('sawtooth');
        if (value < prevValue - 0.5) {
          // Detected wrap-around
          rampingUp = false;
          break;
        }
        prevValue = value;
      }

      // Should have been ramping up
      expect(rampingUp).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset the LFO phase', () => {
      lfo.setFrequency(1);

      // Advance the LFO
      for (let i = 0; i < 10000; i++) {
        lfo.tick('sine');
      }

      const valueBeforeReset = lfo.tick('sine');

      lfo.reset();

      const valueAfterReset = lfo.tick('sine');

      // Values should be different (reset changes phase)
      expect(Math.abs(valueBeforeReset - valueAfterReset)).toBeGreaterThan(0.01);
    });
  });
});
