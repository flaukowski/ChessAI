/**
 * Audio Adapter Manager
 * Extended multi-channel audio device management with connection type detection,
 * instrument presets, and optional JACK server integration.
 *
 * Extends BluetoothAudioManager pattern with support for USB, HDMI, Audio Jack,
 * and virtual (JACK) audio devices.
 */

import {
  AudioConnectionType,
  InstrumentCategory,
  AudioAdapterDevice,
  InstrumentPreset,
  DEFAULT_INSTRUMENT_PRESETS,
  DEFAULT_LATENCY_PROFILES,
  JackServerState,
  JackPort,
} from './audio-adapter-types';
import { AudioAdapterDetector } from './audio-adapter-detector';

export interface AdapterAudioChannel {
  id: string;
  name: string;
  deviceId: string | null;
  type: 'input' | 'output';
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  latencyCompensationMs: number;
  stream?: MediaStream;
  sourceNode?: MediaStreamAudioSourceNode;
  gainNode?: GainNode;
  pannerNode?: StereoPannerNode;
  analyserNode?: AnalyserNode;
  delayNode?: DelayNode;

  // Extended properties
  connectionType: AudioConnectionType;
  instrumentPreset?: InstrumentPreset;
  latencyMs: number;
  isLowLatency: boolean;
}

export interface AdapterRoutingConnection {
  inputChannelId: string;
  outputChannelId: string;
  gain: number;
  enabled: boolean;
  latencyCompensationMs: number;
}

export type AdapterEventType =
  | 'device-discovered'
  | 'device-connected'
  | 'device-disconnected'
  | 'device-error'
  | 'channel-created'
  | 'channel-removed'
  | 'routing-changed'
  | 'bandwidth-warning'
  | 'latency-warning'
  | 'jack-connected'
  | 'jack-disconnected'
  | 'jack-ports-changed'
  | 'preset-applied';

export interface AdapterEvent {
  type: AdapterEventType;
  device?: AudioAdapterDevice;
  channel?: AdapterAudioChannel;
  error?: Error;
  data?: any;
}

type EventCallback = (event: AdapterEvent) => void;

const CHANNEL_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#ec4899', // pink
  '#3b82f6', // blue
  '#84cc16', // lime
];

const LOW_LATENCY_THRESHOLD_MS = 25;

export class AudioAdapterManager {
  private context: AudioContext | null = null;
  private devices: Map<string, AudioAdapterDevice> = new Map();
  private inputChannels: Map<string, AdapterAudioChannel> = new Map();
  private outputChannels: Map<string, AdapterAudioChannel> = new Map();
  private routingMatrix: Map<string, AdapterRoutingConnection> = new Map();
  private eventListeners: Set<EventCallback> = new Set();
  private channelColorIndex = 0;
  private masterGain: GainNode | null = null;
  private bandwidthMonitorInterval: number | null = null;

  // Bluetooth bandwidth management
  private activeStreams: Set<string> = new Set();
  private streamPriorities: Map<string, number> = new Map();
  private maxConcurrentBtStreams = 3;

  // Instrument presets
  private presets: Map<string, InstrumentPreset> = new Map();

  // JACK server state (optional integration)
  private jackState: JackServerState | null = null;
  private jackPorts: Map<string, JackPort> = new Map();

  constructor() {
    this.setupDeviceChangeListener();
    this.loadPresets();
  }

  private loadPresets(): void {
    for (const preset of DEFAULT_INSTRUMENT_PRESETS) {
      this.presets.set(preset.id, preset);
    }
  }

  async initialize(existingContext?: AudioContext): Promise<void> {
    this.context = existingContext || new AudioContext({ sampleRate: 48000 });

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    await this.discoverDevices();
    this.startBandwidthMonitor();
  }

  private setupDeviceChangeListener(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        await this.discoverDevices();
      });
    }
  }

  async discoverDevices(): Promise<AudioAdapterDevice[]> {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const enhancedDevices = AudioAdapterDetector.enhanceDevices(mediaDevices);
      const audioDevices: AudioAdapterDevice[] = [];

      for (const device of enhancedDevices) {
        const existingDevice = this.devices.get(device.id);
        if (!existingDevice) {
          this.emit({ type: 'device-discovered', device });
        }

        this.devices.set(device.id, device);
        audioDevices.push(device);
      }

      // Remove disconnected devices
      for (const [id, device] of this.devices) {
        if (!audioDevices.find(d => d.id === id)) {
          this.devices.delete(id);
          this.emit({ type: 'device-disconnected', device });
        }
      }

      return audioDevices;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  }

  async createInputChannel(
    deviceId: string,
    name?: string,
    presetId?: string
  ): Promise<AdapterAudioChannel | null> {
    if (!this.context) {
      console.error('AudioContext not initialized');
      return null;
    }

    const device = this.devices.get(deviceId);
    if (!device || device.kind !== 'audioinput') {
      console.error('Invalid input device');
      return null;
    }

    // Check Bluetooth bandwidth limits
    if (device.isBluetooth && !this.canAddBluetoothStream()) {
      this.emit({
        type: 'bandwidth-warning',
        data: { message: 'Bluetooth bandwidth limit reached. Consider disconnecting unused devices.' }
      });
    }

    // Warn about high-latency connections
    if (device.latencyMs > LOW_LATENCY_THRESHOLD_MS) {
      this.emit({
        type: 'latency-warning',
        device,
        data: {
          message: `${device.label} has ${device.latencyMs}ms latency. Consider using USB or audio jack for real-time playing.`,
          latencyMs: device.latencyMs,
        }
      });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        }
      });

      const channelId = `input-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const color = CHANNEL_COLORS[this.channelColorIndex++ % CHANNEL_COLORS.length];

      // Create audio nodes
      const sourceNode = this.context.createMediaStreamSource(stream);
      const gainNode = this.context.createGain();
      const pannerNode = this.context.createStereoPanner();
      const analyserNode = this.context.createAnalyser();
      analyserNode.fftSize = 256;
      
      // Create delay node for latency compensation (max 500ms)
      const delayNode = this.context.createDelay(0.5);
      delayNode.delayTime.value = 0; // Start with no delay

      // Connect: source -> gain -> delay -> panner -> analyser
      sourceNode.connect(gainNode);
      gainNode.connect(delayNode);
      delayNode.connect(pannerNode);
      pannerNode.connect(analyserNode);

      // Get or auto-detect preset
      let preset: InstrumentPreset | undefined;
      if (presetId) {
        preset = this.presets.get(presetId);
      } else {
        // Auto-detect based on device info
        const suggestedPresetId = AudioAdapterDetector.getSuggestedPresetId(device);
        if (suggestedPresetId) {
          preset = this.presets.get(suggestedPresetId);
        }
      }

      // Apply preset gain if available
      if (preset) {
        gainNode.gain.value = preset.recommendedGain;
      }

      const channel: AdapterAudioChannel = {
        id: channelId,
        name: name || device.label,
        deviceId,
        type: 'input',
        color,
        volume: preset?.recommendedGain ?? 1,
        pan: 0,
        muted: false,
        solo: false,
        latencyCompensationMs: 0,
        stream,
        sourceNode,
        gainNode,
        pannerNode,
        analyserNode,
        delayNode,
        connectionType: device.connectionType,
        instrumentPreset: preset,
        latencyMs: device.latencyMs,
        isLowLatency: device.latencyMs <= LOW_LATENCY_THRESHOLD_MS,
      };

      this.inputChannels.set(channelId, channel);

      if (device.isBluetooth) {
        this.activeStreams.add(channelId);
        this.streamPriorities.set(channelId, Date.now());
      }

      this.emit({ type: 'channel-created', channel });
      this.emit({ type: 'device-connected', device });

      if (preset) {
        this.emit({ type: 'preset-applied', channel, data: { preset } });
      }

      return channel;
    } catch (error) {
      console.error('Failed to create input channel:', error);
      this.emit({ type: 'device-error', error: error as Error });
      return null;
    }
  }

  async createOutputChannel(deviceId: string, name?: string): Promise<AdapterAudioChannel | null> {
    if (!this.context) {
      console.error('AudioContext not initialized');
      return null;
    }

    const device = this.devices.get(deviceId);
    if (!device || device.kind !== 'audiooutput') {
      console.error('Invalid output device');
      return null;
    }

    const channelId = `output-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const color = CHANNEL_COLORS[this.channelColorIndex++ % CHANNEL_COLORS.length];

    const gainNode = this.context.createGain();
    const analyserNode = this.context.createAnalyser();
    analyserNode.fftSize = 256;

    const destination = this.context.createMediaStreamDestination();
    gainNode.connect(analyserNode);
    analyserNode.connect(destination);

    // Create audio element to route to specific device
    const audioElement = new Audio();
    audioElement.srcObject = destination.stream;

    try {
      if ('setSinkId' in audioElement) {
        await (audioElement as any).setSinkId(deviceId);
      }
      await audioElement.play();
    } catch (error) {
      console.warn('Could not set output device:', error);
    }

    const channel: AdapterAudioChannel = {
      id: channelId,
      name: name || device.label,
      deviceId,
      type: 'output',
      color,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
      latencyCompensationMs: 0,
      gainNode,
      analyserNode,
      connectionType: device.connectionType,
      latencyMs: device.latencyMs,
      isLowLatency: device.latencyMs <= LOW_LATENCY_THRESHOLD_MS,
    };

    // Store audio element reference for cleanup
    (channel as any)._audioElement = audioElement;
    (channel as any)._destination = destination;

    this.outputChannels.set(channelId, channel);

    if (device.isBluetooth) {
      this.activeStreams.add(channelId);
    }

    this.emit({ type: 'channel-created', channel });
    return channel;
  }

  setRouting(
    inputChannelId: string,
    outputChannelId: string,
    gain: number = 1,
    enabled: boolean = true
  ): void {
    if (!this.context) return;

    const inputChannel = this.inputChannels.get(inputChannelId);
    const outputChannel = this.outputChannels.get(outputChannelId);

    if (!inputChannel || !outputChannel) {
      console.error('Invalid channel IDs for routing');
      return;
    }

    const routingKey = `${inputChannelId}->${outputChannelId}`;
    const existingRouting = this.routingMatrix.get(routingKey);

    // Calculate latency compensation
    const totalLatency = inputChannel.latencyMs + outputChannel.latencyMs;

    if (existingRouting) {
      existingRouting.gain = gain;
      existingRouting.enabled = enabled;
      existingRouting.latencyCompensationMs = totalLatency;
    } else {
      const routingGain = this.context.createGain();
      routingGain.gain.value = enabled ? gain : 0;

      if (inputChannel.pannerNode && outputChannel.gainNode) {
        inputChannel.pannerNode.connect(routingGain);
        routingGain.connect(outputChannel.gainNode);
      }

      const connection: AdapterRoutingConnection = {
        inputChannelId,
        outputChannelId,
        gain,
        enabled,
        latencyCompensationMs: totalLatency,
      };

      (connection as any)._gainNode = routingGain;
      this.routingMatrix.set(routingKey, connection);
    }

    this.emit({ type: 'routing-changed', data: { inputChannelId, outputChannelId, gain, enabled, totalLatency } });
  }

  updateRoutingGain(inputChannelId: string, outputChannelId: string, gain: number): void {
    const routingKey = `${inputChannelId}->${outputChannelId}`;
    const routing = this.routingMatrix.get(routingKey);

    if (routing && (routing as any)._gainNode) {
      (routing as any)._gainNode.gain.setValueAtTime(
        routing.enabled ? gain : 0,
        this.context?.currentTime || 0
      );
      routing.gain = gain;
    }
  }

  toggleRouting(inputChannelId: string, outputChannelId: string): void {
    const routingKey = `${inputChannelId}->${outputChannelId}`;
    const routing = this.routingMatrix.get(routingKey);

    if (routing && (routing as any)._gainNode) {
      routing.enabled = !routing.enabled;
      (routing as any)._gainNode.gain.setValueAtTime(
        routing.enabled ? routing.gain : 0,
        this.context?.currentTime || 0
      );
      this.emit({ type: 'routing-changed', data: routing });
    }
  }

  // Apply an instrument preset to a channel
  applyPreset(channelId: string, presetId: string): boolean {
    const channel = this.inputChannels.get(channelId);
    const preset = this.presets.get(presetId);

    if (!channel || !preset) {
      return false;
    }

    channel.instrumentPreset = preset;
    channel.volume = preset.recommendedGain;

    if (channel.gainNode) {
      channel.gainNode.gain.setValueAtTime(preset.recommendedGain, this.context?.currentTime || 0);
    }

    this.emit({ type: 'preset-applied', channel, data: { preset } });
    return true;
  }

  // Get presets compatible with a connection type
  getPresetsForConnectionType(connectionType: AudioConnectionType): InstrumentPreset[] {
    return Array.from(this.presets.values()).filter(
      preset => preset.connectionTypes.includes(connectionType)
    );
  }

  // Channel control methods
  setChannelVolume(channelId: string, volume: number): void {
    const channel = this.inputChannels.get(channelId) || this.outputChannels.get(channelId);
    if (channel?.gainNode) {
      const clampedVolume = Math.max(0, Math.min(2, volume));
      channel.gainNode.gain.setValueAtTime(clampedVolume, this.context?.currentTime || 0);
      channel.volume = clampedVolume;
    }
  }

  setChannelPan(channelId: string, pan: number): void {
    const channel = this.inputChannels.get(channelId);
    if (channel?.pannerNode) {
      const clampedPan = Math.max(-1, Math.min(1, pan));
      channel.pannerNode.pan.setValueAtTime(clampedPan, this.context?.currentTime || 0);
      channel.pan = clampedPan;
    }
  }

  setLatencyCompensation(channelId: string, latencyMs: number): void {
    const channel = this.inputChannels.get(channelId);
    if (channel?.delayNode) {
      // Clamp between 0 and 500ms
      const clampedLatency = Math.max(0, Math.min(500, latencyMs));
      const delaySec = clampedLatency / 1000;
      channel.delayNode.delayTime.setValueAtTime(delaySec, this.context?.currentTime || 0);
      channel.latencyCompensationMs = clampedLatency;
    }
  }

  getLatencyCompensation(channelId: string): number {
    const channel = this.inputChannels.get(channelId);
    return channel?.latencyCompensationMs || 0;
  }

  setChannelMute(channelId: string, muted: boolean): void {
    const channel = this.inputChannels.get(channelId) || this.outputChannels.get(channelId);
    if (channel?.gainNode) {
      if (muted) {
        channel.gainNode.gain.setValueAtTime(0, this.context?.currentTime || 0);
      } else {
        channel.gainNode.gain.setValueAtTime(channel.volume, this.context?.currentTime || 0);
      }
      channel.muted = muted;
    }
  }

  setChannelSolo(channelId: string, solo: boolean): void {
    const channel = this.inputChannels.get(channelId);
    if (channel) {
      channel.solo = solo;

      const hasSoloedChannel = Array.from(this.inputChannels.values()).some(ch => ch.solo);

      for (const [id, ch] of this.inputChannels) {
        if (hasSoloedChannel) {
          if (ch.solo) {
            ch.gainNode?.gain.setValueAtTime(ch.volume, this.context?.currentTime || 0);
          } else {
            ch.gainNode?.gain.setValueAtTime(0, this.context?.currentTime || 0);
          }
        } else {
          if (!ch.muted) {
            ch.gainNode?.gain.setValueAtTime(ch.volume, this.context?.currentTime || 0);
          }
        }
      }
    }
  }

  getChannelLevels(channelId: string): { peak: number; rms: number } {
    const channel = this.inputChannels.get(channelId) || this.outputChannels.get(channelId);
    if (!channel?.analyserNode) {
      return { peak: 0, rms: 0 };
    }

    const dataArray = new Uint8Array(channel.analyserNode.frequencyBinCount);
    channel.analyserNode.getByteTimeDomainData(dataArray);

    let peak = 0;
    let sum = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    return { peak, rms };
  }

  removeChannel(channelId: string): void {
    const inputChannel = this.inputChannels.get(channelId);
    const outputChannel = this.outputChannels.get(channelId);
    const channel = inputChannel || outputChannel;

    if (channel) {
      if (channel.stream) {
        channel.stream.getTracks().forEach(track => track.stop());
      }

      channel.sourceNode?.disconnect();
      channel.gainNode?.disconnect();
      channel.pannerNode?.disconnect();
      channel.analyserNode?.disconnect();

      if ((channel as any)._audioElement) {
        (channel as any)._audioElement.pause();
        (channel as any)._audioElement.srcObject = null;
      }

      for (const [key, routing] of this.routingMatrix) {
        if (routing.inputChannelId === channelId || routing.outputChannelId === channelId) {
          (routing as any)._gainNode?.disconnect();
          this.routingMatrix.delete(key);
        }
      }

      if (inputChannel) {
        this.inputChannels.delete(channelId);
      } else {
        this.outputChannels.delete(channelId);
      }

      this.activeStreams.delete(channelId);
      this.streamPriorities.delete(channelId);

      this.emit({ type: 'channel-removed', channel });
    }
  }

  private canAddBluetoothStream(): boolean {
    let btStreamCount = 0;
    for (const channelId of this.activeStreams) {
      const channel = this.inputChannels.get(channelId) || this.outputChannels.get(channelId);
      if (channel?.deviceId) {
        const device = this.devices.get(channel.deviceId);
        if (device?.isBluetooth) {
          btStreamCount++;
        }
      }
    }
    return btStreamCount < this.maxConcurrentBtStreams;
  }

  private startBandwidthMonitor(): void {
    this.bandwidthMonitorInterval = window.setInterval(() => {
      let btInputCount = 0;
      let btOutputCount = 0;

      for (const channel of this.inputChannels.values()) {
        if (channel.deviceId) {
          const device = this.devices.get(channel.deviceId);
          if (device?.isBluetooth) btInputCount++;
        }
      }

      for (const channel of this.outputChannels.values()) {
        if (channel.deviceId) {
          const device = this.devices.get(channel.deviceId);
          if (device?.isBluetooth) btOutputCount++;
        }
      }

      const totalBtStreams = btInputCount + btOutputCount;
      if (totalBtStreams >= this.maxConcurrentBtStreams) {
        this.emit({
          type: 'bandwidth-warning',
          data: {
            message: `High Bluetooth usage: ${totalBtStreams} streams active`,
            btInputCount,
            btOutputCount,
          }
        });
      }
    }, 1000);
  }

  // Event system
  on(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emit(event: AdapterEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  // Device getters with connection type filtering
  getDevices(): AudioAdapterDevice[] {
    return Array.from(this.devices.values());
  }

  getInputDevices(): AudioAdapterDevice[] {
    return Array.from(this.devices.values()).filter(d => d.kind === 'audioinput');
  }

  getOutputDevices(): AudioAdapterDevice[] {
    return Array.from(this.devices.values()).filter(d => d.kind === 'audiooutput');
  }

  getDevicesByConnectionType(connectionType: AudioConnectionType): AudioAdapterDevice[] {
    return AudioAdapterDetector.filterByConnectionType(
      Array.from(this.devices.values()),
      connectionType
    );
  }

  getLowLatencyDevices(maxLatencyMs: number = LOW_LATENCY_THRESHOLD_MS): AudioAdapterDevice[] {
    return AudioAdapterDetector.filterLowLatency(
      Array.from(this.devices.values()),
      maxLatencyMs
    );
  }

  getBluetoothDevices(): AudioAdapterDevice[] {
    return this.getDevicesByConnectionType('bluetooth');
  }

  getUsbDevices(): AudioAdapterDevice[] {
    return this.getDevicesByConnectionType('usb');
  }

  // Channel getters
  getInputChannels(): AdapterAudioChannel[] {
    return Array.from(this.inputChannels.values());
  }

  getOutputChannels(): AdapterAudioChannel[] {
    return Array.from(this.outputChannels.values());
  }

  getRoutingMatrix(): AdapterRoutingConnection[] {
    return Array.from(this.routingMatrix.values());
  }

  getRouting(inputChannelId: string, outputChannelId: string): AdapterRoutingConnection | undefined {
    return this.routingMatrix.get(`${inputChannelId}->${outputChannelId}`);
  }

  // Preset getters
  getPresets(): InstrumentPreset[] {
    return Array.from(this.presets.values());
  }

  getPreset(id: string): InstrumentPreset | undefined {
    return this.presets.get(id);
  }

  getPresetsByCategory(category: InstrumentCategory): InstrumentPreset[] {
    return Array.from(this.presets.values()).filter(p => p.category === category);
  }

  get audioContext(): AudioContext | null {
    return this.context;
  }

  // JACK server integration (optional)
  setJackState(state: JackServerState | null): void {
    const wasConnected = this.jackState?.isConnected ?? false;
    this.jackState = state;

    if (state?.isConnected && !wasConnected) {
      this.emit({ type: 'jack-connected', data: state });
    } else if (!state?.isConnected && wasConnected) {
      this.emit({ type: 'jack-disconnected' });
    }

    if (state?.ports) {
      for (const port of state.ports) {
        this.jackPorts.set(port.name, port);
      }
      this.emit({ type: 'jack-ports-changed', data: { ports: state.ports } });
    }
  }

  getJackState(): JackServerState | null {
    return this.jackState;
  }

  getJackPorts(): JackPort[] {
    return Array.from(this.jackPorts.values());
  }

  isJackConnected(): boolean {
    return this.jackState?.isConnected ?? false;
  }

  destroy(): void {
    if (this.bandwidthMonitorInterval) {
      clearInterval(this.bandwidthMonitorInterval);
    }

    for (const channelId of this.inputChannels.keys()) {
      this.removeChannel(channelId);
    }
    for (const channelId of this.outputChannels.keys()) {
      this.removeChannel(channelId);
    }

    this.devices.clear();
    this.jackPorts.clear();
    this.eventListeners.clear();
  }
}

// Singleton export
export const audioAdapterManager = new AudioAdapterManager();
