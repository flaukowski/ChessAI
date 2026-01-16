/**
 * AudioNoise DSP Library
 *
 * Complete audio DSP toolkit with AudioWorklet-based effects for
 * real-time, low-latency audio processing in the browser.
 *
 * Features:
 * - AudioWorklet-based effects (EQ, Distortion, Delay, Chorus, Compressor)
 * - Pedalboard-style effect chain management
 * - Input/output level metering
 * - Preset save/load/share system
 * - Offline WAV export
 * - Legacy effects (Echo, Flanger, Phaser, Biquad filters)
 * - Window functions for spectral analysis (Hann, Hamming, Blackman, etc.)
 * - Remez FIR filter design for linear-phase filtering
 */

// Legacy audio engine (for backward compatibility)
export * from './audio-engine';
export * from './lfo';
export * from './biquad';
export * from './delay-line';
export * from './effects';
export * from './bluetooth-audio-manager';

// New AudioWorklet-based pedalboard system
export * from './worklet-effects';
export * from './pedalboard-engine';
export * from './wav-export';

// DSP utilities adapted from dspml/dspc
export * from './window-functions';
export * from './remez-fir';
