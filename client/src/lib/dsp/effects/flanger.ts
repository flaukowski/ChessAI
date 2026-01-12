/**
 * Flanger Effect - Ported from AudioNoise flanger.h
 * Based on MIT-licensed DaisySP library by Electrosmith
 * 
 * Classic flanger using modulated delay with feedback
 */

import { DelayLine, limitValue } from '../delay-line';
import { LFO, LFOWaveform } from '../lfo';

export interface FlangerParams {
  rate: number;         // LFO frequency 0 - 10Hz
  delayMs: number;      // Base delay 0 - 4ms
  depth: number;        // Modulation depth 0 - 1
  feedback: number;     // Feedback amount 0 - 1
  mix: number;          // Dry/wet mix 0 - 1
  waveform: LFOWaveform;
}

export class FlangerEffect {
  private delayLine: DelayLine;
  private lfo: LFO;
  private params: FlangerParams;
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
    this.delayLine = new DelayLine(sampleRate, 4096); // Short delay for flanger
    this.lfo = new LFO(sampleRate);
    this.params = {
      rate: 0.5,
      delayMs: 2,
      depth: 0.5,
      feedback: 0.5,
      mix: 0.5,
      waveform: 'sine',
    };
    this.updateParams();
  }

  setParams(params: Partial<FlangerParams>): void {
    this.params = { ...this.params, ...params };
    this.updateParams();
  }

  private updateParams(): void {
    this.lfo.setFrequency(this.params.rate);
  }

  process(input: number): number {
    const lfoValue = this.lfo.tick(this.params.waveform);
    const baseDelaySamples = this.delayLine.msToSamples(this.params.delayMs);
    
    // Modulate delay time with LFO
    const d = 1 + baseDelaySamples * (1 + lfoValue * this.params.depth);
    
    const delayed = this.delayLine.read(d);
    this.delayLine.write(limitValue(input + delayed * this.params.feedback));
    
    const wet = (input + delayed) / 2;
    return input * (1 - this.params.mix) + wet * this.params.mix;
  }

  processBlock(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.process(input[i]);
    }
  }

  reset(): void {
    this.delayLine.clear();
    this.lfo.reset();
  }

  getParams(): FlangerParams {
    return { ...this.params };
  }
}

/**
 * Create Web Audio API based flanger using DelayNode + Oscillator
 */
export function createFlangerNode(
  context: AudioContext,
  rate: number = 0.5,
  delayMs: number = 2,
  depth: number = 0.5,
  feedback: number = 0.5,
  mix: number = 0.5
): { 
  input: GainNode; 
  output: GainNode; 
  lfo: OscillatorNode;
  setRate: (hz: number) => void;
  setDepth: (d: number) => void;
  setFeedback: (fb: number) => void;
} {
  const input = context.createGain();
  const output = context.createGain();
  const delay = context.createDelay(0.05); // Max 50ms for flanger
  const feedbackGain = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  // Set initial values
  delay.delayTime.value = delayMs / 1000;
  feedbackGain.gain.value = feedback;
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;
  lfo.frequency.value = rate;
  lfo.type = 'sine';
  lfoGain.gain.value = (delayMs / 1000) * depth;

  // LFO modulates delay time
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  lfo.start();

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path with feedback
  input.connect(delay);
  delay.connect(feedbackGain);
  feedbackGain.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(output);

  return {
    input,
    output,
    lfo,
    setRate: (hz: number) => { lfo.frequency.value = hz; },
    setDepth: (d: number) => { lfoGain.gain.value = (delayMs / 1000) * d; },
    setFeedback: (fb: number) => { feedbackGain.gain.value = fb; },
  };
}
