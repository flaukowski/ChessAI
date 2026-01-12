# AudioNoise C Reference Files

This directory contains the original C-based DSP algorithms from the AudioNoise repository.
These files serve as reference for the TypeScript/Web Audio API implementations in `/client/src/lib/dsp/`.

## Original Source
- Repository: AudioNoise (guitar pedal DSP effects)
- Based on: RP2354/TAC5112 guitar pedal hardware

## Files

| C File | TypeScript Port | Description |
|--------|-----------------|-------------|
| `biquad.h` | `lib/dsp/biquad.ts` | Biquad IIR filters (lowpass, highpass, bandpass, notch, allpass) |
| `lfo.h` | `lib/dsp/lfo.ts` | Low Frequency Oscillator (sine, triangle, sawtooth) |
| `echo.h` | `lib/dsp/effects/echo.ts` | Delay-based echo effect with feedback |
| `flanger.h` | `lib/dsp/effects/flanger.ts` | Modulated delay flanger (based on DaisySP) |
| `phaser.h` | `lib/dsp/effects/phaser.ts` | 4-stage allpass cascade phaser |
| `effect.h` | `lib/dsp/delay-line.ts` | Shared effect state and delay buffer |
| `util.h` | `lib/dsp/delay-line.ts` | Utility functions (fastpow, limit_value, etc.) |
| `fm.h` | - | FM synthesis (not yet ported) |
| `discont.h` | - | Discontinuity handling (not yet ported) |

## Design Philosophy

From the original README:
> These are toy effects that you shouldn't take seriously. The main design goal has been to learn about digital audio processing basics.

Key characteristics:
- **Single sample in, single sample out** - No latency
- **IIR filters** - No fancy FFT-based processing
- **Simple implementations** - Emulates analog circuits digitally

## Porting Notes

The TypeScript ports maintain the same algorithmic approach but adapt to Web Audio API:
- Uses `AudioContext`, `AudioWorkletNode`, and built-in nodes where possible
- Preserves sample-accurate processing through worklets
- Adds real-time parameter control via React hooks
- Integrates with browser microphone/file input

## License

Original AudioNoise code: MIT License
