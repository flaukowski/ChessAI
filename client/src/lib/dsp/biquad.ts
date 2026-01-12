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
