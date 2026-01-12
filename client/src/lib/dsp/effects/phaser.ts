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
  }

  private fastPow2(x: number): number {
    // Fast approximation of 2^x for audio
    return Math.pow(2, x);
  }

  process(input: number): number {
    const lfoValue = this.lfo.tick(this.params.waveform);
    
    // Calculate modulated frequency
    const freqMultiplier = this.fastPow2(lfoValue * this.params.octaves);
    const freq = this.params.centerFreq * freqMultiplier;
    
    // Update all filters to new frequency
    for (const filter of this.filters) {
      filter.setAllpass(freq, this.params.Q);
    }
    
    // Apply feedback from last filter output
    let out = input + this.params.feedback * this.filterStates[3].y[0];
    
    // Chain through all 4 allpass stages
    for (let i = 0; i < 4; i++) {
      out = this.filters[i].process(out);
    }
    
    // Mix dry and wet
    const wet = limitValue(input + out);
    return input * (1 - this.params.mix) + wet * this.params.mix;
  }

  processBlock(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.process(input[i]);
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
