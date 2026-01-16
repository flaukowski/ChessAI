/**
 * Window Functions for DSP
 * Adapted from dspml windows_cosine.ml
 *
 * Window functions are used for:
 * - FFT analysis (reduce spectral leakage)
 * - FIR filter design
 * - Audio crossfading
 */

/**
 * Rectangular window (no windowing)
 * Use when you need maximum frequency resolution but can tolerate spectral leakage
 */
export function rectangularWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    window[i] = 1.0;
  }
  return window;
}

/**
 * Hann window (raised cosine)
 * Good general-purpose window with excellent sidelobe suppression
 * Formula: w(n) = 0.5 * (1 - cos(2πn/(N-1)))
 */
export function hannWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  const factor = (2 * Math.PI) / (length - 1);

  for (let n = 0; n < length; n++) {
    window[n] = 0.5 * (1 - Math.cos(factor * n));
  }
  return window;
}

/**
 * Hamming window
 * Better main lobe characteristics than Hann, but worse sidelobe suppression
 * Formula: w(n) = 0.54 - 0.46 * cos(2πn/(N-1))
 */
export function hammingWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  const factor = (2 * Math.PI) / (length - 1);

  for (let n = 0; n < length; n++) {
    window[n] = 0.54 - 0.46 * Math.cos(factor * n);
  }
  return window;
}

/**
 * Blackman window
 * Very good sidelobe suppression, wider main lobe
 * Formula: w(n) = 0.42 - 0.5*cos(2πn/(N-1)) + 0.08*cos(4πn/(N-1))
 */
export function blackmanWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  const factor = (2 * Math.PI) / (length - 1);

  for (let n = 0; n < length; n++) {
    window[n] = 0.42 - 0.5 * Math.cos(factor * n) + 0.08 * Math.cos(2 * factor * n);
  }
  return window;
}

/**
 * Blackman-Harris window
 * Excellent sidelobe suppression (-92dB), very wide main lobe
 * Best for spectral analysis where dynamic range matters
 */
export function blackmanHarrisWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  const factor = (2 * Math.PI) / (length - 1);

  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;

  for (let n = 0; n < length; n++) {
    window[n] =
      a0 -
      a1 * Math.cos(factor * n) +
      a2 * Math.cos(2 * factor * n) -
      a3 * Math.cos(3 * factor * n);
  }
  return window;
}

/**
 * Tukey window (tapered cosine)
 * Flat top with cosine tapers - configurable trade-off between
 * rectangular (alpha=0) and Hann (alpha=1)
 *
 * @param length Window length
 * @param alpha Taper ratio (0-1). Default 0.5 is a good general choice
 */
export function tukeyWindow(length: number, alpha: number = 0.5): Float32Array {
  const window = new Float32Array(length);

  if (alpha <= 0) {
    // Rectangular
    for (let i = 0; i < length; i++) {
      window[i] = 1.0;
    }
    return window;
  }

  if (alpha >= 1) {
    // Hann
    return hannWindow(length);
  }

  const transitionSamples = Math.floor((alpha * length) / 2);
  const factor = Math.PI / transitionSamples;

  for (let n = 0; n < length; n++) {
    if (n < transitionSamples) {
      // Rising taper
      window[n] = 0.5 * (1 - Math.cos(factor * n));
    } else if (n >= length - transitionSamples) {
      // Falling taper
      window[n] = 0.5 * (1 - Math.cos(factor * (length - 1 - n)));
    } else {
      // Flat region
      window[n] = 1.0;
    }
  }
  return window;
}

/**
 * Kaiser window
 * Adjustable parameter allows trading off main lobe width vs sidelobe level
 *
 * @param length Window length
 * @param beta Shape parameter (0=rectangular, ~5=similar to Hamming, ~8.6=similar to Blackman)
 */
export function kaiserWindow(length: number, beta: number = 5): Float32Array {
  const window = new Float32Array(length);

  // Approximation of I0 (modified Bessel function of first kind, order 0)
  const bessel_i0 = (x: number): number => {
    let sum = 1.0;
    let term = 1.0;
    const halfX = x / 2;

    for (let k = 1; k < 20; k++) {
      term *= (halfX / k) * (halfX / k);
      sum += term;
      if (term < 1e-10 * sum) break;
    }
    return sum;
  };

  const denominator = bessel_i0(beta);
  const halfLength = (length - 1) / 2;

  for (let n = 0; n < length; n++) {
    const ratio = (n - halfLength) / halfLength;
    const arg = beta * Math.sqrt(1 - ratio * ratio);
    window[n] = bessel_i0(arg) / denominator;
  }
  return window;
}

/**
 * Raised cosine fade-in
 * For smooth audio transitions at the start of a segment
 */
export function fadeInWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  const factor = Math.PI / length;

  for (let n = 0; n < length; n++) {
    window[n] = 0.5 * (1 - Math.cos(factor * n));
  }
  return window;
}

/**
 * Raised cosine fade-out
 * For smooth audio transitions at the end of a segment
 */
export function fadeOutWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  const factor = Math.PI / length;

  for (let n = 0; n < length; n++) {
    window[n] = 0.5 * (1 + Math.cos(factor * n));
  }
  return window;
}

/**
 * Crossfade window pair
 * Returns [fadeOut, fadeIn] windows that sum to 1.0 (constant power crossfade)
 */
export function crossfadeWindows(length: number): [Float32Array, Float32Array] {
  const fadeOut = new Float32Array(length);
  const fadeIn = new Float32Array(length);
  const factor = (Math.PI / 2) / length;

  for (let n = 0; n < length; n++) {
    // Equal-power crossfade using sqrt of linear ramps
    const theta = factor * n;
    fadeOut[n] = Math.cos(theta);
    fadeIn[n] = Math.sin(theta);
  }
  return [fadeOut, fadeIn];
}

/**
 * Apply a window function to a signal buffer (in-place)
 */
export function applyWindow(signal: Float32Array, window: Float32Array): void {
  const length = Math.min(signal.length, window.length);
  for (let i = 0; i < length; i++) {
    signal[i] *= window[i];
  }
}

/**
 * Apply a window function to a signal buffer (returns new buffer)
 */
export function applyWindowCopy(signal: Float32Array, window: Float32Array): Float32Array {
  const length = Math.min(signal.length, window.length);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    output[i] = signal[i] * window[i];
  }
  return output;
}

export type WindowType =
  | 'rectangular'
  | 'hann'
  | 'hamming'
  | 'blackman'
  | 'blackman-harris'
  | 'tukey'
  | 'kaiser';

/**
 * Create a window by type name
 */
export function createWindow(
  type: WindowType,
  length: number,
  param?: number
): Float32Array {
  switch (type) {
    case 'rectangular':
      return rectangularWindow(length);
    case 'hann':
      return hannWindow(length);
    case 'hamming':
      return hammingWindow(length);
    case 'blackman':
      return blackmanWindow(length);
    case 'blackman-harris':
      return blackmanHarrisWindow(length);
    case 'tukey':
      return tukeyWindow(length, param ?? 0.5);
    case 'kaiser':
      return kaiserWindow(length, param ?? 5);
    default:
      return hannWindow(length);
  }
}
