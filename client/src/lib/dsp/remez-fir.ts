/**
 * Remez Exchange Algorithm for FIR Filter Design
 * Adapted from dspml remez.ml and Jake Janovetz's C implementation
 *
 * Designs optimal linear-phase FIR filters using the Parks-McClellan algorithm.
 * The resulting filters have equiripple error in the passband and stopband.
 *
 * Reference: "FIR Digital Filter Design Techniques Using Weighted Chebyshev
 * Approximation" - Rabiner, Parks, McClellan (Proc. IEEE, Vol. 63, No. 4, 1975)
 */

export type RemezFilterType = 'bandpass' | 'differentiator' | 'hilbert';
export type RemezSymmetry = 'even' | 'odd';

export interface RemezBandSpec {
  lowFreq: number;   // Normalized frequency (0 to 0.5)
  highFreq: number;  // Normalized frequency (0 to 0.5)
  desired: number;   // Desired amplitude response
  weight: number;    // Error weight for this band
}

export interface RemezResult {
  coefficients: Float32Array;
  order: number;
  error: number;
  converged: boolean;
  iterations: number;
}

const GRID_DENSITY = 16;
const MAX_ITERATIONS = 40;
const CONVERGENCE_THRESHOLD = 1e-6;

/**
 * Design an FIR filter using the Remez exchange algorithm
 *
 * @param numTaps Number of filter coefficients (filter length)
 * @param bands Array of band specifications
 * @param filterType Type of filter ('bandpass', 'differentiator', 'hilbert')
 * @returns Filter coefficients and design info
 */
export function designRemezFilter(
  numTaps: number,
  bands: RemezBandSpec[],
  filterType: RemezFilterType = 'bandpass'
): RemezResult {
  // Validate inputs
  if (numTaps < 3) {
    throw new Error('Filter must have at least 3 taps');
  }
  if (bands.length < 1) {
    throw new Error('At least one band must be specified');
  }

  // Determine symmetry based on filter type and order
  const isOddLength = numTaps % 2 === 1;
  let symmetry: RemezSymmetry;

  if (filterType === 'bandpass') {
    symmetry = 'even';
  } else if (filterType === 'differentiator') {
    symmetry = 'odd';
  } else {
    symmetry = 'odd';
  }

  // Number of cosine coefficients
  const numCoeffs = isOddLength
    ? Math.floor((numTaps + 1) / 2)
    : Math.floor(numTaps / 2);

  // Create dense frequency grid
  const grid = createFrequencyGrid(bands, numCoeffs, filterType);

  // Initialize extremal frequencies
  let extremalIndices = initializeExtremalFrequencies(grid.freq.length, numCoeffs + 1);

  // Main Remez exchange loop
  let converged = false;
  let iterations = 0;
  let prevError = Infinity;
  let delta = 0;

  while (!converged && iterations < MAX_ITERATIONS) {
    iterations++;

    // Compute the Lagrange interpolation coefficients
    const { ad, x, y } = computeLagrangeCoeffs(
      extremalIndices,
      grid,
      filterType,
      symmetry,
      isOddLength
    );

    // Compute delta (the equiripple error)
    delta = computeDelta(ad, x, y, grid, extremalIndices);

    // Compute the frequency response on the dense grid
    const response = computeResponse(ad, x, delta, grid, extremalIndices, filterType, symmetry, isOddLength);

    // Find the new extremal frequencies
    const newExtremalIndices = findExtremalFrequencies(
      response,
      grid,
      numCoeffs + 1,
      delta
    );

    // Check for convergence
    const error = Math.abs(delta);
    if (Math.abs(error - prevError) < CONVERGENCE_THRESHOLD * error) {
      converged = true;
    }
    prevError = error;

    extremalIndices = newExtremalIndices;
  }

  // Compute final filter coefficients
  const coefficients = computeFilterCoefficients(
    extremalIndices,
    grid,
    numTaps,
    filterType,
    symmetry
  );

  return {
    coefficients,
    order: numTaps - 1,
    error: Math.abs(delta),
    converged,
    iterations,
  };
}

/**
 * Create the dense frequency grid for the Remez algorithm
 */
function createFrequencyGrid(
  bands: RemezBandSpec[],
  numCoeffs: number,
  filterType: RemezFilterType
): { freq: Float32Array; desired: Float32Array; weight: Float32Array } {
  // Calculate total grid points needed
  const gridPoints = numCoeffs * GRID_DENSITY;
  const freq: number[] = [];
  const desired: number[] = [];
  const weight: number[] = [];

  for (const band of bands) {
    const bandPoints = Math.max(
      Math.ceil(gridPoints * (band.highFreq - band.lowFreq) / 0.5),
      2
    );

    for (let i = 0; i < bandPoints; i++) {
      const f = band.lowFreq + (i / (bandPoints - 1)) * (band.highFreq - band.lowFreq);

      // Apply frequency-dependent weighting for differentiator
      let w = band.weight;
      let d = band.desired;

      if (filterType === 'differentiator') {
        // For differentiator, scale weight by frequency
        if (f > 0) {
          w = band.weight / f;
        }
        d = band.desired * f;
      } else if (filterType === 'hilbert') {
        // For Hilbert transformer, desired is always 1 in passband
        d = f > 0 ? 1 : 0;
      }

      freq.push(f);
      desired.push(d);
      weight.push(w);
    }
  }

  return {
    freq: new Float32Array(freq),
    desired: new Float32Array(desired),
    weight: new Float32Array(weight),
  };
}

/**
 * Initialize extremal frequencies uniformly
 */
function initializeExtremalFrequencies(gridSize: number, numExtremal: number): number[] {
  const indices: number[] = [];
  const step = (gridSize - 1) / (numExtremal - 1);

  for (let i = 0; i < numExtremal; i++) {
    indices.push(Math.round(i * step));
  }

  return indices;
}

/**
 * Compute Lagrange interpolation coefficients
 */
function computeLagrangeCoeffs(
  extremalIndices: number[],
  grid: { freq: Float32Array; desired: Float32Array; weight: Float32Array },
  filterType: RemezFilterType,
  symmetry: RemezSymmetry,
  isOddLength: boolean
): { ad: Float32Array; x: Float32Array; y: Float32Array } {
  const n = extremalIndices.length;
  const ad = new Float32Array(n);
  const x = new Float32Array(n);
  const y = new Float32Array(n);

  // Compute x values (cosines of extremal frequencies)
  for (let i = 0; i < n; i++) {
    const idx = extremalIndices[i];
    const freq = grid.freq[idx];

    // Transform frequency for different filter types
    if (symmetry === 'even' && isOddLength) {
      x[i] = Math.cos(2 * Math.PI * freq);
    } else if (symmetry === 'even' && !isOddLength) {
      x[i] = Math.cos(Math.PI * freq);
    } else if (symmetry === 'odd' && isOddLength) {
      x[i] = Math.cos(2 * Math.PI * freq);
    } else {
      x[i] = Math.cos(Math.PI * freq);
    }

    y[i] = grid.desired[idx];
  }

  // Compute Lagrange coefficients
  for (let i = 0; i < n; i++) {
    let denom = 1;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        denom *= x[i] - x[j];
      }
    }
    ad[i] = 1 / denom;
  }

  return { ad, x, y };
}

/**
 * Compute the equiripple error delta
 */
function computeDelta(
  ad: Float32Array,
  x: Float32Array,
  y: Float32Array,
  grid: { freq: Float32Array; desired: Float32Array; weight: Float32Array },
  extremalIndices: number[]
): number {
  const n = ad.length;
  let numer = 0;
  let denom = 0;
  let sign = 1;

  for (let i = 0; i < n; i++) {
    const idx = extremalIndices[i];
    numer += ad[i] * y[i];
    denom += sign * ad[i] / grid.weight[idx];
    sign = -sign;
  }

  return numer / denom;
}

/**
 * Compute the frequency response on the dense grid
 */
function computeResponse(
  ad: Float32Array,
  x: Float32Array,
  delta: number,
  grid: { freq: Float32Array; desired: Float32Array; weight: Float32Array },
  extremalIndices: number[],
  filterType: RemezFilterType,
  symmetry: RemezSymmetry,
  isOddLength: boolean
): Float32Array {
  const n = ad.length;
  const response = new Float32Array(grid.freq.length);

  for (let i = 0; i < grid.freq.length; i++) {
    const freq = grid.freq[i];

    // Transform frequency
    let xf: number;
    if (symmetry === 'even' && isOddLength) {
      xf = Math.cos(2 * Math.PI * freq);
    } else if (symmetry === 'even' && !isOddLength) {
      xf = Math.cos(Math.PI * freq);
    } else if (symmetry === 'odd' && isOddLength) {
      xf = Math.cos(2 * Math.PI * freq);
    } else {
      xf = Math.cos(Math.PI * freq);
    }

    // Check if we're at an extremal point
    let atExtremal = false;
    let sign = 1;
    for (let j = 0; j < extremalIndices.length; j++) {
      if (extremalIndices[j] === i) {
        response[i] = grid.desired[i] - sign * delta / grid.weight[i];
        atExtremal = true;
        break;
      }
      sign = -sign;
    }

    if (!atExtremal) {
      // Lagrange interpolation
      let numer = 0;
      let denom = 0;

      for (let j = 0; j < n - 1; j++) {
        const c = ad[j] / (xf - x[j]);
        const idx = extremalIndices[j];
        numer += c * grid.desired[idx];
        denom += c;
      }

      if (Math.abs(denom) > 1e-10) {
        response[i] = numer / denom;
      } else {
        response[i] = grid.desired[i];
      }
    }
  }

  return response;
}

/**
 * Find new extremal frequencies
 */
function findExtremalFrequencies(
  response: Float32Array,
  grid: { freq: Float32Array; desired: Float32Array; weight: Float32Array },
  numExtremal: number,
  delta: number
): number[] {
  // Compute weighted error at each grid point
  const error = new Float32Array(grid.freq.length);
  for (let i = 0; i < grid.freq.length; i++) {
    error[i] = grid.weight[i] * (grid.desired[i] - response[i]);
  }

  // Find local extrema
  const extrema: { index: number; error: number }[] = [];

  // Check first point
  if (grid.freq.length > 0 && Math.abs(error[0]) >= Math.abs(error[1])) {
    extrema.push({ index: 0, error: Math.abs(error[0]) });
  }

  // Check interior points
  for (let i = 1; i < grid.freq.length - 1; i++) {
    const prev = error[i - 1];
    const curr = error[i];
    const next = error[i + 1];

    // Local maximum or minimum
    if ((curr >= prev && curr >= next) || (curr <= prev && curr <= next)) {
      if (Math.abs(curr) > 1e-10) {
        extrema.push({ index: i, error: Math.abs(curr) });
      }
    }
  }

  // Check last point
  const last = grid.freq.length - 1;
  if (last > 0 && Math.abs(error[last]) >= Math.abs(error[last - 1])) {
    extrema.push({ index: last, error: Math.abs(error[last]) });
  }

  // Sort by error magnitude and take top numExtremal
  extrema.sort((a, b) => b.error - a.error);

  // Select extremal points, ensuring alternating signs
  const selected: number[] = [];
  let lastSign = 0;

  // First, sort candidates by index for sign alternation check
  const sortedByIndex = [...extrema].sort((a, b) => a.index - b.index);

  for (const ext of sortedByIndex) {
    const sign = error[ext.index] > 0 ? 1 : -1;
    if (selected.length === 0 || sign !== lastSign) {
      selected.push(ext.index);
      lastSign = sign;
      if (selected.length >= numExtremal) break;
    }
  }

  // If we don't have enough, add more from sorted list
  while (selected.length < numExtremal && extrema.length > 0) {
    for (const ext of extrema) {
      if (!selected.includes(ext.index)) {
        selected.push(ext.index);
        if (selected.length >= numExtremal) break;
      }
    }
  }

  // Sort final selection by index
  selected.sort((a, b) => a - b);

  return selected;
}

/**
 * Compute final filter coefficients from the extremal frequencies
 */
function computeFilterCoefficients(
  extremalIndices: number[],
  grid: { freq: Float32Array; desired: Float32Array; weight: Float32Array },
  numTaps: number,
  filterType: RemezFilterType,
  symmetry: RemezSymmetry
): Float32Array {
  const isOddLength = numTaps % 2 === 1;
  const numCoeffs = isOddLength
    ? Math.floor((numTaps + 1) / 2)
    : Math.floor(numTaps / 2);

  // Compute the A(f) polynomial coefficients via inverse DFT
  const alpha = new Float32Array(numCoeffs);

  // Create a fine grid for coefficient computation
  const fineGridSize = Math.max(numCoeffs * 8, 64);
  const fineResponse = new Float32Array(fineGridSize);

  // Interpolate the response onto a fine uniform grid
  const { ad, x } = computeLagrangeCoeffs(
    extremalIndices,
    grid,
    filterType,
    symmetry,
    isOddLength
  );

  for (let i = 0; i < fineGridSize; i++) {
    const freq = i / (2 * fineGridSize);

    let xf: number;
    if (symmetry === 'even' && isOddLength) {
      xf = Math.cos(2 * Math.PI * freq);
    } else if (symmetry === 'even' && !isOddLength) {
      xf = Math.cos(Math.PI * freq);
    } else {
      xf = Math.cos(2 * Math.PI * freq);
    }

    // Lagrange interpolation
    let numer = 0;
    let denom = 0;
    const n = extremalIndices.length;

    for (let j = 0; j < n - 1; j++) {
      const diff = xf - x[j];
      if (Math.abs(diff) < 1e-10) {
        numer = grid.desired[extremalIndices[j]];
        denom = 1;
        break;
      }
      const c = ad[j] / diff;
      numer += c * grid.desired[extremalIndices[j]];
      denom += c;
    }

    fineResponse[i] = denom !== 0 ? numer / denom : 0;
  }

  // Inverse DFT to get polynomial coefficients
  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let i = 0; i < fineGridSize; i++) {
      const freq = i / (2 * fineGridSize);
      if (symmetry === 'even' && isOddLength) {
        sum += fineResponse[i] * Math.cos(2 * Math.PI * k * freq);
      } else {
        sum += fineResponse[i] * Math.cos(Math.PI * k * freq);
      }
    }
    alpha[k] = sum / fineGridSize;
    if (k === 0) {
      alpha[k] /= 2;
    }
  }

  // Convert polynomial coefficients to filter coefficients
  const coefficients = new Float32Array(numTaps);

  if (symmetry === 'even') {
    if (isOddLength) {
      // Type I filter (odd length, even symmetry)
      const mid = Math.floor(numTaps / 2);
      coefficients[mid] = alpha[0];
      for (let i = 1; i < numCoeffs; i++) {
        coefficients[mid - i] = alpha[i] / 2;
        coefficients[mid + i] = alpha[i] / 2;
      }
    } else {
      // Type II filter (even length, even symmetry)
      const mid = numTaps / 2;
      for (let i = 0; i < numCoeffs; i++) {
        coefficients[mid - 1 - i] = alpha[i] / 2;
        coefficients[mid + i] = alpha[i] / 2;
      }
    }
  } else {
    // Odd symmetry (Type III or IV)
    if (isOddLength) {
      // Type III
      const mid = Math.floor(numTaps / 2);
      coefficients[mid] = 0;
      for (let i = 1; i < numCoeffs; i++) {
        coefficients[mid - i] = -alpha[i] / 2;
        coefficients[mid + i] = alpha[i] / 2;
      }
    } else {
      // Type IV
      const mid = numTaps / 2;
      for (let i = 0; i < numCoeffs; i++) {
        coefficients[mid - 1 - i] = -alpha[i] / 2;
        coefficients[mid + i] = alpha[i] / 2;
      }
    }
  }

  return coefficients;
}

/**
 * Convenience function to design a lowpass filter
 */
export function designLowpassFIR(
  numTaps: number,
  cutoffFreq: number,
  transitionWidth: number = 0.1,
  passbandWeight: number = 1,
  stopbandWeight: number = 1
): RemezResult {
  const stopFreq = Math.min(cutoffFreq + transitionWidth, 0.5);

  const bands: RemezBandSpec[] = [
    { lowFreq: 0, highFreq: cutoffFreq, desired: 1, weight: passbandWeight },
    { lowFreq: stopFreq, highFreq: 0.5, desired: 0, weight: stopbandWeight },
  ];

  return designRemezFilter(numTaps, bands, 'bandpass');
}

/**
 * Convenience function to design a highpass filter
 */
export function designHighpassFIR(
  numTaps: number,
  cutoffFreq: number,
  transitionWidth: number = 0.1,
  passbandWeight: number = 1,
  stopbandWeight: number = 1
): RemezResult {
  const stopFreq = Math.max(cutoffFreq - transitionWidth, 0);

  const bands: RemezBandSpec[] = [
    { lowFreq: 0, highFreq: stopFreq, desired: 0, weight: stopbandWeight },
    { lowFreq: cutoffFreq, highFreq: 0.5, desired: 1, weight: passbandWeight },
  ];

  // Highpass needs odd number of taps for Type I
  const adjustedTaps = numTaps % 2 === 0 ? numTaps + 1 : numTaps;

  return designRemezFilter(adjustedTaps, bands, 'bandpass');
}

/**
 * Convenience function to design a bandpass filter
 */
export function designBandpassFIR(
  numTaps: number,
  lowCutoff: number,
  highCutoff: number,
  transitionWidth: number = 0.05,
  passbandWeight: number = 1,
  stopbandWeight: number = 1
): RemezResult {
  const bands: RemezBandSpec[] = [
    { lowFreq: 0, highFreq: Math.max(lowCutoff - transitionWidth, 0), desired: 0, weight: stopbandWeight },
    { lowFreq: lowCutoff, highFreq: highCutoff, desired: 1, weight: passbandWeight },
    { lowFreq: Math.min(highCutoff + transitionWidth, 0.5), highFreq: 0.5, desired: 0, weight: stopbandWeight },
  ];

  return designRemezFilter(numTaps, bands, 'bandpass');
}

/**
 * Apply FIR filter to a signal using convolution
 */
export function applyFIRFilter(
  signal: Float32Array,
  coefficients: Float32Array
): Float32Array {
  const signalLen = signal.length;
  const filterLen = coefficients.length;
  const output = new Float32Array(signalLen);

  for (let i = 0; i < signalLen; i++) {
    let sum = 0;
    for (let j = 0; j < filterLen; j++) {
      const signalIdx = i - j + Math.floor(filterLen / 2);
      if (signalIdx >= 0 && signalIdx < signalLen) {
        sum += signal[signalIdx] * coefficients[j];
      }
    }
    output[i] = sum;
  }

  return output;
}

/**
 * Compute the frequency response of an FIR filter
 */
export function computeFIRFrequencyResponse(
  coefficients: Float32Array,
  numPoints: number = 512
): { frequencies: Float32Array; magnitude: Float32Array; phase: Float32Array } {
  const frequencies = new Float32Array(numPoints);
  const magnitude = new Float32Array(numPoints);
  const phase = new Float32Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    const freq = i / (2 * numPoints); // 0 to 0.5
    frequencies[i] = freq;

    // Compute frequency response via DFT at this frequency
    let real = 0;
    let imag = 0;

    for (let k = 0; k < coefficients.length; k++) {
      const angle = -2 * Math.PI * freq * k;
      real += coefficients[k] * Math.cos(angle);
      imag += coefficients[k] * Math.sin(angle);
    }

    magnitude[i] = Math.sqrt(real * real + imag * imag);
    phase[i] = Math.atan2(imag, real);
  }

  return { frequencies, magnitude, phase };
}
