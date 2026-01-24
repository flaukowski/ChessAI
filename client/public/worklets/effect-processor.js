/**
 * AudioNoise Web - AudioWorklet Processors
 * High-performance DSP effects for real-time audio processing
 *
 * CRITICAL: No memory allocations, closures, or logging in process()
 */

// Pre-allocated buffers and constants
const SAMPLE_RATE = 48000;
const TWO_PI = 2 * Math.PI;

/**
 * 3-Band Parametric EQ Processor
 * Low, Mid, High bands with gain and frequency control
 * Uses frequency pre-warping for accurate cutoffs at high frequencies
 */
class EQProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'lowGain', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'lowFreq', defaultValue: 320, minValue: 20, maxValue: 500 },
      { name: 'midGain', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'midFreq', defaultValue: 1000, minValue: 200, maxValue: 5000 },
      { name: 'midQ', defaultValue: 1, minValue: 0.1, maxValue: 10 },
      { name: 'highGain', defaultValue: 0, minValue: -24, maxValue: 24 },
      { name: 'highFreq', defaultValue: 3200, minValue: 1000, maxValue: 20000 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  // Pre-warp frequency for accurate digital filter response
  // Based on bilinear transform from dspml
  prewarpFrequency(fc) {
    // For frequencies below Nyquist/4, warping is minimal
    // Above that, apply tangent pre-warping for accuracy
    const nyquist = sampleRate / 2;
    if (fc < nyquist * 0.25) {
      return fc;
    }
    // Clamp to just below Nyquist to avoid tan(π/2) = infinity
    const clampedFc = Math.min(fc, nyquist * 0.98);
    return (sampleRate / Math.PI) * Math.tan(Math.PI * clampedFc / sampleRate);
  }

  constructor() {
    super();
    // Biquad filter states for 3 bands (2 channels each)
    // [x1, x2, y1, y2] per band per channel
    this.lowState = [[0, 0, 0, 0], [0, 0, 0, 0]];
    this.midState = [[0, 0, 0, 0], [0, 0, 0, 0]];
    this.highState = [[0, 0, 0, 0], [0, 0, 0, 0]];
    this.lowCoeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    this.midCoeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    this.highCoeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    this.lastLowFreq = 0;
    this.lastLowGain = 0;
    this.lastMidFreq = 0;
    this.lastMidGain = 0;
    this.lastMidQ = 0;
    this.lastHighFreq = 0;
    this.lastHighGain = 0;
  }

  // Low shelf filter coefficient calculation (with pre-warping)
  calcLowShelf(freq, gainDb) {
    const A = Math.pow(10, gainDb / 40);
    const warpedFreq = this.prewarpFrequency(freq);
    const w0 = TWO_PI * warpedFreq / sampleRate;
    const cos_w0 = Math.cos(w0);
    const sin_w0 = Math.sin(w0);
    const alpha = sin_w0 / 2 * Math.sqrt((A + 1/A) * (1/0.9 - 1) + 2);
    const sqrtA = Math.sqrt(A);

    const a0 = (A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha;
    this.lowCoeffs.b0 = (A * ((A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha)) / a0;
    this.lowCoeffs.b1 = (2 * A * ((A - 1) - (A + 1) * cos_w0)) / a0;
    this.lowCoeffs.b2 = (A * ((A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha)) / a0;
    this.lowCoeffs.a1 = (-2 * ((A - 1) + (A + 1) * cos_w0)) / a0;
    this.lowCoeffs.a2 = ((A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha) / a0;
  }

  // Peaking EQ coefficient calculation (with pre-warping)
  calcPeaking(freq, gainDb, Q) {
    const A = Math.pow(10, gainDb / 40);
    const warpedFreq = this.prewarpFrequency(freq);
    const w0 = TWO_PI * warpedFreq / sampleRate;
    const cos_w0 = Math.cos(w0);
    const sin_w0 = Math.sin(w0);
    const alpha = sin_w0 / (2 * Q);

    const a0 = 1 + alpha / A;
    this.midCoeffs.b0 = (1 + alpha * A) / a0;
    this.midCoeffs.b1 = (-2 * cos_w0) / a0;
    this.midCoeffs.b2 = (1 - alpha * A) / a0;
    this.midCoeffs.a1 = this.midCoeffs.b1;
    this.midCoeffs.a2 = (1 - alpha / A) / a0;
  }

  // High shelf filter coefficient calculation (with pre-warping)
  calcHighShelf(freq, gainDb) {
    const A = Math.pow(10, gainDb / 40);
    const warpedFreq = this.prewarpFrequency(freq);
    const w0 = TWO_PI * warpedFreq / sampleRate;
    const cos_w0 = Math.cos(w0);
    const sin_w0 = Math.sin(w0);
    const alpha = sin_w0 / 2 * Math.sqrt((A + 1/A) * (1/0.9 - 1) + 2);
    const sqrtA = Math.sqrt(A);

    const a0 = (A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha;
    this.highCoeffs.b0 = (A * ((A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha)) / a0;
    this.highCoeffs.b1 = (-2 * A * ((A - 1) + (A + 1) * cos_w0)) / a0;
    this.highCoeffs.b2 = (A * ((A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha)) / a0;
    this.highCoeffs.a1 = (2 * ((A - 1) - (A + 1) * cos_w0)) / a0;
    this.highCoeffs.a2 = ((A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha) / a0;
  }

  // Biquad filter processing - inline for performance
  processBiquad(x, state, coeffs) {
    const y = coeffs.b0 * x + coeffs.b1 * state[0] + coeffs.b2 * state[1] - coeffs.a1 * state[2] - coeffs.a2 * state[3];
    state[1] = state[0];
    state[0] = x;
    state[3] = state[2];
    state[2] = y;
    return y;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];

    // Update coefficients only when parameters change
    const lowFreq = parameters.lowFreq[0];
    const lowGain = parameters.lowGain[0];
    const midFreq = parameters.midFreq[0];
    const midGain = parameters.midGain[0];
    const midQ = parameters.midQ[0];
    const highFreq = parameters.highFreq[0];
    const highGain = parameters.highGain[0];

    if (lowFreq !== this.lastLowFreq || lowGain !== this.lastLowGain) {
      this.calcLowShelf(lowFreq, lowGain);
      this.lastLowFreq = lowFreq;
      this.lastLowGain = lowGain;
    }
    if (midFreq !== this.lastMidFreq || midGain !== this.lastMidGain || midQ !== this.lastMidQ) {
      this.calcPeaking(midFreq, midGain, midQ);
      this.lastMidFreq = midFreq;
      this.lastMidGain = midGain;
      this.lastMidQ = midQ;
    }
    if (highFreq !== this.lastHighFreq || highGain !== this.lastHighGain) {
      this.calcHighShelf(highFreq, highGain);
      this.lastHighFreq = highFreq;
      this.lastHighGain = highGain;
    }

    const numChannels = Math.min(input.length, output.length);
    const blockSize = input[0].length;

    for (let ch = 0; ch < numChannels; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];

      for (let i = 0; i < blockSize; i++) {
        const dry = inputChannel[i];

        if (bypass) {
          outputChannel[i] = dry;
        } else {
          // Process through 3 bands in series
          let wet = this.processBiquad(dry, this.lowState[ch], this.lowCoeffs);
          wet = this.processBiquad(wet, this.midState[ch], this.midCoeffs);
          wet = this.processBiquad(wet, this.highState[ch], this.highCoeffs);

          // Wet/dry mix
          outputChannel[i] = dry * (1 - mix) + wet * mix;
        }
      }
    }

    return true;
  }
}

/**
 * Distortion Processor
 * Hard clip, soft clip, tube-style saturation, and extended waveshaper primitives
 * Includes foldback, tube_clip, and diode_clip from AudioNoise PR #64
 */
class DistortionProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'drive', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 6 }, // 0=soft, 1=hard, 2=tube, 3=quadratic, 4=foldback, 5=tube_clip, 6=diode
      { name: 'level', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Tone filter state
    this.filterState = [[0, 0], [0, 0]];
    this.lastTone = -1;
    this.filterCoeff = 0.5;
  }

  // Soft clipping using tanh approximation
  softClip(x, drive) {
    const k = drive * 10 + 1;
    return Math.tanh(x * k) / Math.tanh(k);
  }

  // Hard clipping
  hardClip(x, drive) {
    const threshold = 1 - drive * 0.9;
    if (x > threshold) return threshold;
    if (x < -threshold) return -threshold;
    return x;
  }

  // Tube-style asymmetric saturation
  tubeSaturate(x, drive) {
    const k = drive * 5 + 1;
    if (x >= 0) {
      return 1 - Math.exp(-x * k);
    } else {
      return -1 + Math.exp(x * k * 0.8);
    }
  }

  // Quadratic soft-clip - smoother transition, fewer harsh high harmonics
  // Based on second-order curves from dspml
  quadraticClip(x, drive) {
    const k = drive * 4 + 1;
    const scaled = x * k;

    if (scaled > 1.0) return 1.0;
    if (scaled < -1.0) return -1.0;

    // Quadratic regions near saturation, linear in center
    if (scaled > 0.5) {
      return 1.0 - 2.0 * (1.0 - scaled) * (1.0 - scaled);
    }
    if (scaled < -0.5) {
      return -1.0 + 2.0 * (1.0 + scaled) * (1.0 + scaled);
    }

    // Linear region in the middle for clean low-level signals
    return scaled * 2.0 / k;
  }

  // ========== Extended Waveshaper Primitives from AudioNoise PR #64 ==========

  // Foldback distortion - synth-fuzz tones with complex harmonics
  // Signal reflects when it exceeds threshold, creating rich overtones
  foldBack(x, drive) {
    const threshold = 1.0 - drive * 0.8; // Higher drive = lower threshold
    if (threshold <= 0) return 0;

    let iterations = 0;
    let result = x * (1 + drive * 3); // Pre-gain based on drive

    while ((result > threshold || result < -threshold) && iterations++ < 16) {
      if (result > threshold) {
        result = 2 * threshold - result;
      } else {
        result = -2 * threshold - result;
      }
    }
    return result;
  }

  // Tube clip - soft saturation using polynomial approximation
  // y = x * (1.5 - 0.5 * x²) produces gentle compression similar to tube saturation
  tubeClip(x, drive) {
    const k = 1 + drive * 4;
    let scaled = x * k;

    // Clamp input to valid range
    if (scaled > 1.5) scaled = 1.5;
    if (scaled < -1.5) scaled = -1.5;

    const x2 = scaled * scaled;
    return scaled * (1.5 - 0.5 * x2) / k;
  }

  // Helper for diode clip - soft limiting: x / (1 + |x|)
  _wsSoftClip(x) {
    return x / (1 + Math.abs(x));
  }

  // Diode clip - asymmetric harmonic generation
  // Emulates silicon diode characteristics with configurable asymmetry
  diodeClip(x, drive) {
    const ratio = 0.3 + drive * 1.4; // Asymmetry ratio varies with drive
    const k = 1 + drive * 5;
    const scaled = x * k;

    const pos = this._wsSoftClip(scaled);
    const neg = this._wsSoftClip(scaled * ratio) / ratio;

    return (scaled >= 0 ? pos : neg) / k;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const drive = parameters.drive[0];
    const tone = parameters.tone[0];
    const mode = Math.round(parameters.mode[0]);
    const level = parameters.level[0];

    // Update tone filter coefficient
    if (tone !== this.lastTone) {
      this.filterCoeff = 0.1 + tone * 0.8;
      this.lastTone = tone;
    }

    const numChannels = Math.min(input.length, output.length);
    const blockSize = input[0].length;

    for (let ch = 0; ch < numChannels; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];

      for (let i = 0; i < blockSize; i++) {
        const dry = inputChannel[i];

        if (bypass) {
          outputChannel[i] = dry;
        } else {
          // Apply distortion based on mode
          let distorted;
          switch (mode) {
            case 0:
              distorted = this.softClip(dry, drive);
              break;
            case 1:
              distorted = this.hardClip(dry, drive);
              break;
            case 2:
              distorted = this.tubeSaturate(dry, drive);
              break;
            case 3:
              distorted = this.quadraticClip(dry, drive);
              break;
            case 4:
              distorted = this.foldBack(dry, drive);
              break;
            case 5:
              distorted = this.tubeClip(dry, drive);
              break;
            case 6:
              distorted = this.diodeClip(dry, drive);
              break;
            default:
              distorted = this.softClip(dry, drive);
          }

          // Simple one-pole lowpass for tone control
          const state = this.filterState[ch];
          state[0] = state[0] + this.filterCoeff * (distorted - state[0]);
          const filtered = distorted * (1 - tone * 0.5) + state[0] * (tone * 0.5);

          // Apply output level
          const wet = filtered * level;

          // Wet/dry mix
          outputChannel[i] = dry * (1 - mix) + wet * mix;
        }
      }
    }

    return true;
  }
}

/**
 * Delay Processor
 * Simple delay with feedback and filtering
 */
class DelayProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'time', defaultValue: 300, minValue: 1, maxValue: 2000 },
      { name: 'feedback', defaultValue: 0.4, minValue: 0, maxValue: 0.95 },
      { name: 'damping', defaultValue: 0.3, minValue: 0, maxValue: 1 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 0.5, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Max 2 seconds of delay at 48kHz
    this.bufferSize = 96000;
    this.buffer = [new Float32Array(this.bufferSize), new Float32Array(this.bufferSize)];
    this.writeIndex = 0;
    // Damping filter state
    this.dampState = [0, 0];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const timeMs = parameters.time[0];
    const feedback = parameters.feedback[0];
    const damping = parameters.damping[0];

    const delaySamples = Math.floor(timeMs * sampleRate / 1000);
    const numChannels = Math.min(input.length, output.length, 2);
    const blockSize = input[0].length;

    for (let i = 0; i < blockSize; i++) {
      const readIndex = (this.writeIndex - delaySamples + this.bufferSize) % this.bufferSize;

      for (let ch = 0; ch < numChannels; ch++) {
        const dry = input[ch][i];

        if (bypass) {
          output[ch][i] = dry;
        } else {
          // Read from delay buffer
          const delayed = this.buffer[ch][readIndex];

          // Apply damping (low pass filter on feedback)
          this.dampState[ch] = this.dampState[ch] + damping * (delayed - this.dampState[ch]);
          const dampedDelay = delayed * (1 - damping * 0.5) + this.dampState[ch] * (damping * 0.5);

          // Write to delay buffer with feedback
          this.buffer[ch][this.writeIndex] = dry + dampedDelay * feedback;

          // Mix output
          output[ch][i] = dry * (1 - mix) + delayed * mix;
        }
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

/**
 * Chorus Processor
 * Multiple modulated delay lines for rich chorus effect
 */
class ChorusProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 1.5, minValue: 0.1, maxValue: 10 },
      { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'voices', defaultValue: 2, minValue: 1, maxValue: 4 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 0.5, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Delay buffer for chorus (30ms max per voice)
    this.bufferSize = 2048;
    this.buffer = [new Float32Array(this.bufferSize), new Float32Array(this.bufferSize)];
    this.writeIndex = 0;
    // LFO phases for each voice
    this.lfoPhases = [0, 0.25, 0.5, 0.75];
    // Base delay in samples (7ms)
    this.baseDelay = Math.floor(0.007 * sampleRate);
    // Max modulation depth in samples (3ms)
    this.maxModDepth = Math.floor(0.003 * sampleRate);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const rate = parameters.rate[0];
    const depth = parameters.depth[0];
    const numVoices = Math.round(parameters.voices[0]);

    const phaseIncrement = rate / sampleRate;
    const numChannels = Math.min(input.length, output.length, 2);
    const blockSize = input[0].length;

    for (let i = 0; i < blockSize; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const dry = input[ch][i];

        // Write to delay buffer
        this.buffer[ch][this.writeIndex] = dry;

        if (bypass) {
          output[ch][i] = dry;
        } else {
          let wet = 0;

          // Sum multiple delayed/modulated voices
          for (let v = 0; v < numVoices; v++) {
            // Calculate modulated delay
            const lfo = Math.sin(TWO_PI * this.lfoPhases[v]);
            const modDelay = this.baseDelay + lfo * this.maxModDepth * depth;

            // Linear interpolation for fractional delay
            const readIndex = this.writeIndex - modDelay;
            const readIndexInt = Math.floor(readIndex);
            const frac = readIndex - readIndexInt;

            const idx0 = (readIndexInt + this.bufferSize) % this.bufferSize;
            const idx1 = (idx0 + 1) % this.bufferSize;

            const sample = this.buffer[ch][idx0] * (1 - frac) + this.buffer[ch][idx1] * frac;
            wet += sample;
          }

          wet /= numVoices;
          output[ch][i] = dry * (1 - mix) + wet * mix;
        }
      }

      // Advance LFO phases
      for (let v = 0; v < 4; v++) {
        this.lfoPhases[v] = (this.lfoPhases[v] + phaseIncrement) % 1;
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

/**
 * Compressor Processor
 * Simple RMS-based compressor with attack/release
 */
class CompressorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -20, minValue: -60, maxValue: 0 },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20 },
      { name: 'attack', defaultValue: 10, minValue: 0.1, maxValue: 100 },
      { name: 'release', defaultValue: 100, minValue: 10, maxValue: 1000 },
      { name: 'makeupGain', defaultValue: 0, minValue: 0, maxValue: 24 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gainReduction = 1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const thresholdDb = parameters.threshold[0];
    const ratio = parameters.ratio[0];
    const attackMs = parameters.attack[0];
    const releaseMs = parameters.release[0];
    const makeupGainDb = parameters.makeupGain[0];

    const threshold = Math.pow(10, thresholdDb / 20);
    const makeupGain = Math.pow(10, makeupGainDb / 20);
    const attackCoeff = Math.exp(-1 / (attackMs * sampleRate / 1000));
    const releaseCoeff = Math.exp(-1 / (releaseMs * sampleRate / 1000));

    const numChannels = Math.min(input.length, output.length);
    const blockSize = input[0].length;

    for (let i = 0; i < blockSize; i++) {
      // Calculate peak across all channels
      let peak = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        const abs = Math.abs(input[ch][i]);
        if (abs > peak) peak = abs;
      }

      // Envelope follower
      if (peak > this.envelope) {
        this.envelope = attackCoeff * this.envelope + (1 - attackCoeff) * peak;
      } else {
        this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * peak;
      }

      // Calculate gain reduction
      let gain = 1;
      if (this.envelope > threshold) {
        const overDb = 20 * Math.log10(this.envelope / threshold);
        const reductionDb = overDb * (1 - 1 / ratio);
        gain = Math.pow(10, -reductionDb / 20);
      }

      // Smooth gain changes
      this.gainReduction = 0.999 * this.gainReduction + 0.001 * gain;

      // Apply to all channels
      for (let ch = 0; ch < numChannels; ch++) {
        const dry = input[ch][i];

        if (bypass) {
          output[ch][i] = dry;
        } else {
          const wet = dry * this.gainReduction * makeupGain;
          output[ch][i] = dry * (1 - mix) + wet * mix;
        }
      }
    }

    return true;
  }
}

/**
 * Level Meter Processor
 * Calculates RMS and peak levels for visualization
 */
class LevelMeterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor() {
    super();
    this.peakL = 0;
    this.peakR = 0;
    this.rmsL = 0;
    this.rmsR = 0;
    this.peakDecay = 0.9995;
    this.rmsSmoothing = 0.95;
    this.frameCount = 0;
    this.reportInterval = 2048; // Report every ~42ms at 48kHz (was 128 = ~2.7ms, causing perf issues)
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const blockSize = input[0].length;
    let sumL = 0;
    let sumR = 0;
    let maxL = 0;
    let maxR = 0;

    // Calculate RMS and peak for this block
    for (let i = 0; i < blockSize; i++) {
      const sampleL = input[0] ? input[0][i] : 0;
      const sampleR = input[1] ? input[1][i] : sampleL;

      sumL += sampleL * sampleL;
      sumR += sampleR * sampleR;

      const absL = Math.abs(sampleL);
      const absR = Math.abs(sampleR);

      if (absL > maxL) maxL = absL;
      if (absR > maxR) maxR = absR;

      // Pass through
      if (output[0]) output[0][i] = sampleL;
      if (output[1]) output[1][i] = sampleR;
    }

    // Update RMS with smoothing
    const rmsBlockL = Math.sqrt(sumL / blockSize);
    const rmsBlockR = Math.sqrt(sumR / blockSize);
    this.rmsL = this.rmsSmoothing * this.rmsL + (1 - this.rmsSmoothing) * rmsBlockL;
    this.rmsR = this.rmsSmoothing * this.rmsR + (1 - this.rmsSmoothing) * rmsBlockR;

    // Update peak with decay
    this.peakL = Math.max(maxL, this.peakL * this.peakDecay);
    this.peakR = Math.max(maxR, this.peakR * this.peakDecay);

    // Report levels periodically
    this.frameCount++;
    if (this.frameCount >= this.reportInterval) {
      this.port.postMessage({
        peakL: this.peakL,
        peakR: this.peakR,
        rmsL: this.rmsL,
        rmsR: this.rmsR,
      });
      this.frameCount = 0;
    }

    return true;
  }
}

/**
 * BassPurr Processor
 * Bass guitar harmonics generator with fundamental, even, and odd harmonic paths
 * Ported from firmware implementation
 */
class BassPurrProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'fundamental', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'even', defaultValue: 0.3, minValue: 0, maxValue: 1 },
      { name: 'odd', defaultValue: 0.3, minValue: 0, maxValue: 1 },
      { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'output', defaultValue: 0.7, minValue: 0, maxValue: 1 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Biquad filter states: [z1, z2] for DF2T
    // Dry HPF approximation (LPF80)
    this.dryLpfState = [[0, 0], [0, 0]];
    // Odd path LPF (2nd order)
    this.oddLpfState = [[0, 0], [0, 0]];
    // Even path LPF (4th order - two cascaded biquads)
    this.evenLpfAState = [[0, 0], [0, 0]];
    this.evenLpfBState = [[0, 0], [0, 0]];

    // LPF @ 80Hz coefficients for fundamental HPF approximation
    this.lpf80 = {
      b0: 0.0005, b1: 0.0010, b2: 0.0005,
      a1: -1.9445, a2: 0.9465
    };

    // Harmonic LPF coefficient table for different tone settings
    // 5 steps: ~250Hz, ~500Hz, ~900Hz, ~1500Hz, ~2200Hz
    this.harmLpfTable = [
      { b0: 0.0012, b1: 0.0024, b2: 0.0012, a1: -1.8890, a2: 0.8940 },
      { b0: 0.0047, b1: 0.0094, b2: 0.0047, a1: -1.7786, a2: 0.7974 },
      { b0: 0.0150, b1: 0.0300, b2: 0.0150, a1: -1.6040, a2: 0.6640 },
      { b0: 0.0370, b1: 0.0740, b2: 0.0370, a1: -1.4070, a2: 0.5550 },
      { b0: 0.0700, b1: 0.1400, b2: 0.0700, a1: -1.2000, a2: 0.4800 },
    ];

    this.lastToneIdx = -1;
    this.currentHarmCoeffs = this.harmLpfTable[2]; // Default to middle
  }

  // Biquad step using Direct Form II Transposed
  biquadStep(x, state, coeffs) {
    const y = coeffs.b0 * x + state[0];
    state[0] = coeffs.b1 * x - coeffs.a1 * y + state[1];
    state[1] = coeffs.b2 * x - coeffs.a2 * y;
    return y;
  }

  // Hard clip function
  hardClip(x) {
    if (x > 1.0) return 1.0;
    if (x < -1.0) return -1.0;
    return x;
  }

  // Convert tone (0-1) to table index (0-4)
  toneToIndex(tone) {
    if (tone <= 0) return 0;
    if (tone >= 1) return 4;
    return Math.round(tone * 4);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const fundMix = parameters.fundamental[0];
    const evenMix = parameters.even[0];
    const oddMix = parameters.odd[0];
    const tone = parameters.tone[0];
    const outputLevel = 0.5 + 0.5 * parameters.output[0];

    // Update harmonic LPF coefficients when tone changes
    const toneIdx = this.toneToIndex(tone);
    if (toneIdx !== this.lastToneIdx) {
      this.currentHarmCoeffs = this.harmLpfTable[toneIdx];
      this.lastToneIdx = toneIdx;
    }

    const numChannels = Math.min(input.length, output.length, 2);
    const blockSize = input[0].length;

    for (let ch = 0; ch < numChannels; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];

      for (let i = 0; i < blockSize; i++) {
        const dry = inputChannel[i];

        if (bypass) {
          outputChannel[i] = dry;
        } else {
          // --- Fundamental channel: gentle HPF @ 80Hz
          // HPF approximation: x - LPF80(x)
          const low = this.biquadStep(dry, this.dryLpfState[ch], this.lpf80);
          const fund = dry - low;

          // --- Odd / 3rd harmonic channel: hard clip -> LPF
          const oddSrc = this.hardClip(dry * 6.0);
          const odd = this.biquadStep(oddSrc, this.oddLpfState[ch], this.currentHarmCoeffs);

          // --- Even / 2nd harmonic channel: abs -> 4th order LPF (two cascaded biquads)
          let evenSrc = dry < 0 ? -dry : dry;
          evenSrc *= 6.0;
          let even = this.biquadStep(evenSrc, this.evenLpfAState[ch], this.currentHarmCoeffs);
          even = this.biquadStep(even, this.evenLpfBState[ch], this.currentHarmCoeffs);

          // --- Mix the three paths
          let out = fund * fundMix + even * evenMix + odd * oddMix;

          // --- Soft safety (soft limiter)
          const a = out < 0 ? -out : out;
          out = out / (1.0 + a);

          // Apply output level
          const wet = out * outputLevel;

          // Wet/dry mix
          outputChannel[i] = dry * (1 - mix) + wet * mix;
        }
      }
    }

    return true;
  }
}

/**
 * Tremolo Processor
 * LFO-modulated amplitude effect - ported from AudioNoise tremolo.h
 * Processes input audio by modulating its amplitude using an LFO
 */
class TremoloProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 5, minValue: 0.5, maxValue: 15 },    // LFO rate in Hz
      { name: 'depth', defaultValue: 0.5, minValue: 0, maxValue: 1 },    // Modulation depth 0-100%
      { name: 'waveform', defaultValue: 0, minValue: 0, maxValue: 1 },   // 0=sine, 1=triangle
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // LFO phase (0-1)
    this.phase = 0;
  }

  // Generate LFO value based on waveform type
  // Returns value in range -1 to 1
  getLfoValue(waveform) {
    if (waveform < 0.5) {
      // Sine wave
      return Math.sin(TWO_PI * this.phase);
    } else {
      // Triangle wave: convert phase to triangle
      // 0->0.25: 0->1, 0.25->0.75: 1->-1, 0.75->1: -1->0
      const p = this.phase;
      if (p < 0.25) {
        return p * 4;
      } else if (p < 0.75) {
        return 1 - (p - 0.25) * 4;
      } else {
        return -1 + (p - 0.75) * 4;
      }
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const rate = parameters.rate[0];
    const depth = parameters.depth[0];
    const waveform = parameters.waveform[0];

    const phaseIncrement = rate / sampleRate;
    const numChannels = Math.min(input.length, output.length);
    const blockSize = input[0].length;

    for (let i = 0; i < blockSize; i++) {
      // Get LFO value (-1 to 1)
      const lfo = this.getLfoValue(waveform);

      // Calculate gain multiplier
      // When LFO = 1, gain = 1 (no attenuation)
      // When LFO = -1, gain = 1 - depth (maximum attenuation)
      // Formula from AudioNoise: 1.0 - depth * (1.0 - lfo) * 0.5
      const gain = 1.0 - depth * (1.0 - lfo) * 0.5;

      for (let ch = 0; ch < numChannels; ch++) {
        const dry = input[ch][i];

        if (bypass) {
          output[ch][i] = dry;
        } else {
          const wet = dry * gain;
          output[ch][i] = dry * (1 - mix) + wet * mix;
        }
      }

      // Advance LFO phase
      this.phase = (this.phase + phaseIncrement) % 1;
    }

    return true;
  }
}

/**
 * Reverb Processor
 * Freeverb-style algorithmic reverb using parallel comb filters and series allpass filters
 * Based on the classic Schroeder-Moorer reverb design
 */
class ReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'roomSize', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'damping', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'preDelay', defaultValue: 10, minValue: 0, maxValue: 100 },
      { name: 'decay', defaultValue: 1.5, minValue: 0.1, maxValue: 10 },
      { name: 'width', defaultValue: 0.8, minValue: 0, maxValue: 1 },
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 0.3, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Freeverb comb filter delay times (in samples at 44100Hz, scaled for current sample rate)
    const scale = sampleRate / 44100;
    this.combDelays = [
      Math.floor(1116 * scale),
      Math.floor(1188 * scale),
      Math.floor(1277 * scale),
      Math.floor(1356 * scale),
      Math.floor(1422 * scale),
      Math.floor(1491 * scale),
      Math.floor(1557 * scale),
      Math.floor(1617 * scale),
    ];

    // Allpass filter delay times
    this.allpassDelays = [
      Math.floor(556 * scale),
      Math.floor(441 * scale),
      Math.floor(341 * scale),
      Math.floor(225 * scale),
    ];

    // Stereo spread (offset for right channel)
    this.stereoSpread = Math.floor(23 * scale);

    // Create comb filter buffers (8 per channel)
    this.combBuffersL = this.combDelays.map(d => new Float32Array(d + this.stereoSpread));
    this.combBuffersR = this.combDelays.map(d => new Float32Array(d + this.stereoSpread));
    this.combIndexL = new Array(8).fill(0);
    this.combIndexR = new Array(8).fill(0);
    this.combFilterState = [new Float32Array(8), new Float32Array(8)]; // Damping filter state

    // Create allpass filter buffers (4 per channel)
    this.allpassBuffersL = this.allpassDelays.map(d => new Float32Array(d + this.stereoSpread));
    this.allpassBuffersR = this.allpassDelays.map(d => new Float32Array(d + this.stereoSpread));
    this.allpassIndexL = new Array(4).fill(0);
    this.allpassIndexR = new Array(4).fill(0);

    // Pre-delay buffer (max 100ms)
    this.preDelaySize = Math.floor(sampleRate * 0.1);
    this.preDelayBuffer = [new Float32Array(this.preDelaySize), new Float32Array(this.preDelaySize)];
    this.preDelayIndex = 0;

    // Allpass feedback coefficient
    this.allpassFeedback = 0.5;
  }

  // Comb filter with damping (lowpass in feedback loop)
  processComb(input, buffer, index, bufferSize, feedback, damping, filterState, stateIdx) {
    const delayed = buffer[index];

    // One-pole lowpass filter for damping
    filterState[stateIdx] = delayed * (1 - damping) + filterState[stateIdx] * damping;

    // Write new sample with feedback
    buffer[index] = input + filterState[stateIdx] * feedback;

    return delayed;
  }

  // Allpass filter
  processAllpass(input, buffer, index, bufferSize) {
    const delayed = buffer[index];
    const output = -input + delayed;
    buffer[index] = input + delayed * this.allpassFeedback;
    return output;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const roomSize = parameters.roomSize[0];
    const damping = parameters.damping[0];
    const preDelayMs = parameters.preDelay[0];
    const decay = parameters.decay[0];
    const width = parameters.width[0];

    // Calculate feedback based on room size and decay
    const feedback = 0.7 + roomSize * 0.28; // Range 0.7-0.98
    const decayFactor = Math.pow(0.001, 1 / (decay * sampleRate)); // RT60 based decay

    const preDelaySamples = Math.floor(preDelayMs * sampleRate / 1000);
    const blockSize = input[0].length;

    // Stereo width processing coefficients
    const wet1 = (1 + width) / 2;
    const wet2 = (1 - width) / 2;

    for (let i = 0; i < blockSize; i++) {
      // Get input (mono sum for reverb input)
      const inputL = input[0] ? input[0][i] : 0;
      const inputR = input[1] ? input[1][i] : inputL;
      const monoIn = (inputL + inputR) * 0.5;

      if (bypass) {
        if (output[0]) output[0][i] = inputL;
        if (output[1]) output[1][i] = inputR;
        continue;
      }

      // Pre-delay
      const preDelayReadIdx = (this.preDelayIndex - preDelaySamples + this.preDelaySize) % this.preDelaySize;
      const preDelayed = this.preDelayBuffer[0][preDelayReadIdx];
      this.preDelayBuffer[0][this.preDelayIndex] = monoIn;
      this.preDelayIndex = (this.preDelayIndex + 1) % this.preDelaySize;

      // Process parallel comb filters
      let outL = 0;
      let outR = 0;

      for (let c = 0; c < 8; c++) {
        const delayL = this.combDelays[c];
        const delayR = delayL + this.stereoSpread;

        // Left channel comb
        outL += this.processComb(
          preDelayed,
          this.combBuffersL[c],
          this.combIndexL[c],
          delayL,
          feedback * decayFactor,
          damping,
          this.combFilterState[0],
          c
        );
        this.combIndexL[c] = (this.combIndexL[c] + 1) % delayL;

        // Right channel comb (with stereo spread)
        outR += this.processComb(
          preDelayed,
          this.combBuffersR[c],
          this.combIndexR[c],
          delayR,
          feedback * decayFactor,
          damping,
          this.combFilterState[1],
          c
        );
        this.combIndexR[c] = (this.combIndexR[c] + 1) % delayR;
      }

      // Scale comb output
      outL *= 0.125;
      outR *= 0.125;

      // Process series allpass filters
      for (let a = 0; a < 4; a++) {
        const delayL = this.allpassDelays[a];
        const delayR = delayL + this.stereoSpread;

        outL = this.processAllpass(outL, this.allpassBuffersL[a], this.allpassIndexL[a], delayL);
        this.allpassIndexL[a] = (this.allpassIndexL[a] + 1) % delayL;

        outR = this.processAllpass(outR, this.allpassBuffersR[a], this.allpassIndexR[a], delayR);
        this.allpassIndexR[a] = (this.allpassIndexR[a] + 1) % delayR;
      }

      // Apply stereo width
      const wetL = outL * wet1 + outR * wet2;
      const wetR = outR * wet1 + outL * wet2;

      // Mix output
      if (output[0]) output[0][i] = inputL * (1 - mix) + wetL * mix;
      if (output[1]) output[1][i] = inputR * (1 - mix) + wetR * mix;
    }

    return true;
  }
}

/**
 * GrowlingBass Processor
 * Growling/purring bass effect with subharmonic generation and harmonic distortion
 * Ported from C implementation by Philippe Strauss <catseyechandra@proton.me>
 *
 * Features:
 * - Minus one octave subharmonic generation (octave down)
 * - Odd harmonics via hard clipping with envelope-following
 * - Even harmonics via full-wave rectification
 * - Tunable tone control (LPF on harmonics)
 */
class GrowlingBassProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'subLevel', defaultValue: 0.5, minValue: 0, maxValue: 1 },      // Subharmonic level
      { name: 'oddLevel', defaultValue: 0.3, minValue: 0, maxValue: 1 },      // Odd harmonics level
      { name: 'evenLevel', defaultValue: 0.3, minValue: 0, maxValue: 1 },     // Even harmonics level
      { name: 'toneFreq', defaultValue: 800, minValue: 100, maxValue: 4000 }, // Tone filter frequency
      { name: 'bypass', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Biquad filter states [x1, x2, y1, y2] per channel
    // Input LPF @ 300Hz for subharmonic chain
    this.lpfInState = [[0, 0, 0, 0], [0, 0, 0, 0]];
    // Odd harmonics LPF
    this.lpfOddState = [[0, 0, 0, 0], [0, 0, 0, 0]];
    // Even harmonics LPF
    this.lpfEvenState = [[0, 0, 0, 0], [0, 0, 0, 0]];

    // Subharmonic tracking state per channel
    this.nPeriods = [0, 0];
    this.previousSign = [-1, -1];
    this.previousMinmax = [0, 0];
    this.minmax = [0, 0];

    // Pre-computed input LPF coefficients @ 300Hz, Q=0.707
    this.lpfInCoeffs = this.calcLpfCoeffs(300, 0.707);

    // Tone filter coefficients (will be updated when toneFreq changes)
    this.toneCoeffs = this.calcLpfCoeffs(800, 0.707);
    this.lastToneFreq = 800;
  }

  // Calculate 2nd order Butterworth LPF coefficients
  calcLpfCoeffs(fc, Q) {
    const w0 = TWO_PI * fc / sampleRate;
    const cos_w0 = Math.cos(w0);
    const sin_w0 = Math.sin(w0);
    const alpha = sin_w0 / (2 * Q);

    const a0 = 1 + alpha;
    return {
      b0: ((1 - cos_w0) / 2) / a0,
      b1: (1 - cos_w0) / a0,
      b2: ((1 - cos_w0) / 2) / a0,
      a1: (-2 * cos_w0) / a0,
      a2: (1 - alpha) / a0
    };
  }

  // Direct Form I biquad processing
  processBiquad(x, state, coeffs) {
    const y = coeffs.b0 * x + coeffs.b1 * state[0] + coeffs.b2 * state[1]
            - coeffs.a1 * state[2] - coeffs.a2 * state[3];
    state[1] = state[0];
    state[0] = x;
    state[3] = state[2];
    state[2] = y;
    return y;
  }

  // Hard clip for odd harmonics - clips at envelope-tracked ceiling
  hardClip(x, ceil) {
    if (x > 0.05) return ceil;
    if (x < -0.05) return -ceil;
    return x;
  }

  // Sign function for period detection
  sgn(x) {
    return x > 0 ? 1 : -1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) return true;

    const bypass = parameters.bypass[0] > 0.5;
    const mix = parameters.mix[0];
    const subLevel = parameters.subLevel[0];
    const oddLevel = parameters.oddLevel[0];
    const evenLevel = parameters.evenLevel[0];
    const toneFreq = parameters.toneFreq[0];

    // Update tone filter coefficients when frequency changes
    if (Math.abs(toneFreq - this.lastToneFreq) > 1) {
      this.toneCoeffs = this.calcLpfCoeffs(toneFreq, 0.707);
      this.lastToneFreq = toneFreq;
    }

    const numChannels = Math.min(input.length, output.length, 2);
    const blockSize = input[0].length;

    for (let ch = 0; ch < numChannels; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];

      for (let i = 0; i < blockSize; i++) {
        const dry = inputChannel[i];

        if (bypass) {
          outputChannel[i] = dry;
          continue;
        }

        // Input filter for subharmonic chain (300Hz LPF)
        const filteredIn = this.processBiquad(dry, this.lpfInState[ch], this.lpfInCoeffs);

        // Odd harmonics: hard clip with envelope-following ceiling
        const shapedOdd = this.hardClip(filteredIn, this.previousMinmax[ch]);

        // Even harmonics: full-wave rectification
        const shapedEven = Math.abs(dry);

        // Sign detection for period tracking
        const sign = this.sgn(filteredIn);

        // Rising edge detection - start of new period
        if ((sign - this.previousSign[ch]) > 1) {
          this.nPeriods[ch] += 1;
          this.previousMinmax[ch] = this.minmax[ch];
          this.minmax[ch] = 0;
        }

        // Track maximum amplitude for envelope
        const absDry = Math.abs(dry);
        if (absDry > this.minmax[ch]) {
          this.minmax[ch] = absDry;
        }

        // Subharmonic generation: output every other half-period
        let shapedSub = 0;
        if (sign > 0) {
          // One period over two
          if ((this.nPeriods[ch] % 2) === 0) {
            shapedSub = filteredIn;  // Output this alternance
          } else {
            shapedSub = -filteredIn; // Or its negative counterpart
          }
        }

        // Apply tone filter to harmonics
        const filteredOdd = this.processBiquad(shapedOdd, this.lpfOddState[ch], this.toneCoeffs);
        const filteredEven = this.processBiquad(shapedEven, this.lpfEvenState[ch], this.toneCoeffs);

        this.previousSign[ch] = sign;

        // Mix all components
        const wet = shapedSub * subLevel + dry
                  + filteredOdd * oddLevel
                  + filteredEven * evenLevel;

        // Soft limiter for safety
        const limited = wet / (1 + Math.abs(wet) * 0.5);

        // Wet/dry mix
        outputChannel[i] = dry * (1 - mix) + limited * mix;
      }
    }

    return true;
  }
}

// Register all processors
registerProcessor('eq-processor', EQProcessor);
registerProcessor('distortion-processor', DistortionProcessor);
registerProcessor('delay-processor', DelayProcessor);
registerProcessor('chorus-processor', ChorusProcessor);
registerProcessor('compressor-processor', CompressorProcessor);
registerProcessor('level-meter-processor', LevelMeterProcessor);
registerProcessor('basspurr-processor', BassPurrProcessor);
registerProcessor('tremolo-processor', TremoloProcessor);
registerProcessor('reverb-processor', ReverbProcessor);
registerProcessor('growlingbass-processor', GrowlingBassProcessor);
