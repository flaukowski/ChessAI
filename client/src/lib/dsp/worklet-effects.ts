/**
 * AudioNoise Web - Worklet Effect Wrappers
 * TypeScript interfaces for AudioWorklet-based effects
 */

export interface EffectNode {
  input: AudioNode;
  output: AudioNode;
  bypass: boolean;
  mix: number;
  setBypass(bypass: boolean): void;
  setMix(mix: number): void;
  destroy(): void;
}

export interface EQParams {
  lowGain: number;    // -24 to 24 dB
  lowFreq: number;    // 20 to 500 Hz
  midGain: number;    // -24 to 24 dB
  midFreq: number;    // 200 to 5000 Hz
  midQ: number;       // 0.1 to 10
  highGain: number;   // -24 to 24 dB
  highFreq: number;   // 1000 to 20000 Hz
}

export interface DistortionParams {
  drive: number;      // 0 to 1
  tone: number;       // 0 to 1
  mode: number;       // 0=soft, 1=hard, 2=tube
  level: number;      // 0 to 1
}

export interface DelayParams {
  time: number;       // 1 to 2000 ms
  feedback: number;   // 0 to 0.95
  damping: number;    // 0 to 1
}

export interface ChorusParams {
  rate: number;       // 0.1 to 10 Hz
  depth: number;      // 0 to 1
  voices: number;     // 1 to 4
}

export interface CompressorParams {
  threshold: number;  // -60 to 0 dB
  ratio: number;      // 1 to 20
  attack: number;     // 0.1 to 100 ms
  release: number;    // 10 to 1000 ms
  makeupGain: number; // 0 to 24 dB
}

export interface BassPurrParams {
  fundamental: number; // 0 to 1 - clean fundamental mix
  even: number;        // 0 to 1 - even (2nd) harmonics mix
  odd: number;         // 0 to 1 - odd (3rd) harmonics mix
  tone: number;        // 0 to 1 - harmonic filter cutoff
  output: number;      // 0 to 1 - output level
}

export type EffectParams = EQParams | DistortionParams | DelayParams | ChorusParams | CompressorParams | BassPurrParams;

let workletLoaded = false;

export async function loadEffectWorklets(context: AudioContext): Promise<void> {
  if (workletLoaded) return;

  try {
    await context.audioWorklet.addModule('/worklets/effect-processor.js');
    workletLoaded = true;
  } catch (error) {
    console.error('Failed to load effect worklets:', error);
    throw error;
  }
}

/**
 * Base class for worklet effects
 */
abstract class WorkletEffect implements EffectNode {
  protected _node: AudioWorkletNode;
  protected _context: AudioContext;
  protected _bypass: boolean = false;
  protected _mix: number = 1;

  constructor(context: AudioContext, processorName: string) {
    this._context = context;
    this._node = new AudioWorkletNode(context, processorName);
  }

  get input(): AudioNode {
    return this._node;
  }

  get output(): AudioNode {
    return this._node;
  }

  get bypass(): boolean {
    return this._bypass;
  }

  get mix(): number {
    return this._mix;
  }

  setBypass(bypass: boolean): void {
    this._bypass = bypass;
    const param = this._node.parameters.get('bypass');
    if (param) {
      param.setValueAtTime(bypass ? 1 : 0, this._context.currentTime);
    }
  }

  setMix(mix: number): void {
    this._mix = Math.max(0, Math.min(1, mix));
    const param = this._node.parameters.get('mix');
    if (param) {
      param.setValueAtTime(this._mix, this._context.currentTime);
    }
  }

  protected setParam(name: string, value: number): void {
    const param = this._node.parameters.get(name);
    if (param) {
      param.setValueAtTime(value, this._context.currentTime);
    }
  }

  destroy(): void {
    this._node.disconnect();
  }
}

/**
 * 3-Band EQ Effect
 */
export class EQEffect extends WorkletEffect {
  private _params: EQParams = {
    lowGain: 0,
    lowFreq: 320,
    midGain: 0,
    midFreq: 1000,
    midQ: 1,
    highGain: 0,
    highFreq: 3200,
  };

  constructor(context: AudioContext) {
    super(context, 'eq-processor');
  }

  get params(): EQParams {
    return { ...this._params };
  }

  setLowGain(gain: number): void {
    this._params.lowGain = Math.max(-24, Math.min(24, gain));
    this.setParam('lowGain', this._params.lowGain);
  }

  setLowFreq(freq: number): void {
    this._params.lowFreq = Math.max(20, Math.min(500, freq));
    this.setParam('lowFreq', this._params.lowFreq);
  }

  setMidGain(gain: number): void {
    this._params.midGain = Math.max(-24, Math.min(24, gain));
    this.setParam('midGain', this._params.midGain);
  }

  setMidFreq(freq: number): void {
    this._params.midFreq = Math.max(200, Math.min(5000, freq));
    this.setParam('midFreq', this._params.midFreq);
  }

  setMidQ(q: number): void {
    this._params.midQ = Math.max(0.1, Math.min(10, q));
    this.setParam('midQ', this._params.midQ);
  }

  setHighGain(gain: number): void {
    this._params.highGain = Math.max(-24, Math.min(24, gain));
    this.setParam('highGain', this._params.highGain);
  }

  setHighFreq(freq: number): void {
    this._params.highFreq = Math.max(1000, Math.min(20000, freq));
    this.setParam('highFreq', this._params.highFreq);
  }

  setAllParams(params: Partial<EQParams>): void {
    if (params.lowGain !== undefined) this.setLowGain(params.lowGain);
    if (params.lowFreq !== undefined) this.setLowFreq(params.lowFreq);
    if (params.midGain !== undefined) this.setMidGain(params.midGain);
    if (params.midFreq !== undefined) this.setMidFreq(params.midFreq);
    if (params.midQ !== undefined) this.setMidQ(params.midQ);
    if (params.highGain !== undefined) this.setHighGain(params.highGain);
    if (params.highFreq !== undefined) this.setHighFreq(params.highFreq);
  }
}

/**
 * Distortion Effect
 */
export class DistortionEffect extends WorkletEffect {
  private _params: DistortionParams = {
    drive: 0.5,
    tone: 0.5,
    mode: 0,
    level: 0.5,
  };

  constructor(context: AudioContext) {
    super(context, 'distortion-processor');
  }

  get params(): DistortionParams {
    return { ...this._params };
  }

  setDrive(drive: number): void {
    this._params.drive = Math.max(0, Math.min(1, drive));
    this.setParam('drive', this._params.drive);
  }

  setTone(tone: number): void {
    this._params.tone = Math.max(0, Math.min(1, tone));
    this.setParam('tone', this._params.tone);
  }

  setMode(mode: number): void {
    this._params.mode = Math.round(Math.max(0, Math.min(2, mode)));
    this.setParam('mode', this._params.mode);
  }

  setLevel(level: number): void {
    this._params.level = Math.max(0, Math.min(1, level));
    this.setParam('level', this._params.level);
  }

  setAllParams(params: Partial<DistortionParams>): void {
    if (params.drive !== undefined) this.setDrive(params.drive);
    if (params.tone !== undefined) this.setTone(params.tone);
    if (params.mode !== undefined) this.setMode(params.mode);
    if (params.level !== undefined) this.setLevel(params.level);
  }
}

/**
 * Delay Effect
 */
export class DelayEffect extends WorkletEffect {
  private _params: DelayParams = {
    time: 300,
    feedback: 0.4,
    damping: 0.3,
  };

  constructor(context: AudioContext) {
    super(context, 'delay-processor');
  }

  get params(): DelayParams {
    return { ...this._params };
  }

  setTime(time: number): void {
    this._params.time = Math.max(1, Math.min(2000, time));
    this.setParam('time', this._params.time);
  }

  setFeedback(feedback: number): void {
    this._params.feedback = Math.max(0, Math.min(0.95, feedback));
    this.setParam('feedback', this._params.feedback);
  }

  setDamping(damping: number): void {
    this._params.damping = Math.max(0, Math.min(1, damping));
    this.setParam('damping', this._params.damping);
  }

  setAllParams(params: Partial<DelayParams>): void {
    if (params.time !== undefined) this.setTime(params.time);
    if (params.feedback !== undefined) this.setFeedback(params.feedback);
    if (params.damping !== undefined) this.setDamping(params.damping);
  }
}

/**
 * Chorus Effect
 */
export class ChorusEffect extends WorkletEffect {
  private _params: ChorusParams = {
    rate: 1.5,
    depth: 0.5,
    voices: 2,
  };

  constructor(context: AudioContext) {
    super(context, 'chorus-processor');
  }

  get params(): ChorusParams {
    return { ...this._params };
  }

  setRate(rate: number): void {
    this._params.rate = Math.max(0.1, Math.min(10, rate));
    this.setParam('rate', this._params.rate);
  }

  setDepth(depth: number): void {
    this._params.depth = Math.max(0, Math.min(1, depth));
    this.setParam('depth', this._params.depth);
  }

  setVoices(voices: number): void {
    this._params.voices = Math.round(Math.max(1, Math.min(4, voices)));
    this.setParam('voices', this._params.voices);
  }

  setAllParams(params: Partial<ChorusParams>): void {
    if (params.rate !== undefined) this.setRate(params.rate);
    if (params.depth !== undefined) this.setDepth(params.depth);
    if (params.voices !== undefined) this.setVoices(params.voices);
  }
}

/**
 * Compressor Effect
 */
export class CompressorEffect extends WorkletEffect {
  private _params: CompressorParams = {
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    makeupGain: 0,
  };

  constructor(context: AudioContext) {
    super(context, 'compressor-processor');
  }

  get params(): CompressorParams {
    return { ...this._params };
  }

  setThreshold(threshold: number): void {
    this._params.threshold = Math.max(-60, Math.min(0, threshold));
    this.setParam('threshold', this._params.threshold);
  }

  setRatio(ratio: number): void {
    this._params.ratio = Math.max(1, Math.min(20, ratio));
    this.setParam('ratio', this._params.ratio);
  }

  setAttack(attack: number): void {
    this._params.attack = Math.max(0.1, Math.min(100, attack));
    this.setParam('attack', this._params.attack);
  }

  setRelease(release: number): void {
    this._params.release = Math.max(10, Math.min(1000, release));
    this.setParam('release', this._params.release);
  }

  setMakeupGain(gain: number): void {
    this._params.makeupGain = Math.max(0, Math.min(24, gain));
    this.setParam('makeupGain', this._params.makeupGain);
  }

  setAllParams(params: Partial<CompressorParams>): void {
    if (params.threshold !== undefined) this.setThreshold(params.threshold);
    if (params.ratio !== undefined) this.setRatio(params.ratio);
    if (params.attack !== undefined) this.setAttack(params.attack);
    if (params.release !== undefined) this.setRelease(params.release);
    if (params.makeupGain !== undefined) this.setMakeupGain(params.makeupGain);
  }
}

/**
 * Level Meter
 * Reports peak and RMS levels for visualization
 */
export class LevelMeter {
  private _node: AudioWorkletNode;
  private _onLevels: ((levels: { peakL: number; peakR: number; rmsL: number; rmsR: number }) => void) | null = null;

  constructor(context: AudioContext) {
    this._node = new AudioWorkletNode(context, 'level-meter-processor');
    this._node.port.onmessage = (event) => {
      if (this._onLevels) {
        this._onLevels(event.data);
      }
    };
  }

  get input(): AudioNode {
    return this._node;
  }

  get output(): AudioNode {
    return this._node;
  }

  onLevels(callback: (levels: { peakL: number; peakR: number; rmsL: number; rmsR: number }) => void): void {
    this._onLevels = callback;
  }

  destroy(): void {
    this._onLevels = null;
    this._node.disconnect();
  }
}

/**
 * BassPurr Effect
 * Bass guitar harmonics generator with fundamental, even, and odd harmonic paths
 */
export class BassPurrEffect extends WorkletEffect {
  private _params: BassPurrParams = {
    fundamental: 0.7,
    even: 0.3,
    odd: 0.3,
    tone: 0.5,
    output: 0.7,
  };

  constructor(context: AudioContext) {
    super(context, 'basspurr-processor');
  }

  get params(): BassPurrParams {
    return { ...this._params };
  }

  setFundamental(value: number): void {
    this._params.fundamental = Math.max(0, Math.min(1, value));
    this.setParam('fundamental', this._params.fundamental);
  }

  setEven(value: number): void {
    this._params.even = Math.max(0, Math.min(1, value));
    this.setParam('even', this._params.even);
  }

  setOdd(value: number): void {
    this._params.odd = Math.max(0, Math.min(1, value));
    this.setParam('odd', this._params.odd);
  }

  setTone(value: number): void {
    this._params.tone = Math.max(0, Math.min(1, value));
    this.setParam('tone', this._params.tone);
  }

  setOutput(value: number): void {
    this._params.output = Math.max(0, Math.min(1, value));
    this.setParam('output', this._params.output);
  }

  setAllParams(params: Partial<BassPurrParams>): void {
    if (params.fundamental !== undefined) this.setFundamental(params.fundamental);
    if (params.even !== undefined) this.setEven(params.even);
    if (params.odd !== undefined) this.setOdd(params.odd);
    if (params.tone !== undefined) this.setTone(params.tone);
    if (params.output !== undefined) this.setOutput(params.output);
  }
}

/**
 * Effect type enum for the factory
 */
export type WorkletEffectType = 'eq' | 'distortion' | 'delay' | 'chorus' | 'compressor' | 'basspurr';

/**
 * Default parameters for each effect type
 */
export const defaultWorkletParams: Record<WorkletEffectType, Record<string, number>> = {
  eq: {
    lowGain: 0,
    lowFreq: 320,
    midGain: 0,
    midFreq: 1000,
    midQ: 1,
    highGain: 0,
    highFreq: 3200,
    mix: 1,
  },
  distortion: {
    drive: 0.5,
    tone: 0.5,
    mode: 0,
    level: 0.5,
    mix: 1,
  },
  delay: {
    time: 300,
    feedback: 0.4,
    damping: 0.3,
    mix: 0.5,
  },
  chorus: {
    rate: 1.5,
    depth: 0.5,
    voices: 2,
    mix: 0.5,
  },
  compressor: {
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    makeupGain: 0,
    mix: 1,
  },
  basspurr: {
    fundamental: 0.7,
    even: 0.3,
    odd: 0.3,
    tone: 0.5,
    output: 0.7,
    mix: 1,
  },
};

/**
 * Factory function to create effect instances
 */
export function createWorkletEffect(
  context: AudioContext,
  type: WorkletEffectType
): EffectNode {
  switch (type) {
    case 'eq':
      return new EQEffect(context);
    case 'distortion':
      return new DistortionEffect(context);
    case 'delay':
      return new DelayEffect(context);
    case 'chorus':
      return new ChorusEffect(context);
    case 'compressor':
      return new CompressorEffect(context);
    case 'basspurr':
      return new BassPurrEffect(context);
    default:
      throw new Error(`Unknown effect type: ${type}`);
  }
}
