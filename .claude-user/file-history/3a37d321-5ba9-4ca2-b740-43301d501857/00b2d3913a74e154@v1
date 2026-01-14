/**
 * WAV Export Module
 * Renders audio through effect chain using OfflineAudioContext
 */

import {
  loadEffectWorklets,
  createWorkletEffect,
  type WorkletEffectType,
} from './worklet-effects';

export interface ExportOptions {
  sampleRate?: number;
  bitDepth?: 16 | 24 | 32;
  normalize?: boolean;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'complete';
  progress: number; // 0 to 1
}

/**
 * Export audio through effect chain to WAV file
 */
export async function exportToWav(
  audioBuffer: AudioBuffer,
  effects: Array<{
    type: WorkletEffectType;
    enabled: boolean;
    params: Record<string, number>;
  }>,
  inputGain: number,
  outputGain: number,
  options: ExportOptions = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const {
    sampleRate = audioBuffer.sampleRate,
    bitDepth = 16,
    normalize = false,
  } = options;

  onProgress?.({ phase: 'preparing', progress: 0 });

  // Create offline context
  const duration = audioBuffer.duration;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(duration * sampleRate),
    sampleRate
  );

  // Load worklets
  await loadEffectWorklets(offlineContext as unknown as AudioContext);

  onProgress?.({ phase: 'preparing', progress: 0.2 });

  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create gain nodes
  const inputGainNode = offlineContext.createGain();
  inputGainNode.gain.value = inputGain;

  const outputGainNode = offlineContext.createGain();
  outputGainNode.gain.value = outputGain;

  // Build effect chain
  const effectNodes: any[] = [];
  for (const effect of effects) {
    if (effect.enabled) {
      const node = createWorkletEffect(
        offlineContext as unknown as AudioContext,
        effect.type
      );

      // Set parameters
      const anyNode = node as any;
      if (typeof anyNode.setAllParams === 'function') {
        anyNode.setAllParams(effect.params);
      }
      if (effect.params.mix !== undefined) {
        anyNode.setMix(effect.params.mix);
      }

      effectNodes.push(node);
    }
  }

  onProgress?.({ phase: 'preparing', progress: 0.4 });

  // Connect nodes: source → inputGain → effects → outputGain → destination
  source.connect(inputGainNode);

  let currentNode: AudioNode = inputGainNode;
  for (const effectNode of effectNodes) {
    currentNode.connect(effectNode.input);
    currentNode = effectNode.output;
  }

  currentNode.connect(outputGainNode);
  outputGainNode.connect(offlineContext.destination);

  // Start source
  source.start(0);

  onProgress?.({ phase: 'rendering', progress: 0 });

  // Render
  const renderedBuffer = await offlineContext.startRendering();

  onProgress?.({ phase: 'encoding', progress: 0 });

  // Normalize if requested
  let outputData = extractChannelData(renderedBuffer);
  if (normalize) {
    outputData = normalizeAudio(outputData);
  }

  onProgress?.({ phase: 'encoding', progress: 0.5 });

  // Encode to WAV
  const wavBlob = encodeWav(outputData, sampleRate, bitDepth);

  onProgress?.({ phase: 'complete', progress: 1 });

  return wavBlob;
}

/**
 * Extract channel data from AudioBuffer
 */
function extractChannelData(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  return channels;
}

/**
 * Normalize audio to -1dB peak
 */
function normalizeAudio(channels: Float32Array[]): Float32Array[] {
  // Find peak
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak === 0) return channels;

  // Target peak is -1dB
  const targetPeak = Math.pow(10, -1 / 20);
  const gain = targetPeak / peak;

  // Apply gain
  return channels.map((channel) => {
    const normalized = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      normalized[i] = channel[i] * gain;
    }
    return normalized;
  });
}

/**
 * Encode audio data to WAV format
 */
function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 | 32
): Blob {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  // WAV file size
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  // Create buffer
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Write RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // Write fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // format (3 = float, 1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // Write data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data (interleaved)
  let offset = headerSize;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channels[ch][i];

      if (bitDepth === 16) {
        // 16-bit signed integer
        const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
        view.setInt16(offset, int16, true);
        offset += 2;
      } else if (bitDepth === 24) {
        // 24-bit signed integer
        const int24 = Math.max(-8388608, Math.min(8388607, Math.round(sample * 8388607)));
        view.setUint8(offset, int24 & 0xff);
        view.setUint8(offset + 1, (int24 >> 8) & 0xff);
        view.setUint8(offset + 2, (int24 >> 16) & 0xff);
        offset += 3;
      } else {
        // 32-bit float
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Load audio file and decode to AudioBuffer
 */
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer;
}

/**
 * Download WAV blob as file
 */
export function downloadWav(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
