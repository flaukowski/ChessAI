import { describe, it, expect, beforeEach } from 'vitest';
import { DelayLine, limitValue } from '../../lib/dsp/delay-line';

describe('DelayLine', () => {
  let delayLine: DelayLine;
  const sampleRate = 48000;

  beforeEach(() => {
    delayLine = new DelayLine(sampleRate);
  });

  describe('initialization', () => {
    it('should create a delay line with default sample rate', () => {
      const defaultDelayLine = new DelayLine();
      expect(defaultDelayLine).toBeDefined();
      expect(defaultDelayLine.maxDelayMs).toBeGreaterThan(0);
    });

    it('should create a delay line with custom sample rate', () => {
      const customDelayLine = new DelayLine(44100);
      expect(customDelayLine).toBeDefined();
    });

    it('should create a delay line with custom max delay', () => {
      const maxSamples = 1024;
      const customDelayLine = new DelayLine(sampleRate, maxSamples);
      // Max delay should be maxSamples / sampleRate * 1000 ms
      const expectedMaxMs = (maxSamples / sampleRate) * 1000;
      expect(customDelayLine.maxDelayMs).toBeCloseTo(expectedMaxMs, 2);
    });

    it('should report correct max delay in milliseconds', () => {
      // Default size is 65536 samples
      const expectedMaxMs = (65536 / sampleRate) * 1000;
      expect(delayLine.maxDelayMs).toBeCloseTo(expectedMaxMs, 0);
    });
  });

  describe('write and read', () => {
    it('should delay signal by specified samples', () => {
      const delaySamples = 100;

      // Write zeros first, then an impulse, then more zeros
      for (let i = 0; i < delaySamples; i++) {
        delayLine.write(0);
      }
      delayLine.write(1.0); // Impulse at position delaySamples

      // Read at delay 0 should get the impulse we just wrote
      const output = delayLine.read(0);
      expect(output).toBeCloseTo(1.0, 5);
    });

    it('should return zero for delay beyond written samples', () => {
      // Write some samples
      for (let i = 0; i < 10; i++) {
        delayLine.write(1.0);
      }

      // Read at a very long delay (before any samples)
      const output = delayLine.read(1000);
      expect(output).toBe(0);
    });

    it('should handle circular buffer wrap-around', () => {
      // Write many samples to force wrap-around
      const numSamples = 70000; // More than buffer size

      for (let i = 0; i < numSamples; i++) {
        delayLine.write(Math.sin(2 * Math.PI * i / 100));
      }

      // Should still be able to read recent samples
      const output = delayLine.read(10);
      expect(output).not.toBeNaN();
      expect(Math.abs(output)).toBeLessThanOrEqual(1);
    });
  });

  describe('interpolation', () => {
    it('should interpolate between samples', () => {
      // Write a step function
      delayLine.write(0);
      delayLine.write(1);

      // Read at fractional delay - should interpolate
      const output = delayLine.read(0.5);

      // Should be between 0 and 1
      expect(output).toBeGreaterThan(0);
      expect(output).toBeLessThan(1);
    });

    it('should interpolate accurately', () => {
      // Write known values
      delayLine.clear();
      delayLine.write(0);
      delayLine.write(0);
      delayLine.write(0.5);
      delayLine.write(1.0);

      // Read at delay 0.5 (between last two samples: 0.5 and 1.0)
      const output = delayLine.read(0.5);

      // Linear interpolation: 1.0 + (0.5 - 1.0) * 0.5 = 0.75
      expect(output).toBeCloseTo(0.75, 5);
    });
  });

  describe('readMs', () => {
    it('should read with delay in milliseconds', () => {
      const delayMs = 10; // 10ms
      const delaySamples = (delayMs / 1000) * sampleRate;

      // Write an impulse
      delayLine.write(1.0);

      // Write zeros
      for (let i = 0; i < Math.ceil(delaySamples); i++) {
        delayLine.write(0);
      }

      // Read using ms - should get close to the impulse
      const output = delayLine.readMs(delayMs);
      expect(Math.abs(output)).toBeGreaterThan(0.5); // Close to impulse
    });
  });

  describe('clear', () => {
    it('should clear the buffer', () => {
      // Write some samples
      for (let i = 0; i < 100; i++) {
        delayLine.write(1.0);
      }

      delayLine.clear();

      // All reads should now be zero
      for (let delay = 1; delay < 100; delay++) {
        expect(delayLine.read(delay)).toBe(0);
      }
    });
  });

  describe('msToSamples', () => {
    it('should convert milliseconds to samples correctly', () => {
      expect(delayLine.msToSamples(1000)).toBe(sampleRate);
      expect(delayLine.msToSamples(100)).toBe(sampleRate / 10);
      expect(delayLine.msToSamples(0)).toBe(0);
    });
  });

  describe('echo effect simulation', () => {
    it('should store and retrieve delayed samples correctly', () => {
      // Clear the delay line
      delayLine.clear();

      // Write a sequence of known values
      const testValues = [0.1, 0.2, 0.3, 0.4, 0.5];
      for (const val of testValues) {
        delayLine.write(val);
      }

      // Read at delay 0 should give the last written value
      expect(delayLine.read(0)).toBeCloseTo(0.5, 5);

      // Read at delay 1 should give the second-to-last value
      expect(delayLine.read(1)).toBeCloseTo(0.4, 5);

      // Read at delay 2 should give the third-to-last value
      expect(delayLine.read(2)).toBeCloseTo(0.3, 5);
    });

    it('should maintain FIFO order for delayed samples', () => {
      delayLine.clear();

      // Write a known pattern
      for (let i = 0; i < 10; i++) {
        delayLine.write(i * 0.1);
      }

      // Verify we can read back in delay order (most recent first)
      for (let d = 0; d < 10; d++) {
        const expected = (9 - d) * 0.1; // Most recent is 0.9, oldest is 0.0
        expect(delayLine.read(d)).toBeCloseTo(expected, 5);
      }
    });
  });
});

describe('limitValue', () => {
  it('should pass through small values unchanged', () => {
    expect(limitValue(0)).toBe(0);
    expect(limitValue(0.5)).toBeCloseTo(0.5, 1);
    expect(limitValue(-0.5)).toBeCloseTo(-0.5, 1);
  });

  it('should limit values approaching 2', () => {
    const limited = limitValue(1.5);
    expect(limited).toBeLessThan(1.5);
    expect(limited).toBeGreaterThan(0);
  });

  it('should limit values approaching -2', () => {
    const limited = limitValue(-1.5);
    expect(limited).toBeGreaterThan(-1.5);
    expect(limited).toBeLessThan(0);
  });

  it('should provide soft limiting at boundaries', () => {
    // At x=1, should still be close to 1
    expect(limitValue(1)).toBeCloseTo(0.83, 1);

    // At x=2, should be limited
    const atTwo = limitValue(2);
    expect(atTwo).toBeLessThan(2);
    expect(atTwo).toBeGreaterThan(0);
  });

  it('should be symmetric', () => {
    const values = [0.5, 1.0, 1.5, 2.0];

    for (const v of values) {
      expect(limitValue(v)).toBeCloseTo(-limitValue(-v), 10);
    }
  });

  it('should be monotonic in the useful range', () => {
    let prev = limitValue(0);

    for (let x = 0.1; x < 1.8; x += 0.1) {
      const current = limitValue(x);
      expect(current).toBeGreaterThan(prev);
      prev = current;
    }
  });
});
