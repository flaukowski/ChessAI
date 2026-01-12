/**
 * AudioNoise DSP Library
 * 
 * Complete audio DSP toolkit ported from C-based guitar pedal effects
 * to Web Audio API TypeScript implementation.
 * 
 * Original C source: https://github.com/torvalds/GuitarPedal (AudioNoise)
 * 
 * Features:
 * - LFO (Low Frequency Oscillator) with sine, triangle, sawtooth waveforms
 * - Biquad filters (lowpass, highpass, bandpass, notch, allpass)
 * - Delay line with interpolated reads
 * - Echo effect with feedback
 * - Flanger effect with modulated delay
 * - Phaser effect with 4-stage allpass cascade
 */

export * from './audio-engine';
export * from './lfo';
export * from './biquad';
export * from './delay-line';
export * from './effects';
