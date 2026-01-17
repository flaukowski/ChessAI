import { describe, it, expect, beforeEach } from 'vitest';
import { BiquadFilter, BiquadFilterDF1 } from '../../lib/dsp/biquad';

describe('BiquadFilter (Direct Form II Transposed)', () => {
  let filter: BiquadFilter;
  const sampleRate = 48000;

  beforeEach(() => {
    filter = new BiquadFilter(sampleRate);
  });

  describe('initialization', () => {
    it('should create a filter with default sample rate', () => {
      const defaultFilter = new BiquadFilter();
      const coeffs = defaultFilter.getCoefficients();
      expect(coeffs.b0).toBe(1);
      expect(coeffs.b1).toBe(0);
      expect(coeffs.b2).toBe(0);
      expect(coeffs.a1).toBe(0);
      expect(coeffs.a2).toBe(0);
    });

    it('should create a filter with custom sample rate', () => {
      const customFilter = new BiquadFilter(44100);
      expect(customFilter).toBeDefined();
    });
  });

  describe('lowpass filter', () => {
    it('should set lowpass coefficients', () => {
      filter.setLowpass(1000, 0.707);
      const coeffs = filter.getCoefficients();

      expect(coeffs.b0).toBeGreaterThan(0);
      expect(coeffs.b1).toBeGreaterThan(0);
      expect(coeffs.b2).toBeGreaterThan(0);
      // For a lowpass, b0 = b2 and b1 = 2*b0
      expect(Math.abs(coeffs.b0 - coeffs.b2)).toBeLessThan(0.0001);
    });

    it('should attenuate high frequencies', () => {
      filter.setLowpass(1000, 0.707);
      filter.reset();

      // Generate a high frequency signal (10kHz - well above cutoff)
      const numSamples = 480; // 10ms at 48kHz
      const highFreq = 10000;
      let maxInput = 0;
      let maxOutput = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * highFreq * i / sampleRate);
        const output = filter.process(input);
        maxInput = Math.max(maxInput, Math.abs(input));
        // Skip first few samples (transient)
        if (i > 100) {
          maxOutput = Math.max(maxOutput, Math.abs(output));
        }
      }

      // Output should be significantly attenuated
      expect(maxOutput).toBeLessThan(maxInput * 0.5);
    });

    it('should pass low frequencies with minimal attenuation', () => {
      filter.setLowpass(5000, 0.707);
      filter.reset();

      // Generate a low frequency signal (100Hz - well below cutoff)
      const numSamples = 4800; // 100ms at 48kHz for full cycles
      const lowFreq = 100;
      let totalInputPower = 0;
      let totalOutputPower = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * lowFreq * i / sampleRate);
        const output = filter.process(input);
        // Skip transient
        if (i > 1000) {
          totalInputPower += input * input;
          totalOutputPower += output * output;
        }
      }

      // Output power should be close to input power (within 3dB)
      const ratio = totalOutputPower / totalInputPower;
      expect(ratio).toBeGreaterThan(0.7); // -1.5dB tolerance
    });
  });

  describe('highpass filter', () => {
    it('should set highpass coefficients', () => {
      filter.setHighpass(1000, 0.707);
      const coeffs = filter.getCoefficients();

      expect(coeffs.b0).toBeGreaterThan(0);
      expect(coeffs.b1).toBeLessThan(0); // Negative for highpass
      expect(coeffs.b2).toBeGreaterThan(0);
    });

    it('should attenuate low frequencies', () => {
      filter.setHighpass(1000, 0.707);
      filter.reset();

      // Generate a low frequency signal (100Hz - well below cutoff)
      const numSamples = 4800;
      const lowFreq = 100;
      let maxInput = 0;
      let maxOutput = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * lowFreq * i / sampleRate);
        const output = filter.process(input);
        maxInput = Math.max(maxInput, Math.abs(input));
        if (i > 1000) {
          maxOutput = Math.max(maxOutput, Math.abs(output));
        }
      }

      expect(maxOutput).toBeLessThan(maxInput * 0.5);
    });
  });

  describe('bandpass filter', () => {
    it('should set bandpass coefficients', () => {
      filter.setBandpass(1000, 1);
      const coeffs = filter.getCoefficients();

      expect(coeffs.b0).toBeGreaterThan(0);
      expect(coeffs.b1).toBe(0); // Zero for bandpass
      expect(coeffs.b2).toBeLessThan(0);
    });

    it('should attenuate frequencies outside the passband', () => {
      filter.setBandpass(1000, 2); // Center at 1kHz, Q=2
      filter.reset();

      // Test low frequency (100Hz)
      let maxOutputLow = 0;
      for (let i = 0; i < 4800; i++) {
        const input = Math.sin(2 * Math.PI * 100 * i / sampleRate);
        const output = filter.process(input);
        if (i > 1000) maxOutputLow = Math.max(maxOutputLow, Math.abs(output));
      }

      filter.reset();

      // Test high frequency (10kHz)
      let maxOutputHigh = 0;
      for (let i = 0; i < 480; i++) {
        const input = Math.sin(2 * Math.PI * 10000 * i / sampleRate);
        const output = filter.process(input);
        if (i > 100) maxOutputHigh = Math.max(maxOutputHigh, Math.abs(output));
      }

      // Both should be attenuated
      expect(maxOutputLow).toBeLessThan(0.5);
      expect(maxOutputHigh).toBeLessThan(0.5);
    });
  });

  describe('notch filter', () => {
    it('should set notch coefficients', () => {
      filter.setNotch(1000, 1);
      const coeffs = filter.getCoefficients();

      expect(coeffs.b0).toBeGreaterThan(0);
      expect(coeffs.b2).toBeGreaterThan(0);
      // For a notch, b0 = b2
      expect(Math.abs(coeffs.b0 - coeffs.b2)).toBeLessThan(0.0001);
    });
  });

  describe('allpass filter', () => {
    it('should set allpass coefficients', () => {
      filter.setAllpass(1000, 0.707);
      const coeffs = filter.getCoefficients();

      expect(coeffs).toBeDefined();
      // Allpass should have specific relationship between coefficients
    });

    it('should maintain unity gain at all frequencies', () => {
      filter.setAllpass(1000, 0.707);
      filter.reset();

      // Test various frequencies
      const frequencies = [100, 500, 1000, 2000, 5000];

      for (const freq of frequencies) {
        filter.reset();
        let totalPower = 0;
        const numSamples = 4800;

        for (let i = 0; i < numSamples; i++) {
          const output = filter.process(Math.sin(2 * Math.PI * freq * i / sampleRate));
          if (i > 1000) {
            totalPower += output * output;
          }
        }

        const avgPower = totalPower / (numSamples - 1000);
        // RMS should be close to 1/sqrt(2) ≈ 0.707 for a sine wave
        const rms = Math.sqrt(avgPower);
        expect(rms).toBeGreaterThan(0.5);
        expect(rms).toBeLessThan(0.9);
      }
    });
  });

  describe('block processing', () => {
    it('should process a block of samples correctly', () => {
      filter.setLowpass(1000, 0.707);

      const input = new Float32Array(256);
      const output = new Float32Array(256);

      // Fill input with impulse
      input[0] = 1.0;

      filter.processBlock(input, output);

      // First sample should be non-zero (impulse response)
      expect(output[0]).not.toBe(0);

      // Verify block processing matches sample-by-sample
      filter.reset();
      filter.setLowpass(1000, 0.707);

      for (let i = 0; i < input.length; i++) {
        const sample = filter.process(input[i]);
        expect(Math.abs(sample - output[i])).toBeLessThan(0.0001);
      }
    });
  });

  describe('reset', () => {
    it('should clear filter state', () => {
      filter.setLowpass(1000, 0.707);

      // Process some samples
      for (let i = 0; i < 100; i++) {
        filter.process(1.0);
      }

      filter.reset();

      // After reset, DC input should start fresh
      const output = filter.process(0);
      expect(output).toBe(0);
    });
  });
});

describe('BiquadFilterDF1 (Direct Form I)', () => {
  let filter: BiquadFilterDF1;
  const sampleRate = 48000;

  beforeEach(() => {
    filter = new BiquadFilterDF1(sampleRate);
  });

  describe('peaking EQ filter', () => {
    it('should boost at center frequency', () => {
      filter.setPeaking(1000, 6, 1); // +6dB boost at 1kHz
      filter.reset();

      // Generate signal at center frequency
      const numSamples = 4800;
      let totalInputPower = 0;
      let totalOutputPower = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
        const output = filter.process(input);
        if (i > 1000) {
          totalInputPower += input * input;
          totalOutputPower += output * output;
        }
      }

      // Output should be boosted (approximately 2x for 6dB)
      const ratio = totalOutputPower / totalInputPower;
      expect(ratio).toBeGreaterThan(1.5); // At least some boost
    });

    it('should cut at center frequency with negative gain', () => {
      filter.setPeaking(1000, -6, 1); // -6dB cut at 1kHz
      filter.reset();

      const numSamples = 4800;
      let totalInputPower = 0;
      let totalOutputPower = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
        const output = filter.process(input);
        if (i > 1000) {
          totalInputPower += input * input;
          totalOutputPower += output * output;
        }
      }

      const ratio = totalOutputPower / totalInputPower;
      expect(ratio).toBeLessThan(0.7); // At least some cut
    });
  });

  describe('low shelf filter', () => {
    it('should boost low frequencies', () => {
      filter.setLowShelf(200, 6, 0.9);
      filter.reset();

      // Test at 50Hz (below shelf)
      const numSamples = 9600; // Need longer for low freq
      let totalOutputPower = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * 50 * i / sampleRate);
        const output = filter.process(input);
        if (i > 2000) {
          totalOutputPower += output * output;
        }
      }

      const avgPower = totalOutputPower / (numSamples - 2000);
      const rms = Math.sqrt(avgPower);
      // Should be boosted above unity (0.707)
      expect(rms).toBeGreaterThan(0.8);
    });
  });

  describe('high shelf filter', () => {
    it('should boost high frequencies', () => {
      filter.setHighShelf(5000, 6, 0.9);
      filter.reset();

      // Test at 10kHz (above shelf)
      const numSamples = 480;
      let totalOutputPower = 0;

      for (let i = 0; i < numSamples; i++) {
        const input = Math.sin(2 * Math.PI * 10000 * i / sampleRate);
        const output = filter.process(input);
        if (i > 100) {
          totalOutputPower += output * output;
        }
      }

      const avgPower = totalOutputPower / (numSamples - 100);
      const rms = Math.sqrt(avgPower);
      expect(rms).toBeGreaterThan(0.8);
    });
  });

  describe('setCoefficients', () => {
    it('should allow setting custom coefficients', () => {
      const customCoeffs = { b0: 0.5, b1: 0.25, b2: 0.25, a1: -0.5, a2: 0.25 };
      filter.setCoefficients(customCoeffs);

      const coeffs = filter.getCoefficients();
      expect(coeffs.b0).toBe(0.5);
      expect(coeffs.b1).toBe(0.25);
      expect(coeffs.a1).toBe(-0.5);
    });
  });
});
