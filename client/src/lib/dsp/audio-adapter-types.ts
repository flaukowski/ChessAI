/**
 * Audio Adapter Types
 * Extended device categorization for multi-adapter instrument support
 * Supports: Bluetooth, USB, Audio Jack, HDMI, Built-in, and JACK virtual ports
 */

// Connection type enumeration
export type AudioConnectionType =
  | 'bluetooth'
  | 'usb'
  | 'audio-jack'
  | 'hdmi'
  | 'built-in'
  | 'virtual'
  | 'unknown';

// Instrument category for input devices
export type InstrumentCategory =
  | 'guitar'
  | 'bass'
  | 'keyboard'
  | 'microphone'
  | 'drums'
  | 'synthesizer'
  | 'line-in'
  | 'other';

// Impedance matching hint
export type ImpedanceHint = 'hi-z' | 'lo-z' | 'line' | 'unknown';

// Adapter performance profile
export interface AdapterProfile {
  connectionType: AudioConnectionType;
  typicalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  supportsLowLatency: boolean;
  impedanceMatching: ImpedanceHint;
  bitDepth: number[];
  sampleRates: number[];
}

// Extended device interface (supersedes BluetoothAudioDevice)
export interface AudioAdapterDevice {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
  isConnected: boolean;

  // Connection classification
  connectionType: AudioConnectionType;
  connectionConfidence: number; // 0-1, detection confidence

  // Instrument-specific (for inputs)
  instrumentCategory?: InstrumentCategory;
  instrumentPreset?: string;

  // Performance characteristics
  latencyMs: number;
  measuredLatencyMs?: number;

  // Bluetooth-specific (backward compatibility)
  isBluetooth: boolean;
  signalStrength?: number;
  batteryLevel?: number;

  // USB-specific
  vendorId?: string;
  productId?: string;
  usbClass?: string;

  // JACK-specific (for virtual ports)
  jackPortName?: string;
  jackClientName?: string;
  isJackPort: boolean;
}

// Instrument preset for quick configuration
export interface InstrumentPreset {
  id: string;
  name: string;
  category: InstrumentCategory;
  connectionTypes: AudioConnectionType[];
  recommendedGain: number;
  impedanceHint: ImpedanceHint;
  suggestedEffects?: string[];
  icon: string;
  description: string;
}

// JACK server connection state
export interface JackServerState {
  isConnected: boolean;
  isRunning: boolean;
  sampleRate: number;
  bufferSize: number;
  cpuLoad: number;
  xruns: number;
  ports: JackPort[];
}

export interface JackPort {
  name: string;
  clientName: string;
  portName: string;
  type: 'audio' | 'midi';
  direction: 'input' | 'output';
  isPhysical: boolean;
  connections: string[];
}

// Default latency profiles by connection type
export const DEFAULT_LATENCY_PROFILES: Record<AudioConnectionType, AdapterProfile> = {
  usb: {
    connectionType: 'usb',
    typicalLatencyMs: 5,
    minLatencyMs: 2,
    maxLatencyMs: 20,
    supportsLowLatency: true,
    impedanceMatching: 'unknown',
    bitDepth: [16, 24, 32],
    sampleRates: [44100, 48000, 96000],
  },
  'audio-jack': {
    connectionType: 'audio-jack',
    typicalLatencyMs: 8,
    minLatencyMs: 3,
    maxLatencyMs: 25,
    supportsLowLatency: true,
    impedanceMatching: 'line',
    bitDepth: [16, 24],
    sampleRates: [44100, 48000],
  },
  bluetooth: {
    connectionType: 'bluetooth',
    typicalLatencyMs: 40,
    minLatencyMs: 20,
    maxLatencyMs: 200,
    supportsLowLatency: false,
    impedanceMatching: 'unknown',
    bitDepth: [16],
    sampleRates: [44100, 48000],
  },
  hdmi: {
    connectionType: 'hdmi',
    typicalLatencyMs: 30,
    minLatencyMs: 10,
    maxLatencyMs: 100,
    supportsLowLatency: false,
    impedanceMatching: 'line',
    bitDepth: [16, 24],
    sampleRates: [44100, 48000],
  },
  'built-in': {
    connectionType: 'built-in',
    typicalLatencyMs: 10,
    minLatencyMs: 5,
    maxLatencyMs: 30,
    supportsLowLatency: true,
    impedanceMatching: 'line',
    bitDepth: [16, 24],
    sampleRates: [44100, 48000],
  },
  virtual: {
    connectionType: 'virtual',
    typicalLatencyMs: 3,
    minLatencyMs: 1,
    maxLatencyMs: 10,
    supportsLowLatency: true,
    impedanceMatching: 'line',
    bitDepth: [16, 24, 32],
    sampleRates: [44100, 48000, 96000, 192000],
  },
  unknown: {
    connectionType: 'unknown',
    typicalLatencyMs: 20,
    minLatencyMs: 5,
    maxLatencyMs: 100,
    supportsLowLatency: false,
    impedanceMatching: 'unknown',
    bitDepth: [16],
    sampleRates: [44100, 48000],
  },
};

// Default instrument presets
export const DEFAULT_INSTRUMENT_PRESETS: InstrumentPreset[] = [
  {
    id: 'electric-guitar',
    name: 'Electric Guitar',
    category: 'guitar',
    connectionTypes: ['usb', 'audio-jack'],
    recommendedGain: 1.2,
    impedanceHint: 'hi-z',
    suggestedEffects: ['distortion', 'delay', 'eq'],
    icon: 'Guitar',
    description: 'High impedance input for electric guitars',
  },
  {
    id: 'acoustic-guitar',
    name: 'Acoustic Guitar',
    category: 'guitar',
    connectionTypes: ['usb', 'audio-jack', 'bluetooth'],
    recommendedGain: 1.0,
    impedanceHint: 'line',
    suggestedEffects: ['compressor', 'eq', 'chorus'],
    icon: 'Guitar',
    description: 'Balanced input for acoustic pickups or mics',
  },
  {
    id: 'bass-guitar',
    name: 'Bass Guitar',
    category: 'bass',
    connectionTypes: ['usb', 'audio-jack'],
    recommendedGain: 1.1,
    impedanceHint: 'hi-z',
    suggestedEffects: ['compressor', 'eq'],
    icon: 'Music',
    description: 'High impedance input for bass guitars',
  },
  {
    id: 'midi-keyboard',
    name: 'MIDI Keyboard',
    category: 'keyboard',
    connectionTypes: ['usb'],
    recommendedGain: 1.0,
    impedanceHint: 'line',
    icon: 'Piano',
    description: 'USB MIDI controller or keyboard',
  },
  {
    id: 'audio-keyboard',
    name: 'Audio Keyboard/Synth',
    category: 'keyboard',
    connectionTypes: ['usb', 'audio-jack', 'hdmi'],
    recommendedGain: 0.9,
    impedanceHint: 'line',
    suggestedEffects: ['chorus', 'delay'],
    icon: 'Piano',
    description: 'Line-level audio from synthesizers',
  },
  {
    id: 'condenser-mic',
    name: 'Condenser Microphone',
    category: 'microphone',
    connectionTypes: ['usb', 'audio-jack'],
    recommendedGain: 1.3,
    impedanceHint: 'lo-z',
    suggestedEffects: ['compressor', 'eq'],
    icon: 'Mic',
    description: 'Sensitive condenser microphone',
  },
  {
    id: 'dynamic-mic',
    name: 'Dynamic Microphone',
    category: 'microphone',
    connectionTypes: ['usb', 'audio-jack'],
    recommendedGain: 1.5,
    impedanceHint: 'lo-z',
    suggestedEffects: ['compressor', 'eq'],
    icon: 'Mic',
    description: 'Dynamic microphone (SM57, SM58, etc.)',
  },
  {
    id: 'bluetooth-headset',
    name: 'Bluetooth Headset',
    category: 'microphone',
    connectionTypes: ['bluetooth'],
    recommendedGain: 1.0,
    impedanceHint: 'unknown',
    icon: 'Headphones',
    description: 'Wireless headset microphone',
  },
  {
    id: 'drum-machine',
    name: 'Drum Machine',
    category: 'drums',
    connectionTypes: ['usb', 'audio-jack'],
    recommendedGain: 0.9,
    impedanceHint: 'line',
    suggestedEffects: ['compressor'],
    icon: 'Disc',
    description: 'Electronic drums or drum machine',
  },
  {
    id: 'synthesizer',
    name: 'Synthesizer',
    category: 'synthesizer',
    connectionTypes: ['usb', 'audio-jack'],
    recommendedGain: 0.85,
    impedanceHint: 'line',
    suggestedEffects: ['delay', 'chorus'],
    icon: 'Waves',
    description: 'Hardware synthesizer output',
  },
  {
    id: 'line-in',
    name: 'Line In (Generic)',
    category: 'line-in',
    connectionTypes: ['usb', 'audio-jack', 'hdmi', 'built-in'],
    recommendedGain: 1.0,
    impedanceHint: 'line',
    icon: 'Cable',
    description: 'Generic line-level input',
  },
];

// Connection type display info
export const CONNECTION_TYPE_INFO: Record<
  AudioConnectionType,
  { label: string; icon: string; color: string }
> = {
  bluetooth: { label: 'Bluetooth', icon: 'Bluetooth', color: '#3b82f6' },
  usb: { label: 'USB', icon: 'Usb', color: '#10b981' },
  'audio-jack': { label: 'Audio Jack', icon: 'Plug', color: '#f59e0b' },
  hdmi: { label: 'HDMI', icon: 'Monitor', color: '#8b5cf6' },
  'built-in': { label: 'Built-in', icon: 'Cpu', color: '#6b7280' },
  virtual: { label: 'Virtual', icon: 'Layers', color: '#06b6d4' },
  unknown: { label: 'Unknown', icon: 'HelpCircle', color: '#9ca3af' },
};

// Helper to get latency color
export function getLatencyColor(ms: number): string {
  if (ms < 10) return '#10b981'; // green - excellent
  if (ms < 25) return '#f59e0b'; // yellow - good
  if (ms < 50) return '#f97316'; // orange - acceptable
  return '#ef4444'; // red - high latency
}

// Helper to get latency label
export function getLatencyLabel(ms: number): string {
  if (ms < 10) return 'Excellent';
  if (ms < 25) return 'Good';
  if (ms < 50) return 'Acceptable';
  return 'High';
}
