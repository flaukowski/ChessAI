/**
 * Convolution Reverb Effect
 *
 * Professional-quality reverb using Web Audio's ConvolverNode
 * with synthetically generated impulse responses.
 *
 * Features:
 * - Four room size presets (small, medium, large, hall)
 * - Adjustable decay time (0.1 - 10 seconds)
 * - Pre-delay control (0 - 100ms)
 * - Wet/dry mix control
 * - Early reflections simulation
 * - High-frequency damping for natural decay
 */

export type RoomSize = 'small' | 'medium' | 'large' | 'hall';

export interface ConvolutionReverbParams {
  wetDryMix: number;     // 0-1 (0 = dry, 1 = wet)
  decay: number;         // 0.1-10 seconds
  preDelay: number;      // 0-100ms
  roomSize: RoomSize;    // Room type selection
  damping: number;       // 0-1 High frequency absorption
}

// Room characteristics for impulse response generation
interface RoomCharacteristics {
  baseDecay: number;       // Base decay multiplier
  diffusion: number;       // Reflection density
  earlyReflections: number; // Number of early reflections
  highFreqDecay: number;   // Additional HF decay rate
  initialDelay: number;    // Room-dependent initial delay in ms
  size: number;            // Size factor for reflection timing
}

const ROOM_PRESETS: Record<RoomSize, RoomCharacteristics> = {
  small: {
    baseDecay: 0.3,
    diffusion: 0.4,
    earlyReflections: 8,
    highFreqDecay: 0.85,
    initialDelay: 5,
    size: 0.15,
  },
  medium: {
    baseDecay: 0.5,
    diffusion: 0.6,
    earlyReflections: 12,
    highFreqDecay: 0.75,
    initialDelay: 15,
    size: 0.35,
  },
  large: {
    baseDecay: 0.7,
    diffusion: 0.75,
    earlyReflections: 16,
    highFreqDecay: 0.65,
    initialDelay: 30,
    size: 0.6,
  },
  hall: {
    baseDecay: 0.9,
    diffusion: 0.85,
    earlyReflections: 24,
    highFreqDecay: 0.5,
    initialDelay: 50,
    size: 1.0,
  },
};

/**
 * Generate a synthetic impulse response buffer
 * Uses noise with exponential decay and early reflections
 */
function generateImpulseResponse(
  context: AudioContext | OfflineAudioContext,
  decay: number,
  roomSize: RoomSize,
  damping: number
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const room = ROOM_PRESETS[roomSize];

  // Calculate IR length based on decay time and room characteristics
  const effectiveDecay = decay * room.baseDecay;
  const irLength = Math.ceil(sampleRate * Math.min(effectiveDecay * 3, 10)); // Max 10 seconds

  // Create stereo buffer for spatial reverb
  const buffer = context.createBuffer(2, irLength, sampleRate);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  // Time constants for decay envelope
  const decayRate = -Math.log(0.001) / (effectiveDecay * sampleRate);
  const hfDecayRate = decayRate * (1 + (1 - room.highFreqDecay) * (1 + damping));

  // Generate early reflections
  generateEarlyReflections(leftChannel, rightChannel, sampleRate, room, effectiveDecay);

  // Generate diffuse tail with noise
  generateDiffuseTail(leftChannel, rightChannel, sampleRate, room, decayRate, hfDecayRate, damping);

  // Apply overall envelope and normalize
  normalizeBuffer(buffer);

  return buffer;
}

/**
 * Generate early reflections to simulate room geometry
 */
function generateEarlyReflections(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  room: RoomCharacteristics,
  decay: number
): void {
  const numReflections = room.earlyReflections;
  const roomSize = room.size;

  // Generate reflection times and gains using room acoustics model
  for (let i = 0; i < numReflections; i++) {
    // Reflection time increases non-linearly (simulates room geometry)
    const timeMs = room.initialDelay + (i * i * roomSize * 8);
    const timeSamples = Math.floor((timeMs / 1000) * sampleRate);

    if (timeSamples >= left.length) continue;

    // Reflection amplitude decreases with distance (inverse square approximation)
    const distance = 1 + i * roomSize;
    const gain = Math.exp(-distance * 0.3) * (1 - i / numReflections * 0.5);

    // Add some randomness to simulate irregular room surfaces
    const jitter = Math.floor((Math.random() - 0.5) * sampleRate * 0.003);
    const sampleIndex = Math.max(0, Math.min(left.length - 1, timeSamples + jitter));

    // Stereo spread - alternate reflections left/right with varying intensity
    const pan = Math.sin(i * 1.618) * 0.6; // Golden ratio for good distribution
    const leftGain = gain * (1 - pan * 0.5);
    const rightGain = gain * (1 + pan * 0.5);

    left[sampleIndex] += leftGain;
    right[sampleIndex] += rightGain;
  }
}

/**
 * Generate the diffuse reverb tail using filtered noise
 */
function generateDiffuseTail(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  room: RoomCharacteristics,
  decayRate: number,
  hfDecayRate: number,
  damping: number
): void {
  const length = left.length;
  const diffusion = room.diffusion;
  const startSample = Math.floor(room.initialDelay * sampleRate / 1000);

  // Simple one-pole lowpass filter state for HF damping
  let lpStateL = 0;
  let lpStateR = 0;
  const lpCoeff = 0.3 + damping * 0.5; // Higher damping = more filtering

  // Pre-generate some random values for performance
  const randomBuffer = new Float32Array(1024);
  for (let i = 0; i < randomBuffer.length; i++) {
    randomBuffer[i] = Math.random() * 2 - 1;
  }

  for (let i = startSample; i < length; i++) {
    // Exponential decay envelope
    const timeSeconds = i / sampleRate;
    const envelope = Math.exp(-decayRate * (i - startSample));

    // Additional high-frequency decay (frequency-dependent absorption)
    const hfEnvelope = Math.exp(-hfDecayRate * (i - startSample));

    // Generate noise (using pre-computed buffer with modulo for efficiency)
    const randIndex = i & 1023;
    let noiseL = randomBuffer[randIndex];
    let noiseR = randomBuffer[(randIndex + 512) & 1023];

    // Apply diffusion - more diffusion = denser reverb
    if (diffusion > 0.5) {
      // Add extra noise samples for increased density
      noiseL += randomBuffer[(randIndex + 256) & 1023] * (diffusion - 0.5) * 2;
      noiseR += randomBuffer[(randIndex + 768) & 1023] * (diffusion - 0.5) * 2;
    }

    // Apply frequency-dependent decay via simple lowpass
    const rawL = noiseL * envelope;
    const rawR = noiseR * envelope;

    // Blend between unfiltered and filtered based on HF envelope ratio
    const hfRatio = hfEnvelope / (envelope + 0.0001);
    lpStateL = lpStateL + lpCoeff * (rawL - lpStateL);
    lpStateR = lpStateR + lpCoeff * (rawR - lpStateR);

    const outputL = rawL * hfRatio + lpStateL * (1 - hfRatio);
    const outputR = rawR * hfRatio + lpStateR * (1 - hfRatio);

    // Add to existing early reflections
    left[i] += outputL * 0.5;
    right[i] += outputR * 0.5;
  }
}

/**
 * Normalize the buffer to prevent clipping
 */
function normalizeBuffer(buffer: AudioBuffer): void {
  let maxVal = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const absVal = Math.abs(data[i]);
      if (absVal > maxVal) maxVal = absVal;
    }
  }

  if (maxVal > 0) {
    const scale = 0.9 / maxVal; // Leave some headroom
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        data[i] *= scale;
      }
    }
  }
}

/**
 * ConvolutionReverbNode - Web Audio API based convolution reverb
 *
 * Creates a complete reverb unit with:
 * - Pre-delay using DelayNode
 * - ConvolverNode for reverb processing
 * - Wet/dry mix control
 */
export interface ConvolutionReverbNode {
  input: GainNode;
  output: GainNode;
  convolver: ConvolverNode;
  preDelayNode: DelayNode;
  bypass: boolean;
  mix: number;
  setWetDryMix: (mix: number) => void;
  setPreDelay: (ms: number) => void;
  setDecay: (seconds: number) => void;
  setRoomSize: (size: RoomSize) => void;
  setDamping: (damping: number) => void;
  setBypass: (bypass: boolean) => void;
  updateImpulseResponse: () => void;
  destroy: () => void;
}

/**
 * Create a convolution reverb node with all controls
 */
export function createConvolutionReverbNode(
  context: AudioContext,
  params: Partial<ConvolutionReverbParams> = {}
): ConvolutionReverbNode {
  // Default parameters
  const currentParams: ConvolutionReverbParams = {
    wetDryMix: params.wetDryMix ?? 0.3,
    decay: params.decay ?? 1.5,
    preDelay: params.preDelay ?? 10,
    roomSize: params.roomSize ?? 'medium',
    damping: params.damping ?? 0.5,
  };

  let _bypass = false;

  // Create nodes
  const input = context.createGain();
  const output = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const preDelayNode = context.createDelay(0.1); // Max 100ms pre-delay
  const convolver = context.createConvolver();

  // Set initial gain values
  dryGain.gain.value = 1 - currentParams.wetDryMix;
  wetGain.gain.value = currentParams.wetDryMix;
  preDelayNode.delayTime.value = currentParams.preDelay / 1000;

  // Generate initial impulse response
  convolver.buffer = generateImpulseResponse(
    context,
    currentParams.decay,
    currentParams.roomSize,
    currentParams.damping
  );

  // Signal routing:
  // input -> dryGain -> output (dry path)
  // input -> preDelayNode -> convolver -> wetGain -> output (wet path)

  input.connect(dryGain);
  dryGain.connect(output);

  input.connect(preDelayNode);
  preDelayNode.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);

  const updateImpulseResponse = () => {
    convolver.buffer = generateImpulseResponse(
      context,
      currentParams.decay,
      currentParams.roomSize,
      currentParams.damping
    );
  };

  return {
    input,
    output,
    convolver,
    preDelayNode,

    get bypass() {
      return _bypass;
    },

    get mix() {
      return currentParams.wetDryMix;
    },

    setWetDryMix(mix: number) {
      currentParams.wetDryMix = Math.max(0, Math.min(1, mix));
      dryGain.gain.setTargetAtTime(1 - currentParams.wetDryMix, context.currentTime, 0.01);
      wetGain.gain.setTargetAtTime(currentParams.wetDryMix, context.currentTime, 0.01);
    },

    setPreDelay(ms: number) {
      currentParams.preDelay = Math.max(0, Math.min(100, ms));
      preDelayNode.delayTime.setTargetAtTime(currentParams.preDelay / 1000, context.currentTime, 0.01);
    },

    setDecay(seconds: number) {
      currentParams.decay = Math.max(0.1, Math.min(10, seconds));
      updateImpulseResponse();
    },

    setRoomSize(size: RoomSize) {
      if (ROOM_PRESETS[size]) {
        currentParams.roomSize = size;
        updateImpulseResponse();
      }
    },

    setDamping(damping: number) {
      currentParams.damping = Math.max(0, Math.min(1, damping));
      updateImpulseResponse();
    },

    setBypass(bypass: boolean) {
      _bypass = bypass;
      if (bypass) {
        // Bypass: full dry, no wet
        dryGain.gain.setTargetAtTime(1, context.currentTime, 0.01);
        wetGain.gain.setTargetAtTime(0, context.currentTime, 0.01);
      } else {
        // Normal: restore mix values
        dryGain.gain.setTargetAtTime(1 - currentParams.wetDryMix, context.currentTime, 0.01);
        wetGain.gain.setTargetAtTime(currentParams.wetDryMix, context.currentTime, 0.01);
      }
    },

    updateImpulseResponse,

    destroy() {
      input.disconnect();
      output.disconnect();
      dryGain.disconnect();
      wetGain.disconnect();
      preDelayNode.disconnect();
      convolver.disconnect();
    },
  };
}

/**
 * ConvolutionReverbEffect class for compatibility with EffectNode interface
 * Used by the effect registry system
 */
export class ConvolutionReverbEffect {
  private _context: AudioContext;
  private _node: ConvolutionReverbNode;
  private _bypass: boolean = false;
  private _mix: number;
  private _params: ConvolutionReverbParams;

  constructor(context: AudioContext) {
    this._context = context;
    this._params = {
      wetDryMix: 0.3,
      decay: 1.5,
      preDelay: 10,
      roomSize: 'medium',
      damping: 0.5,
    };
    this._mix = this._params.wetDryMix;
    this._node = createConvolutionReverbNode(context, this._params);
  }

  get input(): AudioNode {
    return this._node.input;
  }

  get output(): AudioNode {
    return this._node.output;
  }

  get bypass(): boolean {
    return this._bypass;
  }

  get mix(): number {
    return this._mix;
  }

  get params(): ConvolutionReverbParams {
    return { ...this._params };
  }

  setBypass(bypass: boolean): void {
    this._bypass = bypass;
    this._node.setBypass(bypass);
  }

  setMix(mix: number): void {
    this._mix = Math.max(0, Math.min(1, mix));
    this._params.wetDryMix = this._mix;
    this._node.setWetDryMix(this._mix);
  }

  setWetDryMix(mix: number): void {
    this.setMix(mix);
  }

  setDecay(seconds: number): void {
    this._params.decay = Math.max(0.1, Math.min(10, seconds));
    this._node.setDecay(this._params.decay);
  }

  setPreDelay(ms: number): void {
    this._params.preDelay = Math.max(0, Math.min(100, ms));
    this._node.setPreDelay(this._params.preDelay);
  }

  setRoomSize(size: RoomSize): void {
    if (['small', 'medium', 'large', 'hall'].includes(size)) {
      this._params.roomSize = size;
      this._node.setRoomSize(size);
    }
  }

  setDamping(damping: number): void {
    this._params.damping = Math.max(0, Math.min(1, damping));
    this._node.setDamping(this._params.damping);
  }

  setAllParams(params: Partial<ConvolutionReverbParams & { mix?: number }>): void {
    if (params.wetDryMix !== undefined || params.mix !== undefined) {
      this.setMix(params.wetDryMix ?? params.mix ?? this._mix);
    }
    if (params.decay !== undefined) this.setDecay(params.decay);
    if (params.preDelay !== undefined) this.setPreDelay(params.preDelay);
    if (params.roomSize !== undefined) this.setRoomSize(params.roomSize);
    if (params.damping !== undefined) this.setDamping(params.damping);
  }

  destroy(): void {
    this._node.destroy();
  }
}

// Room size numerical mapping for registry compatibility
export const ROOM_SIZE_MAP: Record<number, RoomSize> = {
  0: 'small',
  1: 'medium',
  2: 'large',
  3: 'hall',
};

export const ROOM_SIZE_REVERSE_MAP: Record<RoomSize, number> = {
  small: 0,
  medium: 1,
  large: 2,
  hall: 3,
};
