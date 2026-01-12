/**
 * Echo Effect - Ported from AudioNoise echo.h
 * 
 * Minimal echo effect with delay, feedback, and optional LFO modulation
 */

import { DelayLine, limitValue } from '../delay-line';
import { LFO } from '../lfo';

export interface EchoParams {
  delayMs: number;      // 0 - 1000ms
  feedback: number;     // 0 - 1 (100%)
  lfoMs: number;        // LFO period 0 - 4ms
  mix: number;          // Dry/wet mix 0 - 1
}

export class EchoEffect {
  private delayLine: DelayLine;
  private lfo: LFO;
  private params: EchoParams;
  private sampleRate: number;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;
    this.delayLine = new DelayLine(sampleRate);
    this.lfo = new LFO(sampleRate);
    this.params = {
      delayMs: 300,
      feedback: 0.5,
      lfoMs: 0,
      mix: 0.5,
    };
    this.updateParams();
  }

  setParams(params: Partial<EchoParams>): void {
    this.params = { ...this.params, ...params };
    this.updateParams();
  }

  private updateParams(): void {
    if (this.params.lfoMs > 0) {
      this.lfo.setMs(this.params.lfoMs);
    }
  }

  process(input: number): number {
    const delaySamples = this.delayLine.msToSamples(this.params.delayMs);
    const d = 1 + delaySamples;
    
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

  getParams(): EchoParams {
    return { ...this.params };
  }
}

/**
 * Create Web Audio API based echo using DelayNode
 */
export function createEchoNode(
  context: AudioContext,
  delayMs: number = 300,
  feedback: number = 0.5,
  mix: number = 0.5
): { input: GainNode; output: GainNode; delay: DelayNode; feedbackGain: GainNode } {
  const input = context.createGain();
  const output = context.createGain();
  const delay = context.createDelay(2); // Max 2 seconds
  const feedbackGain = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();

  delay.delayTime.value = delayMs / 1000;
  feedbackGain.gain.value = feedback;
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;

  // Dry path
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path with feedback
  input.connect(delay);
  delay.connect(feedbackGain);
  feedbackGain.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(output);

  return { input, output, delay, feedbackGain };
}
