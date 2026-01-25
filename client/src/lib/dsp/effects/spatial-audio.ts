/**
 * Spatial Audio Engine
 * HRTF-based binaural panning with room simulation
 *
 * Features:
 * - HRTF (Head-Related Transfer Function) based binaural panning
 * - ITD (Interaural Time Difference) and ILD (Interaural Level Difference)
 * - Distance attenuation with configurable rolloff
 * - Room simulation with early reflections
 * - Multiple room presets (small, medium, large, hall)
 * - Cone directivity for directional sources
 */

import { DelayLine } from '../delay-line';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type RoomType = 'small' | 'medium' | 'large' | 'hall';

export interface SpatialAudioParams {
  /** Horizontal angle in degrees (-180 to 180, 0 = front) */
  azimuth: number;
  /** Vertical angle in degrees (-90 to 90, 0 = ear level) */
  elevation: number;
  /** Distance in meters (0.1 to 100) */
  distance: number;
  /** Room type for reverb simulation */
  roomSize: RoomType;
  /** Wet/dry mix for reverb (0-1) */
  reverbMix: number;
  /** Distance rolloff factor (0.1 to 10) */
  rolloffFactor: number;
  /** Cone inner angle in degrees */
  coneInnerAngle: number;
  /** Cone outer angle in degrees */
  coneOuterAngle: number;
  /** Gain at cone outer angle (0-1) */
  coneOuterGain: number;
}

export interface RoomAcoustics {
  /** Room width in meters */
  width: number;
  /** Room depth in meters */
  depth: number;
  /** Room height in meters */
  height: number;
  /** Reverberation time in seconds (RT60) */
  rt60: number;
  /** Wall absorption coefficient (0-1) */
  wallAbsorption: number;
  /** Diffusion coefficient (0-1) */
  diffusion: number;
  /** Early reflection gain */
  reflectionGain: number;
}

interface EarlyReflection {
  delayMs: number;
  gainLeft: number;
  gainRight: number;
  lpfCoeff: number;
}

// ============================================================================
// Constants
// ============================================================================

const ROOM_ACOUSTICS: Record<RoomType, RoomAcoustics> = {
  small: {
    width: 4,
    depth: 5,
    height: 2.5,
    rt60: 0.3,
    wallAbsorption: 0.6,
    diffusion: 0.3,
    reflectionGain: 0.4,
  },
  medium: {
    width: 8,
    depth: 10,
    height: 3,
    rt60: 0.6,
    wallAbsorption: 0.4,
    diffusion: 0.5,
    reflectionGain: 0.5,
  },
  large: {
    width: 15,
    depth: 20,
    height: 5,
    rt60: 1.2,
    wallAbsorption: 0.3,
    diffusion: 0.7,
    reflectionGain: 0.6,
  },
  hall: {
    width: 25,
    depth: 40,
    height: 12,
    rt60: 2.0,
    wallAbsorption: 0.2,
    diffusion: 0.8,
    reflectionGain: 0.7,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Soft limiter to prevent clipping
 */
function limitValue(x: number): number {
  if (x > 1) return 1 - Math.exp(1 - x);
  if (x < -1) return -1 + Math.exp(-1 - x);
  return x;
}

/**
 * Calculate HRTF gains and ITD based on azimuth and elevation
 * Uses simplified HRTF model with ITD, ILD, and spectral cues
 */
function calculateHRTFGains(
  azimuth: number,
  elevation: number
): { left: number; right: number; itdMs: number } {
  // Convert to radians
  const azimuthRad = (azimuth * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;

  // Head radius approximation for ITD calculation (~8.75cm average)
  const headRadius = 0.0875;
  const speedOfSound = 343; // m/s at 20C

  // Interaural Time Difference (Woodworth formula)
  // ITD = (r/c) * (azimuth + sin(azimuth)) for |azimuth| < 90
  const sinAzimuth = Math.sin(Math.abs(azimuthRad));
  const itdSeconds = (headRadius / speedOfSound) * (Math.abs(azimuthRad) + sinAzimuth);
  const itdMs = itdSeconds * 1000;

  // Interaural Level Difference
  // ILD is frequency-dependent but we approximate with broadband values
  // Maximum ILD around 10-15 dB for sounds at 90 degrees
  const ildDb = 10 * Math.pow(sinAzimuth, 1.5);

  // Convert ILD to linear gains
  // If sound is to the right (positive azimuth), right ear is louder
  const ildLinear = Math.pow(10, ildDb / 20);

  let leftGain: number;
  let rightGain: number;

  if (azimuth >= 0) {
    // Sound is to the right
    rightGain = ildLinear / Math.sqrt(1 + ildLinear * ildLinear);
    leftGain = 1 / Math.sqrt(1 + ildLinear * ildLinear);
  } else {
    // Sound is to the left
    leftGain = ildLinear / Math.sqrt(1 + ildLinear * ildLinear);
    rightGain = 1 / Math.sqrt(1 + ildLinear * ildLinear);
  }

  // Elevation affects both ears similarly - sounds from above/below
  // are slightly attenuated due to pinna shadowing
  const elevationAttenuation = Math.cos(elevationRad * 0.7);
  leftGain *= elevationAttenuation;
  rightGain *= elevationAttenuation;

  return { left: leftGain, right: rightGain, itdMs };
}

/**
 * Calculate distance attenuation using inverse distance model
 * with configurable rolloff factor
 */
function calculateDistanceAttenuation(
  distance: number,
  rolloffFactor: number,
  refDistance: number = 1
): number {
  // Clamp minimum distance to prevent infinite gain
  const clampedDistance = Math.max(distance, 0.1);

  // Inverse distance model with rolloff
  // gain = refDistance / (refDistance + rolloff * (distance - refDistance))
  const denominator = refDistance + rolloffFactor * (clampedDistance - refDistance);
  const gain = refDistance / Math.max(denominator, 0.001);

  // Also add air absorption for very large distances
  // Approximately 0.1 dB per meter for high frequencies
  const airAbsorption = Math.exp(-0.002 * clampedDistance);

  return gain * airAbsorption;
}

/**
 * Generate early reflections based on room geometry and source position
 */
function generateEarlyReflections(
  azimuth: number,
  elevation: number,
  distance: number,
  room: RoomAcoustics,
  sampleRate: number
): EarlyReflection[] {
  const reflections: EarlyReflection[] = [];
  const speedOfSound = 343;

  // Convert spherical to cartesian for reflection calculations
  const azimuthRad = (azimuth * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;

  const sourceX = distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
  const sourceY = distance * Math.sin(elevationRad);
  const sourceZ = distance * Math.cos(elevationRad) * Math.cos(azimuthRad);

  // Listener at origin
  const listenerX = 0;
  const listenerY = 1.7; // Ear height
  const listenerZ = 0;

  // Room boundaries (centered on listener)
  const walls = [
    { name: 'left', normalX: 1, normalY: 0, normalZ: 0, dist: room.width / 2 },
    { name: 'right', normalX: -1, normalY: 0, normalZ: 0, dist: room.width / 2 },
    { name: 'front', normalX: 0, normalY: 0, normalZ: -1, dist: room.depth / 2 },
    { name: 'back', normalX: 0, normalY: 0, normalZ: 1, dist: room.depth / 2 },
    { name: 'floor', normalX: 0, normalY: 1, normalZ: 0, dist: listenerY },
    { name: 'ceiling', normalX: 0, normalY: -1, normalZ: 0, dist: room.height - listenerY },
  ];

  // Calculate first-order reflections from each wall
  for (const wall of walls) {
    // Mirror source position across wall
    const distToWall =
      wall.normalX * sourceX + wall.normalY * sourceY + wall.normalZ * sourceZ + wall.dist;

    if (distToWall < 0) continue; // Source is behind this wall

    const mirrorX = sourceX - 2 * distToWall * wall.normalX;
    const mirrorY = sourceY - 2 * distToWall * wall.normalY;
    const mirrorZ = sourceZ - 2 * distToWall * wall.normalZ;

    // Distance from listener to mirror source
    const dx = mirrorX - listenerX;
    const dy = mirrorY - listenerY;
    const dz = mirrorZ - listenerZ;
    const reflectionDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Delay in milliseconds
    const delayMs = (reflectionDistance / speedOfSound) * 1000;

    // Gain based on distance and wall absorption
    const distanceGain = 1 / Math.max(reflectionDistance, 0.1);
    const reflectionGain = distanceGain * room.reflectionGain * (1 - room.wallAbsorption);

    // Pan based on reflection angle
    const reflectionAzimuth = Math.atan2(dx, dz) * (180 / Math.PI);
    const { left, right } = calculateHRTFGains(reflectionAzimuth, 0);

    // Air absorption filter coefficient (higher = more absorption)
    const lpfCoeff = Math.min(0.95, 0.3 + reflectionDistance * 0.02);

    reflections.push({
      delayMs,
      gainLeft: reflectionGain * left,
      gainRight: reflectionGain * right,
      lpfCoeff,
    });
  }

  // Sort by delay time
  reflections.sort((a, b) => a.delayMs - b.delayMs);

  return reflections;
}

// ============================================================================
// SpatialAudioEffect Class (Sample-based processing)
// ============================================================================

/**
 * SpatialAudioEffect - Sample-by-sample spatial audio processor
 *
 * For use with AudioWorklet or offline processing where
 * Web Audio nodes are not available.
 */
export class SpatialAudioEffect {
  private params: SpatialAudioParams;
  private sampleRate: number;

  // HRTF processing state
  private leftGain: number = 1;
  private rightGain: number = 1;
  private itdSamples: number = 0;
  private distanceGain: number = 1;

  // ITD delay lines (one per channel)
  private leftDelayLine: DelayLine;
  private rightDelayLine: DelayLine;

  // Early reflections
  private reflections: EarlyReflection[] = [];
  private reflectionDelayLines: { left: DelayLine; right: DelayLine }[] = [];
  private reflectionLpfStates: { left: number; right: number }[] = [];

  // Front-back discrimination filter state
  private rearFilterStateL: number = 0;
  private rearFilterStateR: number = 0;

  // Simple reverb tail (feedback delay network approximation)
  private reverbDelayLines: DelayLine[] = [];
  private reverbState: number[] = [];
  private reverbFeedback: number = 0.7;

  constructor(sampleRate: number = 48000) {
    this.sampleRate = sampleRate;

    // Initialize ITD delay lines (max ~1ms ITD)
    this.leftDelayLine = new DelayLine(sampleRate, Math.ceil(sampleRate * 0.002));
    this.rightDelayLine = new DelayLine(sampleRate, Math.ceil(sampleRate * 0.002));

    // Initialize reflection delay lines (up to 100ms for large rooms)
    const maxReflectionSamples = Math.ceil(sampleRate * 0.1);
    for (let i = 0; i < 6; i++) {
      this.reflectionDelayLines.push({
        left: new DelayLine(sampleRate, maxReflectionSamples),
        right: new DelayLine(sampleRate, maxReflectionSamples),
      });
      this.reflectionLpfStates.push({ left: 0, right: 0 });
    }

    // Initialize reverb delay network (4 delay lines with prime number delays)
    for (let i = 0; i < 4; i++) {
      this.reverbDelayLines.push(new DelayLine(sampleRate, 4096));
      this.reverbState.push(0);
    }

    // Default parameters
    this.params = {
      azimuth: 0,
      elevation: 0,
      distance: 1,
      roomSize: 'medium',
      reverbMix: 0.3,
      rolloffFactor: 1,
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0,
    };

    this.updateInternalState();
  }

  setParams(params: Partial<SpatialAudioParams>): void {
    this.params = { ...this.params, ...params };
    this.updateInternalState();
  }

  getParams(): SpatialAudioParams {
    return { ...this.params };
  }

  private updateInternalState(): void {
    // Calculate HRTF gains
    const hrtf = calculateHRTFGains(this.params.azimuth, this.params.elevation);
    this.leftGain = hrtf.left;
    this.rightGain = hrtf.right;
    this.itdSamples = (hrtf.itdMs / 1000) * this.sampleRate;

    // Calculate distance attenuation
    this.distanceGain = calculateDistanceAttenuation(
      this.params.distance,
      this.params.rolloffFactor
    );

    // Generate early reflections
    const room = ROOM_ACOUSTICS[this.params.roomSize];
    this.reflections = generateEarlyReflections(
      this.params.azimuth,
      this.params.elevation,
      this.params.distance,
      room,
      this.sampleRate
    );

    // Update reverb characteristics
    const rt60 = room.rt60;
    this.reverbFeedback = Math.pow(10, -3 * (0.05 / rt60));
  }

  /**
   * Process a single mono sample through spatial processing
   * Returns stereo output [left, right]
   */
  processMono(input: number): [number, number] {
    // Apply distance attenuation
    const attenuated = input * this.distanceGain;

    // Write to both ITD delay lines
    this.leftDelayLine.write(attenuated);
    this.rightDelayLine.write(attenuated);

    // Read with ITD (interaural time difference)
    let leftSample: number;
    let rightSample: number;

    if (this.params.azimuth >= 0) {
      leftSample = this.leftDelayLine.read(1 + this.itdSamples) * this.leftGain;
      rightSample = this.rightDelayLine.read(1) * this.rightGain;
    } else {
      leftSample = this.leftDelayLine.read(1) * this.leftGain;
      rightSample = this.rightDelayLine.read(1 + this.itdSamples) * this.rightGain;
    }

    // Apply front-back filter (rear sounds are darker)
    if (Math.abs(this.params.azimuth) > 90) {
      const rearFilterCoeff = 0.3;
      this.rearFilterStateL = this.rearFilterStateL + rearFilterCoeff * (leftSample - this.rearFilterStateL);
      this.rearFilterStateR = this.rearFilterStateR + rearFilterCoeff * (rightSample - this.rearFilterStateR);
      const rearBlend = (Math.abs(this.params.azimuth) - 90) / 90;
      leftSample = leftSample * (1 - rearBlend) + this.rearFilterStateL * rearBlend;
      rightSample = rightSample * (1 - rearBlend) + this.rearFilterStateR * rearBlend;
    }

    // Process early reflections
    let reflectionLeft = 0;
    let reflectionRight = 0;

    for (let i = 0; i < Math.min(this.reflections.length, 6); i++) {
      const ref = this.reflections[i];
      const delayLine = this.reflectionDelayLines[i];
      const lpfState = this.reflectionLpfStates[i];

      delayLine.left.write(attenuated);
      delayLine.right.write(attenuated);

      const delaySamples = (ref.delayMs / 1000) * this.sampleRate;
      let refL = delayLine.left.read(1 + delaySamples) * ref.gainLeft;
      let refR = delayLine.right.read(1 + delaySamples) * ref.gainRight;

      lpfState.left = lpfState.left + ref.lpfCoeff * (refL - lpfState.left);
      lpfState.right = lpfState.right + ref.lpfCoeff * (refR - lpfState.right);
      refL = lpfState.left;
      refR = lpfState.right;

      reflectionLeft += refL;
      reflectionRight += refR;
    }

    // Simple diffuse reverb using feedback delay network
    let reverbInput = (leftSample + rightSample) * 0.5;
    let reverbOut = 0;

    const primeDelays = [23, 31, 37, 41];
    for (let i = 0; i < 4; i++) {
      const delay = primeDelays[i] * 10;
      this.reverbDelayLines[i].write(reverbInput + this.reverbState[i] * this.reverbFeedback);
      this.reverbState[i] = this.reverbDelayLines[i].read(delay);
      reverbOut += this.reverbState[i];
      reverbInput += this.reverbState[i] * 0.1;
    }
    reverbOut *= 0.25;

    // Mix dry signal, reflections, and reverb
    const dryMix = 1 - this.params.reverbMix;
    const wetMix = this.params.reverbMix;

    const outputLeft = limitValue(
      leftSample * dryMix + (reflectionLeft + reverbOut) * wetMix
    );
    const outputRight = limitValue(
      rightSample * dryMix + (reflectionRight + reverbOut) * wetMix
    );

    return [outputLeft, outputRight];
  }

  processBlock(input: Float32Array, outputLeft: Float32Array, outputRight: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      const [left, right] = this.processMono(input[i]);
      outputLeft[i] = left;
      outputRight[i] = right;
    }
  }

  processStereo(
    inputLeft: Float32Array,
    inputRight: Float32Array,
    outputLeft: Float32Array,
    outputRight: Float32Array
  ): void {
    for (let i = 0; i < inputLeft.length; i++) {
      const mono = (inputLeft[i] + inputRight[i]) * 0.5;
      const [left, right] = this.processMono(mono);
      outputLeft[i] = left;
      outputRight[i] = right;
    }
  }

  reset(): void {
    this.leftDelayLine.clear();
    this.rightDelayLine.clear();

    for (const dl of this.reflectionDelayLines) {
      dl.left.clear();
      dl.right.clear();
    }
    for (const state of this.reflectionLpfStates) {
      state.left = 0;
      state.right = 0;
    }

    for (const dl of this.reverbDelayLines) {
      dl.clear();
    }
    this.reverbState.fill(0);

    this.rearFilterStateL = 0;
    this.rearFilterStateR = 0;
  }
}

// ============================================================================
// SpatialAudioNode Interface (Web Audio API)
// ============================================================================

export interface SpatialAudioNode {
  input: GainNode;
  output: GainNode;
  panner: PannerNode;
  convolver: ConvolverNode | null;
  bypass: boolean;

  setAzimuth: (degrees: number) => void;
  setElevation: (degrees: number) => void;
  setDistance: (meters: number) => void;
  setPosition: (azimuth: number, elevation: number, distance: number) => void;
  setRoomSize: (size: RoomType) => void;
  setReverbMix: (mix: number) => void;
  setRolloffFactor: (factor: number) => void;
  setConeAngles: (innerAngle: number, outerAngle: number, outerGain: number) => void;
  setBypass: (bypass: boolean) => void;
  getParams: () => SpatialAudioParams;
  destroy: () => void;
}

// ============================================================================
// Web Audio Node Factory
// ============================================================================

export function createSpatialAudioNode(
  context: AudioContext,
  initialParams: Partial<SpatialAudioParams> = {}
): SpatialAudioNode {
  const params: SpatialAudioParams = {
    azimuth: initialParams.azimuth ?? 0,
    elevation: initialParams.elevation ?? 0,
    distance: initialParams.distance ?? 1,
    roomSize: initialParams.roomSize ?? 'medium',
    reverbMix: initialParams.reverbMix ?? 0.3,
    rolloffFactor: initialParams.rolloffFactor ?? 1,
    coneInnerAngle: initialParams.coneInnerAngle ?? 360,
    coneOuterAngle: initialParams.coneOuterAngle ?? 360,
    coneOuterGain: initialParams.coneOuterGain ?? 0,
  };

  let _bypass = false;

  const input = context.createGain();
  const output = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();

  // HRTF Panner - the core of spatial processing
  const panner = context.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = params.rolloffFactor;
  panner.coneInnerAngle = params.coneInnerAngle;
  panner.coneOuterAngle = params.coneOuterAngle;
  panner.coneOuterGain = params.coneOuterGain;

  function updatePannerPosition(
    pannerNode: PannerNode,
    azimuth: number,
    elevation: number,
    distance: number
  ): void {
    const azimuthRad = (azimuth * Math.PI) / 180;
    const elevationRad = (elevation * Math.PI) / 180;

    const x = distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
    const y = distance * Math.sin(elevationRad);
    const z = -distance * Math.cos(elevationRad) * Math.cos(azimuthRad);

    if (pannerNode.positionX) {
      pannerNode.positionX.setValueAtTime(x, context.currentTime);
      pannerNode.positionY.setValueAtTime(y, context.currentTime);
      pannerNode.positionZ.setValueAtTime(z, context.currentTime);
    } else {
      (pannerNode as any).setPosition(x, y, z);
    }
  }

  updatePannerPosition(panner, params.azimuth, params.elevation, params.distance);

  // Room convolver for reverb
  function generateRoomIR(roomType: RoomType): AudioBuffer {
    const room = ROOM_ACOUSTICS[roomType];
    const sampleRate = context.sampleRate;
    const irLength = Math.ceil(sampleRate * Math.min(room.rt60 * 2, 6));
    const buffer = context.createBuffer(2, irLength, sampleRate);
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    const earlyReflections = generateEarlyReflections(
      params.azimuth, params.elevation, params.distance, room, sampleRate
    );

    for (const ref of earlyReflections) {
      const sampleIndex = Math.floor((ref.delayMs / 1000) * sampleRate);
      if (sampleIndex < irLength) {
        leftChannel[sampleIndex] += ref.gainLeft;
        rightChannel[sampleIndex] += ref.gainRight;
      }
    }

    const decayRate = -Math.log(0.001) / (room.rt60 * sampleRate);
    const startSample = Math.floor(room.rt60 * 0.05 * sampleRate);
    let lpStateL = 0, lpStateR = 0;
    const lpCoeff = 0.4 + room.wallAbsorption * 0.4;

    for (let i = startSample; i < irLength; i++) {
      const envelope = Math.exp(-decayRate * (i - startSample));
      const noiseL = (Math.random() * 2 - 1) * envelope;
      const noiseR = (Math.random() * 2 - 1) * envelope;
      lpStateL = lpStateL + lpCoeff * (noiseL - lpStateL);
      lpStateR = lpStateR + lpCoeff * (noiseR - lpStateR);
      leftChannel[i] += lpStateL * room.diffusion * 0.3;
      rightChannel[i] += lpStateR * room.diffusion * 0.3;
    }

    let maxVal = 0;
    for (let i = 0; i < irLength; i++) {
      maxVal = Math.max(maxVal, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
    }
    if (maxVal > 0) {
      const scale = 0.8 / maxVal;
      for (let i = 0; i < irLength; i++) {
        leftChannel[i] *= scale;
        rightChannel[i] *= scale;
      }
    }

    return buffer;
  }

  const convolver = context.createConvolver();
  convolver.buffer = generateRoomIR(params.roomSize);

  dryGain.gain.value = 1 - params.reverbMix;
  wetGain.gain.value = params.reverbMix;

  input.connect(panner);
  panner.connect(dryGain);
  dryGain.connect(output);
  panner.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);

  return {
    input,
    output,
    panner,
    convolver,

    get bypass() { return _bypass; },

    setAzimuth(degrees: number) {
      params.azimuth = Math.max(-180, Math.min(180, degrees));
      updatePannerPosition(panner, params.azimuth, params.elevation, params.distance);
    },

    setElevation(degrees: number) {
      params.elevation = Math.max(-90, Math.min(90, degrees));
      updatePannerPosition(panner, params.azimuth, params.elevation, params.distance);
    },

    setDistance(meters: number) {
      params.distance = Math.max(0.1, Math.min(100, meters));
      updatePannerPosition(panner, params.azimuth, params.elevation, params.distance);
    },

    setPosition(azimuth: number, elevation: number, distance: number) {
      params.azimuth = Math.max(-180, Math.min(180, azimuth));
      params.elevation = Math.max(-90, Math.min(90, elevation));
      params.distance = Math.max(0.1, Math.min(100, distance));
      updatePannerPosition(panner, params.azimuth, params.elevation, params.distance);
    },

    setRoomSize(size: RoomType) {
      if (ROOM_ACOUSTICS[size]) {
        params.roomSize = size;
        convolver.buffer = generateRoomIR(size);
      }
    },

    setReverbMix(mix: number) {
      params.reverbMix = Math.max(0, Math.min(1, mix));
      dryGain.gain.setTargetAtTime(1 - params.reverbMix, context.currentTime, 0.02);
      wetGain.gain.setTargetAtTime(params.reverbMix, context.currentTime, 0.02);
    },

    setRolloffFactor(factor: number) {
      params.rolloffFactor = Math.max(0.1, Math.min(10, factor));
      panner.rolloffFactor = params.rolloffFactor;
    },

    setConeAngles(innerAngle: number, outerAngle: number, outerGain: number) {
      params.coneInnerAngle = Math.max(0, Math.min(360, innerAngle));
      params.coneOuterAngle = Math.max(0, Math.min(360, outerAngle));
      params.coneOuterGain = Math.max(0, Math.min(1, outerGain));
      panner.coneInnerAngle = params.coneInnerAngle;
      panner.coneOuterAngle = params.coneOuterAngle;
      panner.coneOuterGain = params.coneOuterGain;
    },

    setBypass(bypass: boolean) {
      _bypass = bypass;
      if (bypass) {
        dryGain.gain.setTargetAtTime(1, context.currentTime, 0.02);
        wetGain.gain.setTargetAtTime(0, context.currentTime, 0.02);
        panner.rolloffFactor = 0;
      } else {
        dryGain.gain.setTargetAtTime(1 - params.reverbMix, context.currentTime, 0.02);
        wetGain.gain.setTargetAtTime(params.reverbMix, context.currentTime, 0.02);
        panner.rolloffFactor = params.rolloffFactor;
      }
    },

    getParams() { return { ...params }; },

    destroy() {
      input.disconnect();
      output.disconnect();
      panner.disconnect();
      dryGain.disconnect();
      wetGain.disconnect();
      convolver.disconnect();
    },
  };
}

// ============================================================================
// SpatialAudioProcessor Class (EffectNode compatible)
// ============================================================================

export class SpatialAudioProcessor {
  private _context: AudioContext;
  private _node: SpatialAudioNode;
  private _bypass: boolean = false;
  private _params: SpatialAudioParams;

  constructor(context: AudioContext) {
    this._context = context;
    this._params = {
      azimuth: 0, elevation: 0, distance: 1, roomSize: 'medium',
      reverbMix: 0.3, rolloffFactor: 1, coneInnerAngle: 360,
      coneOuterAngle: 360, coneOuterGain: 0,
    };
    this._node = createSpatialAudioNode(context, this._params);
  }

  get input(): AudioNode { return this._node.input; }
  get output(): AudioNode { return this._node.output; }
  get bypass(): boolean { return this._bypass; }
  get params(): SpatialAudioParams { return { ...this._params }; }

  setBypass(bypass: boolean): void {
    this._bypass = bypass;
    this._node.setBypass(bypass);
  }

  setAzimuth(degrees: number): void {
    this._params.azimuth = Math.max(-180, Math.min(180, degrees));
    this._node.setAzimuth(this._params.azimuth);
  }

  setElevation(degrees: number): void {
    this._params.elevation = Math.max(-90, Math.min(90, degrees));
    this._node.setElevation(this._params.elevation);
  }

  setDistance(meters: number): void {
    this._params.distance = Math.max(0.1, Math.min(100, meters));
    this._node.setDistance(this._params.distance);
  }

  setPosition(azimuth: number, elevation: number, distance: number): void {
    this._params.azimuth = Math.max(-180, Math.min(180, azimuth));
    this._params.elevation = Math.max(-90, Math.min(90, elevation));
    this._params.distance = Math.max(0.1, Math.min(100, distance));
    this._node.setPosition(this._params.azimuth, this._params.elevation, this._params.distance);
  }

  setRoomSize(size: RoomType): void {
    if (['small', 'medium', 'large', 'hall'].includes(size)) {
      this._params.roomSize = size;
      this._node.setRoomSize(size);
    }
  }

  setReverbMix(mix: number): void {
    this._params.reverbMix = Math.max(0, Math.min(1, mix));
    this._node.setReverbMix(this._params.reverbMix);
  }

  setRolloffFactor(factor: number): void {
    this._params.rolloffFactor = Math.max(0.1, Math.min(10, factor));
    this._node.setRolloffFactor(this._params.rolloffFactor);
  }

  setConeAngles(innerAngle: number, outerAngle: number, outerGain: number): void {
    this._params.coneInnerAngle = Math.max(0, Math.min(360, innerAngle));
    this._params.coneOuterAngle = Math.max(0, Math.min(360, outerAngle));
    this._params.coneOuterGain = Math.max(0, Math.min(1, outerGain));
    this._node.setConeAngles(
      this._params.coneInnerAngle, this._params.coneOuterAngle, this._params.coneOuterGain
    );
  }

  setAllParams(newParams: Partial<SpatialAudioParams>): void {
    if (newParams.azimuth !== undefined) this.setAzimuth(newParams.azimuth);
    if (newParams.elevation !== undefined) this.setElevation(newParams.elevation);
    if (newParams.distance !== undefined) this.setDistance(newParams.distance);
    if (newParams.roomSize !== undefined) this.setRoomSize(newParams.roomSize);
    if (newParams.reverbMix !== undefined) this.setReverbMix(newParams.reverbMix);
    if (newParams.rolloffFactor !== undefined) this.setRolloffFactor(newParams.rolloffFactor);
    if (newParams.coneInnerAngle !== undefined || newParams.coneOuterAngle !== undefined || newParams.coneOuterGain !== undefined) {
      this.setConeAngles(
        newParams.coneInnerAngle ?? this._params.coneInnerAngle,
        newParams.coneOuterAngle ?? this._params.coneOuterAngle,
        newParams.coneOuterGain ?? this._params.coneOuterGain
      );
    }
  }

  destroy(): void { this._node.destroy(); }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function sphericalToCartesian(azimuth: number, elevation: number, distance: number): { x: number; y: number; z: number } {
  const azimuthRad = (azimuth * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;
  return {
    x: distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
    y: distance * Math.sin(elevationRad),
    z: -distance * Math.cos(elevationRad) * Math.cos(azimuthRad),
  };
}

export function cartesianToSpherical(x: number, y: number, z: number): { azimuth: number; elevation: number; distance: number } {
  const distance = Math.sqrt(x * x + y * y + z * z);
  const azimuth = Math.atan2(x, -z) * (180 / Math.PI);
  const elevation = Math.asin(y / Math.max(distance, 0.001)) * (180 / Math.PI);
  return { azimuth, elevation, distance };
}

export const ROOM_TYPE_MAP: Record<number, RoomType> = { 0: 'small', 1: 'medium', 2: 'large', 3: 'hall' };
export const ROOM_TYPE_REVERSE_MAP: Record<RoomType, number> = { small: 0, medium: 1, large: 2, hall: 3 };
