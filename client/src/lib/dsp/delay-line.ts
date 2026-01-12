/**
 * Delay Line - Ported from AudioNoise sample_array utilities
 * 
 * Circular buffer for audio delay effects with interpolated reads
 * Max ~1.25s delays at ~52kHz (65536 samples)
 */

const SAMPLE_ARRAY_SIZE = 65536;
const SAMPLE_ARRAY_MASK = SAMPLE_ARRAY_SIZE - 1;

export class DelayLine {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private sampleRate: number;

  constructor(sampleRate: number = 48000, maxDelaySamples: number = SAMPLE_ARRAY_SIZE) {
    this.sampleRate = sampleRate;
    this.buffer = new Float32Array(Math.min(maxDelaySamples, SAMPLE_ARRAY_SIZE));
  }

  get maxDelayMs(): number {
    return (this.buffer.length / this.sampleRate) * 1000;
  }

  write(sample: number): void {
    this.writeIndex = (this.writeIndex + 1) & SAMPLE_ARRAY_MASK;
    this.buffer[this.writeIndex] = sample;
  }

  read(delaySamples: number): number {
    const intDelay = Math.floor(delaySamples);
    const frac = delaySamples - intDelay;
    
    const idx = this.writeIndex - intDelay;
    const a = this.buffer[(idx) & SAMPLE_ARRAY_MASK];
    const b = this.buffer[(idx - 1) & SAMPLE_ARRAY_MASK];
    
    // Linear interpolation for sub-sample accuracy
    return a + (b - a) * frac;
  }

  readMs(delayMs: number): number {
    const delaySamples = (delayMs / 1000) * this.sampleRate;
    return this.read(delaySamples);
  }

  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }

  msToSamples(ms: number): number {
    return (ms / 1000) * this.sampleRate;
  }
}

export function limitValue(x: number): number {
  // Smooth limiter from AudioNoise util.h
  // Smoothly limits x to -1..1 when approaching -2..2
  const x2 = x * x;
  const x4 = x2 * x2;
  return x * (1 - 0.19 * x2 + 0.0162 * x4);
}
