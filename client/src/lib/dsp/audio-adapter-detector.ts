/**
 * Audio Adapter Detector
 * Heuristic-based detection of audio device connection types and instruments
 */

import {
  AudioConnectionType,
  InstrumentCategory,
  AudioAdapterDevice,
  DEFAULT_LATENCY_PROFILES,
} from './audio-adapter-types';

// Detection keyword maps
const BLUETOOTH_KEYWORDS = [
  'bluetooth',
  'bt',
  'wireless',
  'airpods',
  'bose',
  'sony wh',
  'sony wf',
  'jbl',
  'beats',
  'galaxy buds',
  'jabra',
  'sennheiser momentum',
  'anker',
  'skullcandy',
  'raycon',
  'tozo',
  'soundcore',
  'powerbeats',
  'wf-1000',
  'wh-1000',
  'quietcomfort',
  'marshall',
  'audio-technica ath-m',
];

const USB_KEYWORDS = [
  'usb',
  'focusrite',
  'scarlett',
  'behringer',
  'presonus',
  'motu',
  'universal audio',
  'steinberg',
  'native instruments',
  'audient',
  'zoom h',
  'zoom u',
  'tascam',
  'roland',
  'yamaha ag',
  'mackie',
  'audio interface',
  'm-audio',
  'apogee',
  'ssl',
  'rme',
  'line 6',
  'irig',
  'shure mv',
  'blue yeti',
  'elgato',
  'rode nt-usb',
  'samson',
  'audio-technica at2020usb',
];

const HDMI_KEYWORDS = [
  'hdmi',
  'displayport',
  'dp audio',
  'monitor',
  'tv audio',
  'nvidia',
  'amd high definition',
  'intel display',
  'realtek digital',
  'lg tv',
  'samsung tv',
  'digital output',
];

const BUILT_IN_KEYWORDS = [
  'built-in',
  'internal',
  'macbook',
  'laptop',
  'integrated',
  'realtek',
  'conexant',
  'cirrus',
  'synaptics',
  'apple audio',
  'default',
  'speakers (built',
  'microphone (built',
];

const AUDIO_JACK_KEYWORDS = [
  'headphone',
  'line in',
  'line out',
  'aux',
  'analog',
  'stereo mix',
  '3.5mm',
  '1/4',
  'phones',
  'external headphones',
  'headset',
  'rear panel',
  'front panel',
  'speakers (',
  'microphone (',
];

// Instrument detection patterns
const INSTRUMENT_PATTERNS: Array<{
  pattern: RegExp;
  category: InstrumentCategory;
}> = [
  { pattern: /guitar|fender|gibson|ibanez|epiphone|strat|tele|les paul/i, category: 'guitar' },
  { pattern: /bass|precision|jazz bass|p-bass|j-bass/i, category: 'bass' },
  { pattern: /keyboard|piano|synth|nord|korg|yamaha.*key|roland.*key/i, category: 'keyboard' },
  { pattern: /mic|microphone|sm57|sm58|condenser|dynamic|shure|rode|neumann|akg/i, category: 'microphone' },
  { pattern: /drum|pad|percussion|roland.*td|alesis/i, category: 'drums' },
  { pattern: /synth|moog|sequential|arturia|behringer.*synth|op-1/i, category: 'synthesizer' },
];

/**
 * Audio Adapter Detector Class
 * Provides heuristic-based detection of audio device connection types
 */
export class AudioAdapterDetector {
  /**
   * Detect the connection type from device label
   */
  static detectConnectionType(label: string): {
    type: AudioConnectionType;
    confidence: number;
  } {
    const lowerLabel = label.toLowerCase();

    // Check patterns in order of specificity
    const checks: Array<{ keywords: string[]; type: AudioConnectionType; weight: number }> = [
      { keywords: BLUETOOTH_KEYWORDS, type: 'bluetooth', weight: 1.0 },
      { keywords: USB_KEYWORDS, type: 'usb', weight: 0.9 },
      { keywords: HDMI_KEYWORDS, type: 'hdmi', weight: 0.85 },
      { keywords: BUILT_IN_KEYWORDS, type: 'built-in', weight: 0.7 },
      { keywords: AUDIO_JACK_KEYWORDS, type: 'audio-jack', weight: 0.6 },
    ];

    let bestMatch: { type: AudioConnectionType; confidence: number } = {
      type: 'unknown',
      confidence: 0.1,
    };

    for (const check of checks) {
      const matchCount = check.keywords.filter((kw) =>
        lowerLabel.includes(kw.toLowerCase())
      ).length;

      if (matchCount > 0) {
        // Higher confidence with more keyword matches, weighted by type specificity
        const confidence = Math.min(0.95, 0.5 + matchCount * 0.15) * check.weight;
        if (confidence > bestMatch.confidence) {
          bestMatch = { type: check.type, confidence };
        }
      }
    }

    // Default heuristics based on device ID patterns
    if (bestMatch.type === 'unknown') {
      if (label === '' || label.startsWith('default')) {
        return { type: 'built-in', confidence: 0.3 };
      }
      // Generic microphone/speaker without specific keywords likely built-in
      if (/^(microphone|speakers?)$/i.test(label.trim())) {
        return { type: 'built-in', confidence: 0.4 };
      }
    }

    return bestMatch;
  }

  /**
   * Detect instrument category from device label
   */
  static detectInstrumentCategory(label: string): InstrumentCategory | undefined {
    for (const { pattern, category } of INSTRUMENT_PATTERNS) {
      if (pattern.test(label)) {
        return category;
      }
    }
    return undefined;
  }

  /**
   * Get latency estimate based on connection type
   */
  static getLatencyEstimate(connectionType: AudioConnectionType): number {
    return DEFAULT_LATENCY_PROFILES[connectionType]?.typicalLatencyMs ?? 20;
  }

  /**
   * Parse USB vendor/product ID from device label (if available)
   * Some browsers include this in the label
   */
  static parseUsbIds(label: string): { vendorId?: string; productId?: string } {
    // Pattern: "Device Name (VID:PID)" or similar
    const match = label.match(/\(([0-9a-f]{4}):([0-9a-f]{4})\)/i);
    if (match) {
      return { vendorId: match[1], productId: match[2] };
    }
    // Alternative pattern: "vid_XXXX&pid_XXXX"
    const altMatch = label.match(/vid_([0-9a-f]{4}).*pid_([0-9a-f]{4})/i);
    if (altMatch) {
      return { vendorId: altMatch[1], productId: altMatch[2] };
    }
    return {};
  }

  /**
   * Enhance a basic MediaDeviceInfo into an AudioAdapterDevice
   */
  static enhanceDevice(device: MediaDeviceInfo): AudioAdapterDevice {
    const { type: connectionType, confidence } = this.detectConnectionType(device.label);
    const instrumentCategory =
      device.kind === 'audioinput' ? this.detectInstrumentCategory(device.label) : undefined;
    const { vendorId, productId } = this.parseUsbIds(device.label);

    return {
      id: device.deviceId,
      label:
        device.label ||
        `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 8)}`,
      kind: device.kind as 'audioinput' | 'audiooutput',
      groupId: device.groupId,
      isConnected: true,

      connectionType,
      connectionConfidence: confidence,

      instrumentCategory,

      latencyMs: this.getLatencyEstimate(connectionType),

      isBluetooth: connectionType === 'bluetooth',

      vendorId,
      productId,

      isJackPort: false,
    };
  }

  /**
   * Enhance multiple devices
   */
  static enhanceDevices(devices: MediaDeviceInfo[]): AudioAdapterDevice[] {
    return devices
      .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput')
      .map((d) => this.enhanceDevice(d));
  }

  /**
   * Group devices by connection type
   */
  static groupByConnectionType(
    devices: AudioAdapterDevice[]
  ): Map<AudioConnectionType, AudioAdapterDevice[]> {
    const grouped = new Map<AudioConnectionType, AudioAdapterDevice[]>();

    for (const device of devices) {
      const existing = grouped.get(device.connectionType) || [];
      existing.push(device);
      grouped.set(device.connectionType, existing);
    }

    return grouped;
  }

  /**
   * Filter devices by connection type
   */
  static filterByConnectionType(
    devices: AudioAdapterDevice[],
    type: AudioConnectionType
  ): AudioAdapterDevice[] {
    return devices.filter((d) => d.connectionType === type);
  }

  /**
   * Filter devices suitable for low-latency use
   */
  static filterLowLatency(
    devices: AudioAdapterDevice[],
    maxLatencyMs: number = 25
  ): AudioAdapterDevice[] {
    return devices.filter((d) => d.latencyMs <= maxLatencyMs);
  }

  /**
   * Filter input devices only
   */
  static filterInputs(devices: AudioAdapterDevice[]): AudioAdapterDevice[] {
    return devices.filter((d) => d.kind === 'audioinput');
  }

  /**
   * Filter output devices only
   */
  static filterOutputs(devices: AudioAdapterDevice[]): AudioAdapterDevice[] {
    return devices.filter((d) => d.kind === 'audiooutput');
  }

  /**
   * Get suggested preset for a device based on its characteristics
   */
  static getSuggestedPresetId(device: AudioAdapterDevice): string | undefined {
    // If instrument category is detected, suggest matching preset
    if (device.instrumentCategory) {
      switch (device.instrumentCategory) {
        case 'guitar':
          return 'electric-guitar';
        case 'bass':
          return 'bass-guitar';
        case 'keyboard':
          return 'audio-keyboard';
        case 'microphone':
          return device.connectionType === 'bluetooth' ? 'bluetooth-headset' : 'dynamic-mic';
        case 'drums':
          return 'drum-machine';
        case 'synthesizer':
          return 'synthesizer';
        default:
          return 'line-in';
      }
    }

    // Default suggestions based on connection type for generic inputs
    if (device.kind === 'audioinput') {
      switch (device.connectionType) {
        case 'bluetooth':
          return 'bluetooth-headset';
        case 'usb':
          return 'line-in'; // Could be anything via USB interface
        case 'audio-jack':
          return 'line-in';
        default:
          return 'line-in';
      }
    }

    return undefined;
  }
}

// Export singleton-style functions for convenience
export const detectConnectionType = AudioAdapterDetector.detectConnectionType.bind(AudioAdapterDetector);
export const detectInstrumentCategory = AudioAdapterDetector.detectInstrumentCategory.bind(AudioAdapterDetector);
export const enhanceDevice = AudioAdapterDetector.enhanceDevice.bind(AudioAdapterDetector);
export const enhanceDevices = AudioAdapterDetector.enhanceDevices.bind(AudioAdapterDetector);
