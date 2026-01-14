/**
 * Audio Export Module
 * Supports exporting audio to multiple formats: WAV, MP3, OGG/WebM
 */

import { Mp3Encoder } from 'lamejs';
import {
  loadEffectWorklets,
  createWorkletEffect,
  type WorkletEffectType,
} from './worklet-effects';

export type AudioFormat = 'wav' | 'mp3' | 'ogg';

export interface ExportOptions {
  format: AudioFormat;
  sampleRate?: number;
  // WAV options
  bitDepth?: 16 | 24 | 32;
  // MP3 options
  bitrate?: 128 | 192 | 256 | 320;
  // Common options
  normalize?: boolean;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'complete';
  progress: number; // 0 to 1
}

export const FORMAT_INFO: Record<AudioFormat, { name: string; extension: string; mimeType: string; description: string }> = {
  wav: {
    name: 'WAV',
    extension: 'wav',
    mimeType: 'audio/wav',
    description: 'Uncompressed, lossless audio. Best quality, larger file size.',
  },
  mp3: {
    name: 'MP3',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    description: 'Compressed audio. Good quality, widely compatible.',
  },
  ogg: {
    name: 'OGG (Vorbis)',
    extension: 'ogg',
    mimeType: 'audio/ogg',
    description: 'Compressed audio. Good quality, open format.',
  },
};

/**
 * Export audio through effect chain to the specified format
 */
export async function exportAudio(
  audioBuffer: AudioBuffer,
  effects: Array<{
    type: WorkletEffectType;
    enabled: boolean;
    params: Record<string, number>;
  }>,
  inputGain: number,
  outputGain: number,
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const {
    format,
    sampleRate = audioBuffer.sampleRate,
    bitDepth = 16,
    bitrate = 192,
    normalize = false,
  } = options;

  onProgress?.({ phase: 'preparing', progress: 0 });

  // Create offline context for rendering
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

  // Extract and optionally normalize audio data
  let channelData = extractChannelData(renderedBuffer);
  if (normalize) {
    channelData = normalizeAudio(channelData);
  }

  onProgress?.({ phase: 'encoding', progress: 0.2 });

  // Encode to the specified format
  let blob: Blob;
  switch (format) {
    case 'wav':
      blob = encodeWav(channelData, sampleRate, bitDepth);
      break;
    case 'mp3':
      blob = await encodeMp3(channelData, sampleRate, bitrate, onProgress);
      break;
    case 'ogg':
      blob = await encodeOgg(renderedBuffer, onProgress);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  onProgress?.({ phase: 'complete', progress: 1 });

  return blob;
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
        const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
        view.setInt16(offset, int16, true);
        offset += 2;
      } else if (bitDepth === 24) {
        const int24 = Math.max(-8388608, Math.min(8388607, Math.round(sample * 8388607)));
        view.setUint8(offset, int24 & 0xff);
        view.setUint8(offset + 1, (int24 >> 8) & 0xff);
        view.setUint8(offset + 2, (int24 >> 16) & 0xff);
        offset += 3;
      } else {
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
 * Encode audio data to MP3 format using lamejs
 */
async function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  bitrate: number,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const numChannels = channels.length;
  const numSamples = channels[0].length;

  // Create encoder
  const encoder = new Mp3Encoder(numChannels, sampleRate, bitrate);

  // Convert Float32 samples to Int16
  const left = floatTo16BitPCM(channels[0]);
  const right = numChannels > 1 ? floatTo16BitPCM(channels[1]) : left;

  // Encode in chunks
  const mp3Data: Int8Array[] = [];
  const chunkSize = 1152; // MP3 frame size
  const totalChunks = Math.ceil(numSamples / chunkSize);

  for (let i = 0; i < numSamples; i += chunkSize) {
    const leftChunk = left.subarray(i, Math.min(i + chunkSize, numSamples));
    const rightChunk = right.subarray(i, Math.min(i + chunkSize, numSamples));

    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Report progress
    const chunkIndex = Math.floor(i / chunkSize);
    const progress = 0.2 + (chunkIndex / totalChunks) * 0.7;
    onProgress?.({ phase: 'encoding', progress });
  }

  // Flush remaining data
  const mp3buf = encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  onProgress?.({ phase: 'encoding', progress: 0.95 });

  // Combine all chunks
  const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    output.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
    offset += chunk.length;
  }

  return new Blob([output], { type: 'audio/mpeg' });
}

/**
 * Convert Float32Array to Int16Array for MP3 encoding
 */
function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16;
}

/**
 * Encode audio to OGG format using MediaRecorder
 * Falls back to WebM if OGG is not supported
 */
async function encodeOgg(
  audioBuffer: AudioBuffer,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create a new audio context to play the buffer
    const audioContext = new AudioContext({ sampleRate: audioBuffer.sampleRate });

    // Create a MediaStreamDestination to capture audio
    const destination = audioContext.createMediaStreamDestination();

    // Create buffer source
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);

    // Determine supported MIME type
    let mimeType = 'audio/ogg; codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm; codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
    }

    // Create MediaRecorder
    const mediaRecorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      await audioContext.close();
      const blob = new Blob(chunks, { type: mimeType.includes('ogg') ? 'audio/ogg' : 'audio/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = (event) => {
      audioContext.close();
      reject(new Error('MediaRecorder error'));
    };

    // Track progress based on time
    const duration = audioBuffer.duration;
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(0.2 + (elapsed / duration) * 0.75, 0.95);
      onProgress?.({ phase: 'encoding', progress });
    }, 100);

    source.onended = () => {
      clearInterval(progressInterval);
      // Small delay to ensure all data is captured
      setTimeout(() => {
        mediaRecorder.stop();
      }, 100);
    };

    // Start recording and playback
    mediaRecorder.start(100); // Collect data every 100ms
    source.start(0);
  });
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
 * Download audio blob as file
 */
export function downloadAudio(blob: Blob, filename: string, format: AudioFormat): void {
  const info = FORMAT_INFO[format];
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Ensure correct extension
  const baseName = filename.replace(/\.[^/.]+$/, '');
  a.download = `${baseName}.${info.extension}`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if a format is supported in the current browser
 */
export function isFormatSupported(format: AudioFormat): boolean {
  switch (format) {
    case 'wav':
    case 'mp3':
      return true;
    case 'ogg':
      // Check MediaRecorder support for OGG/WebM
      return typeof MediaRecorder !== 'undefined' &&
        (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus') ||
         MediaRecorder.isTypeSupported('audio/webm; codecs=opus') ||
         MediaRecorder.isTypeSupported('audio/webm'));
    default:
      return false;
  }
}
