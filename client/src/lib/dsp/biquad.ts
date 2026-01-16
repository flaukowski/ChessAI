/**
 * Biquad Filter Implementation - Ported from AudioNoise biquad.h
 * 
 * IIR biquad filters: lowpass, highpass, bandpass, notch, allpass
 * Uses Direct Form II Transposed for numerical stability
 */

export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface BiquadState {
  w1: number;
  w2: number;
}

export type BiquadFilterType = 'lowpass' | 'highpass' | 'bandpass' | 'bandpass-peak' | 'notch' | 'allpass';

export class BiquadFilter {
  private coeff: BiquadCoefficients = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
  private state: BiquadState = { w1: 0, w2: 0 };
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  private fastSinCos(normalizedFreq: number): { sin: number; cos: number } {
    const omega = 2 * Math.PI * normalizedFreq;
    return { sin: Math.sin(omega), cos: Math.cos(omega) };
  }

  setLowpass(frequency: number, Q: number = 0.707): void {
    const w0 = this.fastSinCos(frequency / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);
    const b1 = (1 - w0.cos) * a0Inv;

    this.coeff = {
      b0: b1 / 2,
      b1: b1,
      b2: b1 / 2,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setHighpass(frequency: number, Q: number = 0.707): void {
    const w0 = this.fastSinCos(frequency / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);
    const b1 = (1 + w0.cos) * a0Inv;

    this.coeff = {
      b0: b1 / 2,
      b1: -b1,
      b2: b1 / 2,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setBandpass(frequency: number, Q: number = 1): void {
    const w0 = this.fastSinCos(frequency / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: alpha * a0Inv,
      b1: 0,
      b2: -alpha * a0Inv,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setBandpassPeak(frequency: number, Q: number = 1): void {
    const w0 = this.fastSinCos(frequency / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: Q * alpha * a0Inv,
      b1: 0,
      b2: -Q * alpha * a0Inv,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setNotch(frequency: number, Q: number = 1): void {
    const w0 = this.fastSinCos(frequency / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: 1 * a0Inv,
      b1: -2 * w0.cos * a0Inv,
      b2: 1 * a0Inv,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setAllpass(frequency: number, Q: number = 0.707): void {
    const w0 = this.fastSinCos(frequency / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: (1 - alpha) * a0Inv,
      b1: -2 * w0.cos * a0Inv,
      b2: 1, // Same as a0
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  reset(): void {
    this.state = { w1: 0, w2: 0 };
  }

  process(input: number): number {
    const { b0, b1, b2, a1, a2 } = this.coeff;
    const { w1, w2 } = this.state;

    // Direct Form II Transposed
    const w0 = input - a1 * w1 - a2 * w2;
    const output = b0 * w0 + b1 * w1 + b2 * w2;

    this.state.w2 = w1;
    this.state.w1 = w0;

    return output;
  }

  processBlock(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.process(input[i]);
    }
  }

  getCoefficients(): BiquadCoefficients {
    return { ...this.coeff };
  }
}

/**
 * Direct Form I Biquad Filter
 * Adapted from dspml filter_process.ml
 *
 * DF1 maintains separate feedforward and feedback delay lines.
 * Can be more stable than DF2T at extreme Q values, though uses
 * slightly more memory (4 state variables instead of 2).
 *
 * Note: Coefficient sign convention matches standard DSP literature
 * where the difference equation is:
 *   y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
 */
export interface BiquadDF1State {
  x1: number; // x[n-1]
  x2: number; // x[n-2]
  y1: number; // y[n-1]
  y2: number; // y[n-2]
}

export class BiquadFilterDF1 {
  private coeff: BiquadCoefficients = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
  private state: BiquadDF1State = { x1: 0, x2: 0, y1: 0, y2: 0 };
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  private fastSinCos(normalizedFreq: number): { sin: number; cos: number } {
    const omega = 2 * Math.PI * normalizedFreq;
    return { sin: Math.sin(omega), cos: Math.cos(omega) };
  }

  /**
   * Pre-warp frequency for accurate digital filter response
   * Important for high frequencies where bilinear transform causes warping
   */
  private prewarpFrequency(fc: number): number {
    const nyquist = this.sampleRate / 2;
    if (fc < nyquist * 0.25) {
      return fc;
    }
    const clampedFc = Math.min(fc, nyquist * 0.98);
    return (this.sampleRate / Math.PI) * Math.tan(Math.PI * clampedFc / this.sampleRate);
  }

  setLowpass(frequency: number, Q: number = 0.707): void {
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);
    const b1 = (1 - w0.cos) * a0Inv;

    this.coeff = {
      b0: b1 / 2,
      b1: b1,
      b2: b1 / 2,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setHighpass(frequency: number, Q: number = 0.707): void {
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);
    const b1 = (1 + w0.cos) * a0Inv;

    this.coeff = {
      b0: b1 / 2,
      b1: -b1,
      b2: b1 / 2,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setBandpass(frequency: number, Q: number = 1): void {
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: alpha * a0Inv,
      b1: 0,
      b2: -alpha * a0Inv,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setNotch(frequency: number, Q: number = 1): void {
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: 1 * a0Inv,
      b1: -2 * w0.cos * a0Inv,
      b2: 1 * a0Inv,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  setAllpass(frequency: number, Q: number = 0.707): void {
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha);

    this.coeff = {
      b0: (1 - alpha) * a0Inv,
      b1: -2 * w0.cos * a0Inv,
      b2: 1,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha) * a0Inv,
    };
  }

  /**
   * Set coefficients for a peaking EQ filter
   */
  setPeaking(frequency: number, gainDb: number, Q: number = 1): void {
    const A = Math.pow(10, gainDb / 40);
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / (2 * Q);
    const a0Inv = 1 / (1 + alpha / A);

    this.coeff = {
      b0: (1 + alpha * A) * a0Inv,
      b1: -2 * w0.cos * a0Inv,
      b2: (1 - alpha * A) * a0Inv,
      a1: -2 * w0.cos * a0Inv,
      a2: (1 - alpha / A) * a0Inv,
    };
  }

  /**
   * Set coefficients for a low shelf filter
   */
  setLowShelf(frequency: number, gainDb: number, slope: number = 0.9): void {
    const A = Math.pow(10, gainDb / 40);
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / 2 * Math.sqrt((A + 1/A) * (1/slope - 1) + 2);
    const sqrtA = Math.sqrt(A);

    const a0 = (A + 1) + (A - 1) * w0.cos + 2 * sqrtA * alpha;
    this.coeff = {
      b0: (A * ((A + 1) - (A - 1) * w0.cos + 2 * sqrtA * alpha)) / a0,
      b1: (2 * A * ((A - 1) - (A + 1) * w0.cos)) / a0,
      b2: (A * ((A + 1) - (A - 1) * w0.cos - 2 * sqrtA * alpha)) / a0,
      a1: (-2 * ((A - 1) + (A + 1) * w0.cos)) / a0,
      a2: ((A + 1) + (A - 1) * w0.cos - 2 * sqrtA * alpha) / a0,
    };
  }

  /**
   * Set coefficients for a high shelf filter
   */
  setHighShelf(frequency: number, gainDb: number, slope: number = 0.9): void {
    const A = Math.pow(10, gainDb / 40);
    const warpedFreq = this.prewarpFrequency(frequency);
    const w0 = this.fastSinCos(warpedFreq / this.sampleRate);
    const alpha = w0.sin / 2 * Math.sqrt((A + 1/A) * (1/slope - 1) + 2);
    const sqrtA = Math.sqrt(A);

    const a0 = (A + 1) - (A - 1) * w0.cos + 2 * sqrtA * alpha;
    this.coeff = {
      b0: (A * ((A + 1) + (A - 1) * w0.cos + 2 * sqrtA * alpha)) / a0,
      b1: (-2 * A * ((A - 1) + (A + 1) * w0.cos)) / a0,
      b2: (A * ((A + 1) + (A - 1) * w0.cos - 2 * sqrtA * alpha)) / a0,
      a1: (2 * ((A - 1) - (A + 1) * w0.cos)) / a0,
      a2: ((A + 1) - (A - 1) * w0.cos - 2 * sqrtA * alpha) / a0,
    };
  }

  reset(): void {
    this.state = { x1: 0, x2: 0, y1: 0, y2: 0 };
  }

  /**
   * Process a single sample using Direct Form I
   * y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
   */
  process(input: number): number {
    const { b0, b1, b2, a1, a2 } = this.coeff;
    const { x1, x2, y1, y2 } = this.state;

    // Direct Form I computation
    const output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;

    // Update state (shift delay lines)
    this.state.x2 = x1;
    this.state.x1 = input;
    this.state.y2 = y1;
    this.state.y1 = output;

    return output;
  }

  processBlock(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.process(input[i]);
    }
  }

  getCoefficients(): BiquadCoefficients {
    return { ...this.coeff };
  }

  setCoefficients(coeffs: BiquadCoefficients): void {
    this.coeff = { ...coeffs };
  }
}

export function createBiquadNode(
  context: AudioContext,
  type: BiquadFilterType,
  frequency: number,
  Q: number = 0.707
): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  
  switch (type) {
    case 'lowpass':
      filter.type = 'lowpass';
      break;
    case 'highpass':
      filter.type = 'highpass';
      break;
    case 'bandpass':
    case 'bandpass-peak':
      filter.type = 'bandpass';
      break;
    case 'notch':
      filter.type = 'notch';
      break;
    case 'allpass':
      filter.type = 'allpass';
      break;
  }
  
  filter.frequency.value = frequency;
  filter.Q.value = Q;
  
  return filter;
}
