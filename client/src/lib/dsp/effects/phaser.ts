/**
 * Phaser Effect - Ported from AudioNoise phaser.h
 * 
 * 4-stage allpass filter phaser with LFO modulation
 * Creates classic sweeping phase cancellation effect
 */

import { BiquadFilter } from '../biquad';
import { LFO, LFOWaveform } from '../lfo';
import { limitValue } from '../delay-line';

export interface PhaserParams {
  rate: number;           // LFO rate in ms (25 - 2000ms period)
  feedback: number;       // Feedback 0 - 0.75
  centerFreq: number;     // Center frequency 50 - 1000Hz
  octaves: number;        // Sweep range in octaves (default 4)
  Q: number;              // Filter Q 0.25 - 2
  mix: number;            // Dry/wet mix 0 - 1
  waveform: LFOWaveform;
}

export class PhaserEffect {
  private filters: BiquadFilter[] = [];
  private filterStates: { x: number[]; y: number[] }[] = [];
  private lfo: LFO;
  private params: PhaserParams;
  private sampleRate: number;
  // Performance optimization: cache last frequency to avoid redundant filter updates
  private lastFreq: number = 0;
  private freqUpdateThreshold: number = 1; // Only update if freq changes by 1Hz+
  private lastFilterOutput: number = 0; // Cache for feedback

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
    this.lfo = new LFO(sampleRate);

    // 4 stages of allpass filters (like original)
    for (let i = 0; i < 4; i++) {
      this.filters.push(new BiquadFilter(sampleRate));
      this.filterStates.push({ x: [0, 0], y: [0, 0] });
    }

    this.params = {
      rate: 500,        // 500ms LFO period
      feedback: 0.5,
      centerFreq: 440,
      octaves: 4,
      Q: 0.707,
      mix: 0.5,
      waveform: 'triangle',
    };
    this.updateParams();
  }

  setParams(params: Partial<PhaserParams>): void {
    this.params = { ...this.params, ...params };
    this.updateParams();
  }

  private updateParams(): void {
    this.lfo.setMs(this.params.rate);
    // Force filter update on param change
    this.lastFreq = 0;
  }

  private fastPow2(x: number): number {
    // Fast approximation of 2^x for audio
    // ~10x faster than Math.pow for audio-range values
    if (x === 0) return 1;

    // Handle negative exponents properly (bit shift doesn't work for negatives)
    if (x < 0) {
      const xi = Math.floor(x);
      const xf = x - xi;
      // 2^xi for negative integer = 1 / 2^|xi|
      const intPart = 1 / (1 << -xi);
      // Linear interpolation for fractional: 2^xf ≈ 1 + 0.693*xf (good for |xf| < 1)
      const fracApprox = 1 + 0.6931471805599453 * xf;
      return intPart * fracApprox;
    }

    const xi = x | 0; // Integer part
    const xf = x - xi; // Fractional part
    // Linear interpolation for fractional: 2^xf ≈ 1 + 0.693*xf (good for |xf| < 1)
    const fracApprox = 1 + 0.6931471805599453 * xf;
    return (1 << xi) * fracApprox;
  }

  process(input: number): number {
    const lfoValue = this.lfo.tick(this.params.waveform);

    // Calculate modulated frequency
    const freqMultiplier = this.fastPow2(lfoValue * this.params.octaves);
    const freq = this.params.centerFreq * freqMultiplier;

    // OPTIMIZATION: Only update filter coefficients when frequency changes significantly
    // This reduces 192,000 coefficient calculations/sec to ~1,000/sec (phaser sweeps slowly)
    if (Math.abs(freq - this.lastFreq) > this.freqUpdateThreshold) {
      for (const filter of this.filters) {
        filter.setAllpass(freq, this.params.Q);
      }
      this.lastFreq = freq;
    }

    // Apply feedback from cached last filter output
    let out = input + this.params.feedback * this.lastFilterOutput;

    // Chain through all 4 allpass stages
    for (let i = 0; i < 4; i++) {
      out = this.filters[i].process(out);
    }

    // Cache output for next feedback calculation
    this.lastFilterOutput = out;

    // Mix dry and wet
    const wet = limitValue(input + out);
    return input * (1 - this.params.mix) + wet * this.params.mix;
  }

  processBlock(input: Float32Array, output: Float32Array): void {
    // Process block with batched filter updates for better performance
    const blockSize = input.length;
    const updateInterval = 32; // Update filters every 32 samples (~0.67ms at 48kHz)

    for (let i = 0; i < blockSize; i++) {
      // Only check for filter updates periodically within block
      if ((i & 31) === 0) { // Every 32 samples
        const lfoValue = this.lfo.tick(this.params.waveform);
        const freqMultiplier = this.fastPow2(lfoValue * this.params.octaves);
        const freq = this.params.centerFreq * freqMultiplier;

        if (Math.abs(freq - this.lastFreq) > this.freqUpdateThreshold) {
          for (const filter of this.filters) {
            filter.setAllpass(freq, this.params.Q);
          }
          this.lastFreq = freq;
        }
      } else {
        // Just tick LFO without using result (keeps phase consistent)
        this.lfo.tick(this.params.waveform);
      }

      let out = input[i] + this.params.feedback * this.lastFilterOutput;
      for (let j = 0; j < 4; j++) {
        out = this.filters[j].process(out);
      }
      this.lastFilterOutput = out;
      const wet = limitValue(input[i] + out);
      output[i] = input[i] * (1 - this.params.mix) + wet * this.params.mix;
    }
  }

  reset(): void {
    this.lfo.reset();
    for (const filter of this.filters) {
      filter.reset();
    }
    for (const state of this.filterStates) {
      state.x = [0, 0];
      state.y = [0, 0];
    }
  }

  getParams(): PhaserParams {
    return { ...this.params };
  }
}

/**
 * Create Web Audio API based phaser using multiple BiquadFilterNodes
 */
export function createPhaserNode(
  context: AudioContext,
  rate: number = 0.5,
  depth: number = 800,
  feedback: number = 0.5,
  mix: number = 0.5
): {
  input: GainNode;
  output: GainNode;
  filters: BiquadFilterNode[];
  lfo: OscillatorNode;
  setRate: (hz: number) => void;
  setDepth: (d: number) => void;
  setFeedback: (fb: number) => void;
} {
  const input = context.createGain();
  const output = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const feedbackGain = context.createGain();
  const lfo = context.createOscillator();
  
  // Create 4 allpass filter stages
  const filters: BiquadFilterNode[] = [];
  const lfoGains: GainNode[] = [];
  
  for (let i = 0; i < 4; i++) {
    const filter = context.createBiquadFilter();
    filter.type = 'allpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.707;
    filters.push(filter);
    
    // Each filter gets LFO modulation
    const lfoGain = context.createGain();
    lfoGain.gain.value = depth;
    lfoGains.push(lfoGain);
    
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
  }

  // Set initial values
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;
  feedbackGain.gain.value = feedback;
  lfo.frequency.value = rate;
  lfo.type = 'triangle';
  lfo.start();

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path: chain all filters
  input.connect(filters[0]);
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }
  
  // Last filter to output and feedback
  filters[filters.length - 1].connect(wetGain);
  filters[filters.length - 1].connect(feedbackGain);
  feedbackGain.connect(filters[0]);
  wetGain.connect(output);

  return {
    input,
    output,
    filters,
    lfo,
    setRate: (hz: number) => { lfo.frequency.value = hz; },
    setDepth: (d: number) => { lfoGains.forEach(g => g.gain.value = d); },
    setFeedback: (fb: number) => { feedbackGain.gain.value = fb; },
  };
}
