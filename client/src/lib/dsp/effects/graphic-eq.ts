/**
 * 10-Band Graphic Equalizer Effect
 *
 * Professional-grade graphic EQ with ISO standard 1/3 octave center frequencies.
 * Uses Web Audio API BiquadFilterNodes in peaking mode for precise frequency control.
 *
 * Features:
 * - 10 bands at ISO standard frequencies (31Hz - 16kHz)
 * - ±12dB gain range per band
 * - Smooth parameter transitions to avoid clicks
 * - Multiple preset curves (flat, smile, frown, bassBoost, trebleBoost, vocal)
 * - Frequency response visualization data
 * - Wet/dry mix control
 * - Full bypass capability
 */

/** ISO standard 1/3 octave center frequencies for 10-band graphic EQ */
export const ISO_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

/** Band names for parameter mapping */
export const BAND_NAMES = ['band31', 'band62', 'band125', 'band250', 'band500', 'band1k', 'band2k', 'band4k', 'band8k', 'band16k'] as const;

/** Default Q factor for graphic EQ (~1.4 for ISO 1/3 octave bands) */
export const DEFAULT_Q = 1.414;

/** Minimum gain in dB */
const MIN_GAIN_DB = -12;

/** Maximum gain in dB */
const MAX_GAIN_DB = 12;

/** Smoothing time constant for parameter changes (in seconds) */
const SMOOTHING_TIME = 0.02;

/** Preset EQ curves */
export const PRESETS: Record<string, Record<string, number>> = {
  flat: {
    band31: 0, band62: 0, band125: 0, band250: 0, band500: 0,
    band1k: 0, band2k: 0, band4k: 0, band8k: 0, band16k: 0,
  },
  smile: {
    // Classic "V" curve - boosted lows and highs, cut mids
    band31: 6, band62: 5, band125: 3, band250: 1, band500: -2,
    band1k: -3, band2k: -2, band4k: 1, band8k: 4, band16k: 6,
  },
  frown: {
    // Opposite of smile - boosted mids, cut lows and highs
    band31: -4, band62: -3, band125: -1, band250: 2, band500: 4,
    band1k: 5, band2k: 4, band4k: 2, band8k: -2, band16k: -4,
  },
  bassBoost: {
    // Enhanced low end for bass-heavy music
    band31: 8, band62: 7, band125: 5, band250: 3, band500: 1,
    band1k: 0, band2k: 0, band4k: 0, band8k: 0, band16k: 0,
  },
  trebleBoost: {
    // Enhanced high end for clarity and presence
    band31: 0, band62: 0, band125: 0, band250: 0, band500: 0,
    band1k: 1, band2k: 2, band4k: 4, band8k: 6, band16k: 7,
  },
  vocal: {
    // Vocal presence enhancement
    band31: -2, band62: -1, band125: 0, band250: 1, band500: 2,
    band1k: 4, band2k: 5, band4k: 4, band8k: 2, band16k: 1,
  },
};

export interface GraphicEQParams {
  band31: number;
  band62: number;
  band125: number;
  band250: number;
  band500: number;
  band1k: number;
  band2k: number;
  band4k: number;
  band8k: number;
  band16k: number;
  mix: number;
}

/**
 * 10-Band Graphic Equalizer Effect
 */
export class GraphicEQEffect {
  /** Input gain node for effect chain */
  readonly input: GainNode;

  /** Output gain node for effect chain */
  readonly output: GainNode;

  /** Bypass state */
  private _bypass = false;

  /** Wet/dry mix (0 = dry, 1 = wet) */
  private _mix = 1;

  /** Audio context reference */
  private context: AudioContext;

  /** Array of 10 peaking filter nodes */
  private filters: BiquadFilterNode[] = [];

  /** Dry signal path gain */
  private dryGain: GainNode;

  /** Wet signal path gain */
  private wetGain: GainNode;

  /** Band gains in dB */
  private bandGains: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  constructor(context: AudioContext) {
    this.context = context;

    // Create input/output nodes
    this.input = context.createGain();
    this.output = context.createGain();

    // Create dry/wet mix nodes
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();

    // Create 10 peaking filter bands
    for (let i = 0; i < 10; i++) {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = ISO_FREQUENCIES[i];
      filter.Q.value = DEFAULT_Q;
      filter.gain.value = 0;
      this.filters.push(filter);
    }

    // Connect filter chain
    this.input.connect(this.filters[0]);
    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i + 1]);
    }
    this.filters[this.filters.length - 1].connect(this.wetGain);

    // Connect dry path
    this.input.connect(this.dryGain);

    // Mix to output
    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);

    // Set initial mix (100% wet)
    this.updateMixGains();
  }

  /** Get bypass state */
  get bypass(): boolean {
    return this._bypass;
  }

  /** Get mix value */
  get mix(): number {
    return this._mix;
  }

  /** Get current parameters */
  get params(): GraphicEQParams {
    return {
      band31: this.bandGains[0],
      band62: this.bandGains[1],
      band125: this.bandGains[2],
      band250: this.bandGains[3],
      band500: this.bandGains[4],
      band1k: this.bandGains[5],
      band2k: this.bandGains[6],
      band4k: this.bandGains[7],
      band8k: this.bandGains[8],
      band16k: this.bandGains[9],
      mix: this._mix,
    };
  }

  /**
   * Set band gain by frequency
   * @param freq - Center frequency (must match ISO_FREQUENCIES)
   * @param gain - Gain in dB (-12 to +12)
   */
  setBandGain(freq: number, gain: number): void {
    const index = ISO_FREQUENCIES.indexOf(freq as typeof ISO_FREQUENCIES[number]);
    if (index !== -1) {
      this.setBandGainByIndex(index, gain);
    }
  }

  /**
   * Get band gain by frequency
   * @param freq - Center frequency
   * @returns Gain in dB
   */
  getBandGain(freq: number): number {
    const index = ISO_FREQUENCIES.indexOf(freq as typeof ISO_FREQUENCIES[number]);
    return index !== -1 ? this.bandGains[index] : 0;
  }

  /**
   * Set band gain by index
   * @param index - Band index (0-9)
   * @param gain - Gain in dB (-12 to +12)
   */
  setBandGainByIndex(index: number, gain: number): void {
    if (index < 0 || index >= 10) return;

    // Clamp gain to valid range
    const clampedGain = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gain));
    this.bandGains[index] = clampedGain;

    // Apply with smoothing to avoid clicks
    const now = this.context.currentTime;
    this.filters[index].gain.setTargetAtTime(clampedGain, now, SMOOTHING_TIME);
  }

  /**
   * Get band gain by index
   * @param index - Band index (0-9)
   * @returns Gain in dB
   */
  getBandGainByIndex(index: number): number {
    if (index < 0 || index >= 10) return 0;
    return this.bandGains[index];
  }

  /**
   * Apply a preset EQ curve
   * @param name - Preset name (flat, smile, frown, bassBoost, trebleBoost, vocal)
   */
  applyPreset(name: keyof typeof PRESETS): void {
    const preset = PRESETS[name];
    if (!preset) return;

    for (let i = 0; i < BAND_NAMES.length; i++) {
      const bandName = BAND_NAMES[i];
      const gain = preset[bandName] ?? 0;
      this.setBandGainByIndex(i, gain);
    }
  }

  /**
   * Reset all bands to 0dB (flat response)
   */
  resetToFlat(): void {
    this.applyPreset('flat');
  }

  /**
   * Set bypass state
   * @param val - true to bypass effect
   */
  setBypass(val: boolean): void {
    this._bypass = val;
    this.updateMixGains();
  }

  /**
   * Set wet/dry mix
   * @param val - Mix value (0 = dry, 1 = wet)
   */
  setMix(val: number): void {
    this._mix = Math.max(0, Math.min(1, val));
    this.updateMixGains();
  }

  /**
   * Update dry/wet gain values based on mix and bypass
   */
  private updateMixGains(): void {
    const now = this.context.currentTime;

    if (this._bypass) {
      // Full dry signal when bypassed
      this.dryGain.gain.setTargetAtTime(1, now, SMOOTHING_TIME);
      this.wetGain.gain.setTargetAtTime(0, now, SMOOTHING_TIME);
    } else {
      // Apply mix ratio
      this.dryGain.gain.setTargetAtTime(1 - this._mix, now, SMOOTHING_TIME);
      this.wetGain.gain.setTargetAtTime(this._mix, now, SMOOTHING_TIME);
    }
  }

  /**
   * Set all parameters at once
   * @param params - Partial parameter object
   */
  setAllParams(params: Partial<GraphicEQParams>): void {
    if (params.band31 !== undefined) this.setBandGainByIndex(0, params.band31);
    if (params.band62 !== undefined) this.setBandGainByIndex(1, params.band62);
    if (params.band125 !== undefined) this.setBandGainByIndex(2, params.band125);
    if (params.band250 !== undefined) this.setBandGainByIndex(3, params.band250);
    if (params.band500 !== undefined) this.setBandGainByIndex(4, params.band500);
    if (params.band1k !== undefined) this.setBandGainByIndex(5, params.band1k);
    if (params.band2k !== undefined) this.setBandGainByIndex(6, params.band2k);
    if (params.band4k !== undefined) this.setBandGainByIndex(7, params.band4k);
    if (params.band8k !== undefined) this.setBandGainByIndex(8, params.band8k);
    if (params.band16k !== undefined) this.setBandGainByIndex(9, params.band16k);
    if (params.mix !== undefined) this.setMix(params.mix);
  }

  /**
   * Get frequency response data for visualization
   * @param numPoints - Number of frequency points to calculate
   * @returns Object with frequencies and magnitudes arrays
   */
  getFrequencyResponse(numPoints: number): { frequencies: Float32Array; magnitudes: Float32Array } {
    const frequencies = new Float32Array(numPoints);
    const magnitudes = new Float32Array(numPoints);
    const phases = new Float32Array(numPoints);

    // Generate logarithmic frequency scale from 20Hz to 20kHz
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);

    for (let i = 0; i < numPoints; i++) {
      const logFreq = logMin + (logMax - logMin) * (i / (numPoints - 1));
      frequencies[i] = Math.pow(10, logFreq);
    }

    // Get combined frequency response from all filters
    const tempMags = new Float32Array(numPoints);
    const tempPhases = new Float32Array(numPoints);

    // Initialize magnitudes to 1 (0 dB)
    magnitudes.fill(1);

    // Multiply responses from each filter
    for (const filter of this.filters) {
      filter.getFrequencyResponse(frequencies, tempMags, tempPhases);
      for (let i = 0; i < numPoints; i++) {
        magnitudes[i] *= tempMags[i];
      }
    }

    // Convert to dB
    for (let i = 0; i < numPoints; i++) {
      magnitudes[i] = 20 * Math.log10(Math.max(magnitudes[i], 1e-10));
    }

    return { frequencies, magnitudes };
  }

  /**
   * Get current band gains as array for visualization
   * @returns Array of 10 gain values in dB
   */
  getBandGains(): number[] {
    return [...this.bandGains];
  }

  /**
   * Disconnect and clean up all nodes
   */
  destroy(): void {
    try {
      this.input.disconnect();
      this.output.disconnect();
      this.dryGain.disconnect();
      this.wetGain.disconnect();
      for (const filter of this.filters) {
        filter.disconnect();
      }
    } catch {
      // Ignore disconnect errors
    }
    this.filters = [];
  }
}
