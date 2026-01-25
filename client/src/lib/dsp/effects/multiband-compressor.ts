/**
 * Multi-band Compressor Effect
 *
 * Professional multi-band dynamics processor using Linkwitz-Riley
 * crossover filters (24dB/octave) with independent compression per band.
 *
 * Features:
 * - 4-band design with configurable crossover frequencies
 * - Linkwitz-Riley 4th-order crossovers (24dB/octave, flat summing)
 * - Independent threshold, ratio, attack, release, makeup per band
 * - Per-band gain reduction metering
 * - Input/output gain and wet/dry mix controls
 * - Solo and bypass per band
 */

export interface MultibandCompressorBandParams {
  threshold: number;   // -60 to 0 dB
  ratio: number;       // 1 to 20
  attack: number;      // 0.1 to 100 ms
  release: number;     // 10 to 1000 ms
  makeupGain: number;  // -12 to +12 dB
  solo: boolean;       // Solo this band
  mute: boolean;       // Mute this band
}

export interface MultibandCompressorParams {
  // Crossover frequencies (3 frequencies for 4 bands)
  crossover1: number;  // Low/LowMid split (20-500 Hz)
  crossover2: number;  // LowMid/HighMid split (200-4000 Hz)
  crossover3: number;  // HighMid/High split (2000-16000 Hz)

  // Global controls
  inputGain: number;   // -12 to +12 dB
  outputGain: number;  // -12 to +12 dB
  mix: number;         // 0-1 wet/dry

  // Per-band parameters
  bands: MultibandCompressorBandParams[];
}

export interface BandMeterData {
  gainReduction: number;  // dB
  inputLevel: number;     // dB
  outputLevel: number;    // dB
}

export interface MultibandCompressorMeterData {
  bands: BandMeterData[];
  inputLevel: number;     // dB (overall)
  outputLevel: number;    // dB (overall)
}

// Default band parameters
const DEFAULT_BAND_PARAMS: MultibandCompressorBandParams = {
  threshold: -20,
  ratio: 4,
  attack: 10,
  release: 100,
  makeupGain: 0,
  solo: false,
  mute: false,
};

// Default crossover frequencies for 4 bands
const DEFAULT_CROSSOVERS = {
  crossover1: 200,   // Low band: 0-200 Hz
  crossover2: 1200,  // Low-Mid band: 200-1200 Hz
  crossover3: 5000,  // High-Mid band: 1200-5000 Hz
                     // High band: 5000+ Hz
};

/**
 * Linkwitz-Riley 4th-order crossover filter coefficients
 * Implemented as cascaded 2nd-order Butterworth sections
 */
interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function calcButterworthLPF(fc: number, sampleRate: number): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * 0.7071); // Q = 0.7071 for Butterworth

  const a0 = 1 + alpha;
  return {
    b0: ((1 - cosW0) / 2) / a0,
    b1: (1 - cosW0) / a0,
    b2: ((1 - cosW0) / 2) / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function calcButterworthHPF(fc: number, sampleRate: number): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * 0.7071); // Q = 0.7071 for Butterworth

  const a0 = 1 + alpha;
  return {
    b0: ((1 + cosW0) / 2) / a0,
    b1: (-(1 + cosW0)) / a0,
    b2: ((1 + cosW0) / 2) / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  };
}

/**
 * Biquad filter state (Direct Form II Transposed)
 */
class BiquadFilter {
  private z1 = 0;
  private z2 = 0;
  private coeffs: BiquadCoeffs;

  constructor(coeffs: BiquadCoeffs) {
    this.coeffs = coeffs;
  }

  setCoeffs(coeffs: BiquadCoeffs): void {
    this.coeffs = coeffs;
  }

  process(x: number): number {
    const y = this.coeffs.b0 * x + this.z1;
    this.z1 = this.coeffs.b1 * x - this.coeffs.a1 * y + this.z2;
    this.z2 = this.coeffs.b2 * x - this.coeffs.a2 * y;
    return y;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }
}

/**
 * Linkwitz-Riley 4th-order crossover (24dB/octave)
 * Cascades two 2nd-order Butterworth filters
 */
class LR4CrossoverFilter {
  private lpf1: BiquadFilter;
  private lpf2: BiquadFilter;
  private hpf1: BiquadFilter;
  private hpf2: BiquadFilter;

  constructor(fc: number, sampleRate: number) {
    const lpfCoeffs = calcButterworthLPF(fc, sampleRate);
    const hpfCoeffs = calcButterworthHPF(fc, sampleRate);

    this.lpf1 = new BiquadFilter(lpfCoeffs);
    this.lpf2 = new BiquadFilter(lpfCoeffs);
    this.hpf1 = new BiquadFilter(hpfCoeffs);
    this.hpf2 = new BiquadFilter(hpfCoeffs);
  }

  setFrequency(fc: number, sampleRate: number): void {
    const lpfCoeffs = calcButterworthLPF(fc, sampleRate);
    const hpfCoeffs = calcButterworthHPF(fc, sampleRate);

    this.lpf1.setCoeffs(lpfCoeffs);
    this.lpf2.setCoeffs(lpfCoeffs);
    this.hpf1.setCoeffs(hpfCoeffs);
    this.hpf2.setCoeffs(hpfCoeffs);
  }

  processLow(x: number): number {
    return this.lpf2.process(this.lpf1.process(x));
  }

  processHigh(x: number): number {
    return this.hpf2.process(this.hpf1.process(x));
  }

  reset(): void {
    this.lpf1.reset();
    this.lpf2.reset();
    this.hpf1.reset();
    this.hpf2.reset();
  }
}

/**
 * Per-band compressor with envelope follower
 */
class BandCompressor {
  private envelope = 0;
  private gainReduction = 1;
  private sampleRate: number;
  private _params: MultibandCompressorBandParams;

  // Metering
  private inputPeak = 0;
  private outputPeak = 0;
  private grMin = 0;
  private meterDecay = 0.9995;

  constructor(sampleRate: number, params: MultibandCompressorBandParams = { ...DEFAULT_BAND_PARAMS }) {
    this.sampleRate = sampleRate;
    this._params = { ...params };
  }

  get params(): MultibandCompressorBandParams {
    return { ...this._params };
  }

  setParams(params: Partial<MultibandCompressorBandParams>): void {
    if (params.threshold !== undefined) {
      this._params.threshold = Math.max(-60, Math.min(0, params.threshold));
    }
    if (params.ratio !== undefined) {
      this._params.ratio = Math.max(1, Math.min(20, params.ratio));
    }
    if (params.attack !== undefined) {
      this._params.attack = Math.max(0.1, Math.min(100, params.attack));
    }
    if (params.release !== undefined) {
      this._params.release = Math.max(10, Math.min(1000, params.release));
    }
    if (params.makeupGain !== undefined) {
      this._params.makeupGain = Math.max(-12, Math.min(12, params.makeupGain));
    }
    if (params.solo !== undefined) {
      this._params.solo = params.solo;
    }
    if (params.mute !== undefined) {
      this._params.mute = params.mute;
    }
  }

  process(sample: number): number {
    // Track input peak
    const absSample = Math.abs(sample);
    this.inputPeak = Math.max(absSample, this.inputPeak * this.meterDecay);

    if (this._params.mute) {
      return 0;
    }

    // Convert parameters
    const threshold = Math.pow(10, this._params.threshold / 20);
    const makeupGain = Math.pow(10, this._params.makeupGain / 20);
    const attackCoeff = Math.exp(-1 / (this._params.attack * this.sampleRate / 1000));
    const releaseCoeff = Math.exp(-1 / (this._params.release * this.sampleRate / 1000));

    // Envelope follower
    if (absSample > this.envelope) {
      this.envelope = attackCoeff * this.envelope + (1 - attackCoeff) * absSample;
    } else {
      this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * absSample;
    }

    // Calculate gain reduction
    let gain = 1;
    if (this.envelope > threshold) {
      const overDb = 20 * Math.log10(this.envelope / threshold);
      const reductionDb = overDb * (1 - 1 / this._params.ratio);
      gain = Math.pow(10, -reductionDb / 20);
    }

    // Smooth gain changes
    this.gainReduction = 0.999 * this.gainReduction + 0.001 * gain;

    // Track minimum gain reduction
    this.grMin = Math.min(this.grMin, this.gainReduction);

    // Apply compression and makeup gain
    const output = sample * this.gainReduction * makeupGain;

    // Track output peak
    this.outputPeak = Math.max(Math.abs(output), this.outputPeak * this.meterDecay);

    return output;
  }

  getMeterData(): BandMeterData {
    const data: BandMeterData = {
      gainReduction: 20 * Math.log10(Math.max(this.grMin, 1e-10)),
      inputLevel: 20 * Math.log10(Math.max(this.inputPeak, 1e-10)),
      outputLevel: 20 * Math.log10(Math.max(this.outputPeak, 1e-10)),
    };
    // Reset peak hold after reading
    this.grMin = this.gainReduction;
    return data;
  }

  reset(): void {
    this.envelope = 0;
    this.gainReduction = 1;
    this.inputPeak = 0;
    this.outputPeak = 0;
    this.grMin = 0;
  }
}

/**
 * MultibandCompressorNode - Main multiband compressor implementation
 * Uses Web Audio API nodes for routing
 */
export interface MultibandCompressorNode {
  input: GainNode;
  output: GainNode;
  bypass: boolean;
  mix: number;
  setBypass: (bypass: boolean) => void;
  setMix: (mix: number) => void;
  setInputGain: (gain: number) => void;
  setOutputGain: (gain: number) => void;
  setCrossover: (index: number, freq: number) => void;
  setBandParams: (bandIndex: number, params: Partial<MultibandCompressorBandParams>) => void;
  getMeterData: () => MultibandCompressorMeterData;
  getParams: () => MultibandCompressorParams;
  destroy: () => void;
}

/**
 * Create a multiband compressor using ScriptProcessorNode for DSP
 * Note: This uses ScriptProcessorNode as AudioWorkletNode requires separate file loading
 * For production, this should be migrated to AudioWorklet
 */
export function createMultibandCompressorNode(
  context: AudioContext,
  params: Partial<MultibandCompressorParams> = {}
): MultibandCompressorNode {
  const sampleRate = context.sampleRate;

  // Initialize parameters
  const currentParams: MultibandCompressorParams = {
    crossover1: params.crossover1 ?? DEFAULT_CROSSOVERS.crossover1,
    crossover2: params.crossover2 ?? DEFAULT_CROSSOVERS.crossover2,
    crossover3: params.crossover3 ?? DEFAULT_CROSSOVERS.crossover3,
    inputGain: params.inputGain ?? 0,
    outputGain: params.outputGain ?? 0,
    mix: params.mix ?? 1,
    bands: params.bands ?? [
      { ...DEFAULT_BAND_PARAMS },
      { ...DEFAULT_BAND_PARAMS },
      { ...DEFAULT_BAND_PARAMS },
      { ...DEFAULT_BAND_PARAMS },
    ],
  };

  let _bypass = false;

  // Create audio nodes
  const input = context.createGain();
  const output = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const inputGainNode = context.createGain();
  const outputGainNode = context.createGain();

  // Set initial gains
  inputGainNode.gain.value = Math.pow(10, currentParams.inputGain / 20);
  outputGainNode.gain.value = Math.pow(10, currentParams.outputGain / 20);
  dryGain.gain.value = 1 - currentParams.mix;
  wetGain.gain.value = currentParams.mix;

  // Create crossover filters for each channel (stereo)
  const crossoversL = [
    new LR4CrossoverFilter(currentParams.crossover1, sampleRate),
    new LR4CrossoverFilter(currentParams.crossover2, sampleRate),
    new LR4CrossoverFilter(currentParams.crossover3, sampleRate),
  ];
  const crossoversR = [
    new LR4CrossoverFilter(currentParams.crossover1, sampleRate),
    new LR4CrossoverFilter(currentParams.crossover2, sampleRate),
    new LR4CrossoverFilter(currentParams.crossover3, sampleRate),
  ];

  // Create band compressors (stereo pairs)
  const compressorsL = currentParams.bands.map(
    (bandParams) => new BandCompressor(sampleRate, bandParams)
  );
  const compressorsR = currentParams.bands.map(
    (bandParams) => new BandCompressor(sampleRate, bandParams)
  );

  // Overall level metering
  let overallInputPeak = 0;
  let overallOutputPeak = 0;
  const meterDecay = 0.9995;

  // Create ScriptProcessorNode for DSP processing
  const bufferSize = 512;
  const processor = context.createScriptProcessor(bufferSize, 2, 2);

  processor.onaudioprocess = (event) => {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.getChannelData(1);
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);

    // Check if any band is soloed
    const hasSolo = compressorsL.some((c, i) => currentParams.bands[i].solo);

    for (let i = 0; i < bufferSize; i++) {
      const sampleL = inputL[i];
      const sampleR = inputR[i];

      // Track input level
      overallInputPeak = Math.max(
        Math.abs(sampleL),
        Math.abs(sampleR),
        overallInputPeak * meterDecay
      );

      if (_bypass) {
        outputL[i] = sampleL;
        outputR[i] = sampleR;
        continue;
      }

      // Split into 4 bands using crossovers
      // Band 0: Low (below crossover1)
      // Band 1: Low-Mid (crossover1 to crossover2)
      // Band 2: High-Mid (crossover2 to crossover3)
      // Band 3: High (above crossover3)

      // First crossover: split low from rest
      const lowL = crossoversL[0].processLow(sampleL);
      const lowR = crossoversR[0].processLow(sampleR);
      const restL1 = crossoversL[0].processHigh(sampleL);
      const restR1 = crossoversR[0].processHigh(sampleR);

      // Second crossover: split low-mid from upper bands
      const lowMidL = crossoversL[1].processLow(restL1);
      const lowMidR = crossoversR[1].processLow(restR1);
      const restL2 = crossoversL[1].processHigh(restL1);
      const restR2 = crossoversR[1].processHigh(restR1);

      // Third crossover: split high-mid from high
      const highMidL = crossoversL[2].processLow(restL2);
      const highMidR = crossoversR[2].processLow(restR2);
      const highL = crossoversL[2].processHigh(restL2);
      const highR = crossoversR[2].processHigh(restR2);

      // Process each band through its compressor
      const bands = [
        { l: lowL, r: lowR },
        { l: lowMidL, r: lowMidR },
        { l: highMidL, r: highMidR },
        { l: highL, r: highR },
      ];

      let sumL = 0;
      let sumR = 0;

      for (let b = 0; b < 4; b++) {
        const compL = compressorsL[b].process(bands[b].l);
        const compR = compressorsR[b].process(bands[b].r);

        // Apply solo/mute logic
        if (hasSolo) {
          if (currentParams.bands[b].solo) {
            sumL += compL;
            sumR += compR;
          }
        } else if (!currentParams.bands[b].mute) {
          sumL += compL;
          sumR += compR;
        }
      }

      // Track output level
      overallOutputPeak = Math.max(
        Math.abs(sumL),
        Math.abs(sumR),
        overallOutputPeak * meterDecay
      );

      outputL[i] = sumL;
      outputR[i] = sumR;
    }
  };

  // Signal routing
  input.connect(dryGain);
  dryGain.connect(output);

  input.connect(inputGainNode);
  inputGainNode.connect(processor);
  processor.connect(outputGainNode);
  outputGainNode.connect(wetGain);
  wetGain.connect(output);

  return {
    input,
    output,

    get bypass() {
      return _bypass;
    },

    get mix() {
      return currentParams.mix;
    },

    setBypass(bypass: boolean) {
      _bypass = bypass;
      if (bypass) {
        dryGain.gain.setTargetAtTime(1, context.currentTime, 0.01);
        wetGain.gain.setTargetAtTime(0, context.currentTime, 0.01);
      } else {
        dryGain.gain.setTargetAtTime(1 - currentParams.mix, context.currentTime, 0.01);
        wetGain.gain.setTargetAtTime(currentParams.mix, context.currentTime, 0.01);
      }
    },

    setMix(mix: number) {
      currentParams.mix = Math.max(0, Math.min(1, mix));
      if (!_bypass) {
        dryGain.gain.setTargetAtTime(1 - currentParams.mix, context.currentTime, 0.01);
        wetGain.gain.setTargetAtTime(currentParams.mix, context.currentTime, 0.01);
      }
    },

    setInputGain(gain: number) {
      currentParams.inputGain = Math.max(-12, Math.min(12, gain));
      inputGainNode.gain.setTargetAtTime(
        Math.pow(10, currentParams.inputGain / 20),
        context.currentTime,
        0.01
      );
    },

    setOutputGain(gain: number) {
      currentParams.outputGain = Math.max(-12, Math.min(12, gain));
      outputGainNode.gain.setTargetAtTime(
        Math.pow(10, currentParams.outputGain / 20),
        context.currentTime,
        0.01
      );
    },

    setCrossover(index: number, freq: number) {
      if (index < 0 || index > 2) return;

      // Validate and clamp frequency
      const minFreqs = [20, 200, 2000];
      const maxFreqs = [500, 4000, 16000];
      const clampedFreq = Math.max(minFreqs[index], Math.min(maxFreqs[index], freq));

      // Update parameter
      if (index === 0) {
        currentParams.crossover1 = clampedFreq;
      } else if (index === 1) {
        currentParams.crossover2 = clampedFreq;
      } else {
        currentParams.crossover3 = clampedFreq;
      }

      // Update filters
      crossoversL[index].setFrequency(clampedFreq, sampleRate);
      crossoversR[index].setFrequency(clampedFreq, sampleRate);
    },

    setBandParams(bandIndex: number, params: Partial<MultibandCompressorBandParams>) {
      if (bandIndex < 0 || bandIndex > 3) return;

      compressorsL[bandIndex].setParams(params);
      compressorsR[bandIndex].setParams(params);

      // Update stored params
      Object.assign(currentParams.bands[bandIndex], compressorsL[bandIndex].params);
    },

    getMeterData(): MultibandCompressorMeterData {
      return {
        bands: compressorsL.map((comp) => comp.getMeterData()),
        inputLevel: 20 * Math.log10(Math.max(overallInputPeak, 1e-10)),
        outputLevel: 20 * Math.log10(Math.max(overallOutputPeak, 1e-10)),
      };
    },

    getParams(): MultibandCompressorParams {
      return {
        ...currentParams,
        bands: currentParams.bands.map((b) => ({ ...b })),
      };
    },

    destroy() {
      input.disconnect();
      output.disconnect();
      dryGain.disconnect();
      wetGain.disconnect();
      inputGainNode.disconnect();
      outputGainNode.disconnect();
      processor.disconnect();
    },
  };
}

/**
 * MultibandCompressorEffect class for compatibility with EffectNode interface
 * Used by the effect registry system
 */
export class MultibandCompressorEffect {
  private _context: AudioContext;
  private _node: MultibandCompressorNode;
  private _bypass = false;
  private _mix: number;

  constructor(context: AudioContext) {
    this._context = context;
    this._node = createMultibandCompressorNode(context);
    this._mix = this._node.mix;
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

  setBypass(bypass: boolean): void {
    this._bypass = bypass;
    this._node.setBypass(bypass);
  }

  setMix(mix: number): void {
    this._mix = Math.max(0, Math.min(1, mix));
    this._node.setMix(this._mix);
  }

  setInputGain(gain: number): void {
    this._node.setInputGain(gain);
  }

  setOutputGain(gain: number): void {
    this._node.setOutputGain(gain);
  }

  setCrossover(index: number, freq: number): void {
    this._node.setCrossover(index, freq);
  }

  setBandParams(bandIndex: number, params: Partial<MultibandCompressorBandParams>): void {
    this._node.setBandParams(bandIndex, params);
  }

  getMeterData(): MultibandCompressorMeterData {
    return this._node.getMeterData();
  }

  getParams(): MultibandCompressorParams {
    return this._node.getParams();
  }

  setAllParams(params: Record<string, number>): void {
    if (params.inputGain !== undefined) this.setInputGain(params.inputGain);
    if (params.outputGain !== undefined) this.setOutputGain(params.outputGain);
    if (params.mix !== undefined) this.setMix(params.mix);
    if (params.crossover1 !== undefined) this.setCrossover(0, params.crossover1);
    if (params.crossover2 !== undefined) this.setCrossover(1, params.crossover2);
    if (params.crossover3 !== undefined) this.setCrossover(2, params.crossover3);

    // Per-band parameters using naming convention: band{N}_{param}
    for (let b = 0; b < 4; b++) {
      const bandParams: Partial<MultibandCompressorBandParams> = {};

      if (params[`band${b}_threshold`] !== undefined) {
        bandParams.threshold = params[`band${b}_threshold`];
      }
      if (params[`band${b}_ratio`] !== undefined) {
        bandParams.ratio = params[`band${b}_ratio`];
      }
      if (params[`band${b}_attack`] !== undefined) {
        bandParams.attack = params[`band${b}_attack`];
      }
      if (params[`band${b}_release`] !== undefined) {
        bandParams.release = params[`band${b}_release`];
      }
      if (params[`band${b}_makeupGain`] !== undefined) {
        bandParams.makeupGain = params[`band${b}_makeupGain`];
      }
      if (params[`band${b}_solo`] !== undefined) {
        bandParams.solo = params[`band${b}_solo`] > 0.5;
      }
      if (params[`band${b}_mute`] !== undefined) {
        bandParams.mute = params[`band${b}_mute`] > 0.5;
      }

      if (Object.keys(bandParams).length > 0) {
        this.setBandParams(b, bandParams);
      }
    }
  }

  destroy(): void {
    this._node.destroy();
  }
}

// Band name mapping for UI
export const BAND_NAMES = ['Low', 'Low-Mid', 'High-Mid', 'High'] as const;
export type BandName = typeof BAND_NAMES[number];
