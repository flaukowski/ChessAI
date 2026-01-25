/**
 * Delay Line - Ported from AudioNoise sample_array utilities
 * 
 * Circular buffer for audio delay effects with interpolated reads
 * Max ~1.25s delays at ~52kHz (65536 samples)
 */

const DEFAULT_SAMPLE_ARRAY_SIZE = 65536;

export class DelayLine {
  private buffer: Float32Array;
  private mask: number;
  private writeIndex: number = 0;
  private sampleRate: number;

  constructor(sampleRate: number = 48000, maxDelaySamples: number = DEFAULT_SAMPLE_ARRAY_SIZE) {
    this.sampleRate = sampleRate;
    const bufferSize = Math.min(maxDelaySamples, DEFAULT_SAMPLE_ARRAY_SIZE);
    this.buffer = new Float32Array(bufferSize);
    this.mask = bufferSize - 1;
  }

  get maxDelayMs(): number {
    return (this.buffer.length / this.sampleRate) * 1000;
  }

  write(sample: number): void {
    this.writeIndex = (this.writeIndex + 1) & this.mask;
    this.buffer[this.writeIndex] = sample;
  }

  read(delaySamples: number): number {
    const intDelay = Math.floor(delaySamples);
    const frac = delaySamples - intDelay;
    
    const idx = this.writeIndex - intDelay;
    const a = this.buffer[(idx) & this.mask];
    const b = this.buffer[(idx - 1) & this.mask];
    
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
