/**
 * LFO (Low Frequency Oscillator) - Ported from AudioNoise lfo.h
 * 
 * Generates quarter cycle (0..1) from a 30-bit cycle.
 * When it overflows, changes quarter counter turning 0..1 into:
 * [ 0..1, 1..0, 0..-1, -1..0 ]
 */

export type LFOWaveform = 'sine' | 'triangle' | 'sawtooth';

const TWO_POW_32 = 4294967296.0;

// Pre-computed quarter sine table (256 entries)
const QUARTER_SINE_STEPS = 256;
const quarterSin: number[] = [];
for (let i = 0; i <= QUARTER_SINE_STEPS; i++) {
  quarterSin[i] = Math.sin((i / QUARTER_SINE_STEPS) * (Math.PI / 2));
}

export class LFO {
  private idx: number = 0;
  private step: number = 0;
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
  }

  private get fStep(): number {
    return TWO_POW_32 / this.sampleRate;
  }

  setFrequency(freq: number): void {
    this.step = Math.round(freq * this.fStep);
  }

  setMs(ms: number): void {
    if (ms < 0.1) ms = 0.1; // Max ~10kHz
    this.step = Math.round((1000 * this.fStep) / ms);
  }

  reset(): void {
    this.idx = 0;
  }

  tick(waveform: LFOWaveform): number {
    const now = this.idx >>> 0; // Ensure unsigned
    this.idx = (now + this.step) >>> 0;

    if (waveform === 'sawtooth') {
      return now / TWO_POW_32;
    }

    let val: number;
    const quarter = (now >>> 30) & 3;
    let phase = (now << 2) >>> 0;

    // Second and fourth quarter reverses direction
    if (quarter & 1) {
      phase = (~phase) >>> 0;
    }

    if (waveform === 'sine') {
      const tableIdx = phase >>> (32 - 8); // 8 bits for 256 entries
      const frac = ((phase << 8) >>> 0) / TWO_POW_32;
      
      const a = quarterSin[tableIdx] || 0;
      const b = quarterSin[tableIdx + 1] || 0;
      val = a + (b - a) * frac;
    } else {
      // Triangle
      val = phase / TWO_POW_32;
    }

    // Last two quarters are negative
    if (quarter & 2) {
      val = -val;
    }

    return val;
  }
}

export function createLFOWorklet(context: AudioContext): AudioWorkletNode | null {
  // For real-time LFO in Web Audio, we'd use AudioWorklet
  // This is a simplified version for now
  return null;
}
