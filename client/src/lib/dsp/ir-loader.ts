/**
 * Impulse Response (IR) Loader Utility
 *
 * Provides functionality to load impulse response files for convolution reverb:
 * - Load from WAV files (most common IR format)
 * - Load from audio URLs
 * - Load from user file uploads
 * - Automatic normalization and stereo/mono handling
 * - LRU caching for performance
 *
 * Supports common IR formats:
 * - WAV (PCM 16/24/32-bit, float 32-bit)
 * - AIFF
 * - FLAC (if browser supports)
 * - MP3 (not recommended for IRs due to lossy compression)
 * - OGG (not recommended for IRs due to lossy compression)
 */

export interface IRLoaderOptions {
  /** Normalize the IR amplitude (default: true) */
  normalize?: boolean;
  /** Target peak level for normalization in dB (default: -0.5) */
  targetPeakDb?: number;
  /** Convert mono IR to stereo (default: true) */
  monoToStereo?: boolean;
  /** Maximum IR length in seconds (default: 10) - longer IRs are trimmed */
  maxLengthSeconds?: number;
  /** Trim silence from start of IR (default: true) */
  trimSilence?: boolean;
  /** Silence threshold for trimming (default: 0.001) */
  silenceThreshold?: number;
  /** Apply fade out to prevent clicks (default: true) */
  applyFadeOut?: boolean;
  /** Fade out length in seconds (default: 0.05) */
  fadeOutLength?: number;
}

export interface LoadedIR {
  /** The AudioBuffer containing the IR */
  buffer: AudioBuffer;
  /** Original source (filename, URL, or 'generated') */
  source: string;
  /** Duration in seconds */
  duration: number;
  /** Sample rate */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Peak amplitude before normalization */
  originalPeak: number;
  /** Whether the IR was normalized */
  normalized: boolean;
  /** Timestamp when loaded */
  loadedAt: number;
}

export interface IRCacheStats {
  /** Number of items in cache */
  size: number;
  /** Maximum cache size */
  maxSize: number;
  /** Cache hit count */
  hits: number;
  /** Cache miss count */
  misses: number;
  /** Hit rate as percentage */
  hitRate: number;
}

/**
 * LRU Cache for loaded impulse responses
 */
class IRCache {
  private cache: Map<string, LoadedIR> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 20) {
    this.maxSize = maxSize;
  }

  get(key: string): LoadedIR | undefined {
    const item = this.cache.get(key);
    if (item) {
      this.hits++;
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
      return item;
    }
    this.misses++;
    return undefined;
  }

  set(key: string, value: LoadedIR): void {
    // If already exists, remove from current position
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }

    // Evict least recently used if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): IRCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Global cache instance
const irCache = new IRCache(20);

/**
 * Default loader options
 */
const DEFAULT_OPTIONS: Required<IRLoaderOptions> = {
  normalize: true,
  targetPeakDb: -0.5,
  monoToStereo: true,
  maxLengthSeconds: 10,
  trimSilence: true,
  silenceThreshold: 0.001,
  applyFadeOut: true,
  fadeOutLength: 0.05,
};

/**
 * Generate a cache key for an IR source
 */
function generateCacheKey(source: string, options: IRLoaderOptions): string {
  const optKey = JSON.stringify({
    normalize: options.normalize,
    targetPeakDb: options.targetPeakDb,
    monoToStereo: options.monoToStereo,
    maxLengthSeconds: options.maxLengthSeconds,
    trimSilence: options.trimSilence,
  });
  return `${source}::${optKey}`;
}

/**
 * Find the peak amplitude in an AudioBuffer
 */
function findPeakAmplitude(buffer: AudioBuffer): number {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

/**
 * Normalize an AudioBuffer to target peak level
 */
function normalizeBuffer(
  buffer: AudioBuffer,
  targetPeakDb: number
): { buffer: AudioBuffer; originalPeak: number } {
  const originalPeak = findPeakAmplitude(buffer);

  if (originalPeak === 0) {
    return { buffer, originalPeak: 0 };
  }

  // Convert dB to linear
  const targetPeak = Math.pow(10, targetPeakDb / 20);
  const gain = targetPeak / originalPeak;

  // Apply gain to all channels
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }

  return { buffer, originalPeak };
}

/**
 * Convert a mono AudioBuffer to stereo
 */
function convertMonoToStereo(
  context: BaseAudioContext,
  monoBuffer: AudioBuffer
): AudioBuffer {
  if (monoBuffer.numberOfChannels >= 2) {
    return monoBuffer;
  }

  const stereoBuffer = context.createBuffer(
    2,
    monoBuffer.length,
    monoBuffer.sampleRate
  );

  const monoData = monoBuffer.getChannelData(0);
  const leftChannel = stereoBuffer.getChannelData(0);
  const rightChannel = stereoBuffer.getChannelData(1);

  // Copy mono data to both channels
  leftChannel.set(monoData);
  rightChannel.set(monoData);

  return stereoBuffer;
}

/**
 * Find the first sample above the silence threshold
 */
function findSilenceEnd(buffer: AudioBuffer, threshold: number): number {
  let minStartSample = buffer.length;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        minStartSample = Math.min(minStartSample, i);
        break;
      }
    }
  }

  return minStartSample;
}

/**
 * Trim silence from the start of an AudioBuffer
 */
function trimSilenceFromStart(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  threshold: number
): AudioBuffer {
  const startSample = findSilenceEnd(buffer, threshold);

  if (startSample === 0 || startSample >= buffer.length) {
    return buffer;
  }

  const newLength = buffer.length - startSample;
  const trimmedBuffer = context.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    trimmedData.set(originalData.subarray(startSample));
  }

  return trimmedBuffer;
}

/**
 * Trim buffer to maximum length
 */
function trimToMaxLength(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  maxLengthSeconds: number
): AudioBuffer {
  const maxSamples = Math.ceil(maxLengthSeconds * buffer.sampleRate);

  if (buffer.length <= maxSamples) {
    return buffer;
  }

  const trimmedBuffer = context.createBuffer(
    buffer.numberOfChannels,
    maxSamples,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    trimmedData.set(originalData.subarray(0, maxSamples));
  }

  return trimmedBuffer;
}

/**
 * Apply fade out to prevent clicks at the end of the IR
 */
function applyFadeOut(buffer: AudioBuffer, fadeOutSeconds: number): void {
  const fadeOutSamples = Math.min(
    Math.ceil(fadeOutSeconds * buffer.sampleRate),
    buffer.length
  );

  const startSample = buffer.length - fadeOutSamples;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < fadeOutSamples; i++) {
      // Cosine fade for smooth transition
      const fadeGain = 0.5 * (1 + Math.cos((Math.PI * i) / fadeOutSamples));
      data[startSample + i] *= fadeGain;
    }
  }
}

/**
 * Process a raw AudioBuffer according to options
 */
function processIRBuffer(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  options: Required<IRLoaderOptions>
): { buffer: AudioBuffer; originalPeak: number; normalized: boolean } {
  let processedBuffer = buffer;
  let originalPeak = 0;
  let normalized = false;

  // Trim silence from start
  if (options.trimSilence) {
    processedBuffer = trimSilenceFromStart(
      context,
      processedBuffer,
      options.silenceThreshold
    );
  }

  // Trim to max length
  processedBuffer = trimToMaxLength(
    context,
    processedBuffer,
    options.maxLengthSeconds
  );

  // Convert mono to stereo
  if (options.monoToStereo && processedBuffer.numberOfChannels === 1) {
    processedBuffer = convertMonoToStereo(context, processedBuffer);
  }

  // Normalize
  if (options.normalize) {
    const result = normalizeBuffer(processedBuffer, options.targetPeakDb);
    originalPeak = result.originalPeak;
    normalized = true;
  } else {
    originalPeak = findPeakAmplitude(processedBuffer);
  }

  // Apply fade out
  if (options.applyFadeOut) {
    applyFadeOut(processedBuffer, options.fadeOutLength);
  }

  return { buffer: processedBuffer, originalPeak, normalized };
}

/**
 * Load an impulse response from a File object
 */
export async function loadIRFromFile(
  file: File,
  context: BaseAudioContext,
  options: IRLoaderOptions = {}
): Promise<LoadedIR> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = generateCacheKey(`file:${file.name}:${file.size}:${file.lastModified}`, opts);

  // Check cache
  const cached = irCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Decode audio data
  const rawBuffer = await context.decodeAudioData(arrayBuffer);

  // Process the buffer
  const { buffer, originalPeak, normalized } = processIRBuffer(
    context,
    rawBuffer,
    opts
  );

  const loadedIR: LoadedIR = {
    buffer,
    source: file.name,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    originalPeak,
    normalized,
    loadedAt: Date.now(),
  };

  // Cache the result
  irCache.set(cacheKey, loadedIR);

  return loadedIR;
}

/**
 * Load an impulse response from a URL
 */
export async function loadIRFromURL(
  url: string,
  context: BaseAudioContext,
  options: IRLoaderOptions = {}
): Promise<LoadedIR> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = generateCacheKey(`url:${url}`, opts);

  // Check cache
  const cached = irCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch the audio file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch IR from URL: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // Decode audio data
  const rawBuffer = await context.decodeAudioData(arrayBuffer);

  // Process the buffer
  const { buffer, originalPeak, normalized } = processIRBuffer(
    context,
    rawBuffer,
    opts
  );

  // Extract filename from URL for source
  const urlPath = new URL(url, window.location.origin).pathname;
  const filename = urlPath.split('/').pop() || url;

  const loadedIR: LoadedIR = {
    buffer,
    source: filename,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    originalPeak,
    normalized,
    loadedAt: Date.now(),
  };

  // Cache the result
  irCache.set(cacheKey, loadedIR);

  return loadedIR;
}

/**
 * Load an impulse response from an ArrayBuffer
 */
export async function loadIRFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  context: BaseAudioContext,
  sourceName: string = 'buffer',
  options: IRLoaderOptions = {}
): Promise<LoadedIR> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Decode audio data
  const rawBuffer = await context.decodeAudioData(arrayBuffer);

  // Process the buffer
  const { buffer, originalPeak, normalized } = processIRBuffer(
    context,
    rawBuffer,
    opts
  );

  const loadedIR: LoadedIR = {
    buffer,
    source: sourceName,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    originalPeak,
    normalized,
    loadedAt: Date.now(),
  };

  return loadedIR;
}

/**
 * Load an impulse response from a Base64 encoded string
 */
export async function loadIRFromBase64(
  base64: string,
  context: BaseAudioContext,
  sourceName: string = 'base64',
  options: IRLoaderOptions = {}
): Promise<LoadedIR> {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '');

  // Decode base64 to ArrayBuffer
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return loadIRFromArrayBuffer(bytes.buffer, context, sourceName, options);
}

/**
 * Wrap an existing AudioBuffer as a LoadedIR
 */
export function wrapBufferAsIR(
  buffer: AudioBuffer,
  sourceName: string = 'generated',
  options: IRLoaderOptions = {}
): LoadedIR {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let originalPeak = findPeakAmplitude(buffer);
  let normalized = false;

  // Apply normalization if requested
  if (opts.normalize) {
    const result = normalizeBuffer(buffer, opts.targetPeakDb);
    originalPeak = result.originalPeak;
    normalized = true;
  }

  return {
    buffer,
    source: sourceName,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    originalPeak,
    normalized,
    loadedAt: Date.now(),
  };
}

/**
 * Clear the IR cache
 */
export function clearIRCache(): void {
  irCache.clear();
}

/**
 * Get IR cache statistics
 */
export function getIRCacheStats(): IRCacheStats {
  return irCache.getStats();
}

/**
 * Get list of cached IR sources
 */
export function getCachedIRSources(): string[] {
  return irCache.keys();
}

/**
 * Remove a specific IR from cache
 */
export function removeIRFromCache(source: string): boolean {
  const keys = irCache.keys();
  let removed = false;
  for (const key of keys) {
    if (key.startsWith(source) || key.includes(source)) {
      irCache.delete(key);
      removed = true;
    }
  }
  return removed;
}

/**
 * Validate that a file is a supported audio format for IR loading
 */
export function validateIRFile(file: File): { isValid: boolean; reason?: string } {
  const supportedTypes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/aiff',
    'audio/x-aiff',
    'audio/flac',
    'audio/x-flac',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
  ];

  const supportedExtensions = ['.wav', '.wave', '.aiff', '.aif', '.flac', '.ogg', '.mp3'];

  // Check MIME type
  if (file.type && !supportedTypes.includes(file.type.toLowerCase())) {
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!supportedExtensions.includes(extension)) {
      return {
        isValid: false,
        reason: `Unsupported file type: ${file.type || extension}. Supported formats: WAV, AIFF, FLAC, OGG, MP3`,
      };
    }
  }

  // Check file size (warn if very large - over 50MB)
  const maxSizeBytes = 50 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      reason: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 50MB.`,
    };
  }

  // Warn about lossy formats but allow them
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (['.mp3', '.ogg'].includes(extension)) {
    console.warn(
      `Loading IR from lossy format (${extension}). For best quality, use WAV or AIFF format.`
    );
  }

  return { isValid: true };
}

/**
 * Create a file input handler for IR file uploads
 */
export function createIRFileHandler(
  context: BaseAudioContext,
  onLoad: (ir: LoadedIR) => void,
  onError?: (error: Error) => void,
  options: IRLoaderOptions = {}
): (event: Event) => Promise<void> {
  return async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const validation = validateIRFile(file);
    if (!validation.isValid) {
      const error = new Error(validation.reason);
      onError?.(error);
      return;
    }

    try {
      const ir = await loadIRFromFile(file, context, options);
      onLoad(ir);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Preload a list of IR URLs for faster access later
 */
export async function preloadIRs(
  urls: string[],
  context: BaseAudioContext,
  options: IRLoaderOptions = {},
  onProgress?: (loaded: number, total: number) => void
): Promise<LoadedIR[]> {
  const results: LoadedIR[] = [];
  let loaded = 0;

  for (const url of urls) {
    try {
      const ir = await loadIRFromURL(url, context, options);
      results.push(ir);
    } catch (error) {
      console.warn(`Failed to preload IR from ${url}:`, error);
    }
    loaded++;
    onProgress?.(loaded, urls.length);
  }

  return results;
}
