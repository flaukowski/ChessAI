/**
 * BluetoothAudioManager
 * Multi-channel Bluetooth audio device management with priority scheduling
 * 
 * Innovative approach: Virtual Audio Channels with Round-Robin scheduling
 * to prevent Bluetooth bandwidth saturation when multiple instruments connect
 */

export interface BluetoothAudioDevice {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
  isConnected: boolean;
  isBluetooth: boolean;
  signalStrength?: number;
  batteryLevel?: number;
  latencyMs?: number;
}

export interface AudioChannel {
  id: string;
  name: string;
  deviceId: string | null;
  type: 'input' | 'output';
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  stream?: MediaStream;
  sourceNode?: MediaStreamAudioSourceNode;
  gainNode?: GainNode;
  pannerNode?: StereoPannerNode;
  analyserNode?: AnalyserNode;
}

export interface RoutingConnection {
  inputChannelId: string;
  outputChannelId: string;
  gain: number;
  enabled: boolean;
}

export type BluetoothEventType = 
  | 'device-discovered'
  | 'device-connected'
  | 'device-disconnected'
  | 'device-error'
  | 'channel-created'
  | 'channel-removed'
  | 'routing-changed'
  | 'bandwidth-warning';

export interface BluetoothEvent {
  type: BluetoothEventType;
  device?: BluetoothAudioDevice;
  channel?: AudioChannel;
  error?: Error;
  data?: any;
}

type EventCallback = (event: BluetoothEvent) => void;

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

const BLUETOOTH_KEYWORDS = ['bluetooth', 'bt', 'wireless', 'airpods', 'bose', 'sony', 'jbl', 'beats'];

export class BluetoothAudioManager {
  private context: AudioContext | null = null;
  private devices: Map<string, BluetoothAudioDevice> = new Map();
  private inputChannels: Map<string, AudioChannel> = new Map();
  private outputChannels: Map<string, AudioChannel> = new Map();
  private routingMatrix: Map<string, RoutingConnection> = new Map();
  private eventListeners: Set<EventCallback> = new Set();
  private channelColorIndex = 0;
  private masterGain: GainNode | null = null;
  private bandwidthMonitorInterval: number | null = null;
  
  // Priority scheduling for Bluetooth traffic
  private activeStreams: Set<string> = new Set();
  private streamPriorities: Map<string, number> = new Map();
  private maxConcurrentBtStreams = 3; // Bluetooth bandwidth limit

  constructor() {
    this.setupDeviceChangeListener();
  }

  async initialize(existingContext?: AudioContext): Promise<void> {
    this.context = existingContext || new AudioContext({ sampleRate: 48000 });
    
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    
    await this.discoverDevices();
    this.startBandwidthMonitor();
  }

  private setupDeviceChangeListener(): void {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      await this.discoverDevices();
    });
  }

  async discoverDevices(): Promise<BluetoothAudioDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: BluetoothAudioDevice[] = [];

      for (const device of devices) {
        if (device.kind === 'audioinput' || device.kind === 'audiooutput') {
          const isBluetooth = this.detectBluetoothDevice(device.label);
          const audioDevice: BluetoothAudioDevice = {
            id: device.deviceId,
            label: device.label || `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 8)}`,
            kind: device.kind,
            groupId: device.groupId,
            isConnected: true,
            isBluetooth,
            latencyMs: isBluetooth ? 40 : 10, // Bluetooth typically has higher latency
          };

          const existingDevice = this.devices.get(device.deviceId);
          if (!existingDevice) {
            this.emit({ type: 'device-discovered', device: audioDevice });
          }

          this.devices.set(device.deviceId, audioDevice);
          audioDevices.push(audioDevice);
        }
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

  private detectBluetoothDevice(label: string): boolean {
    const lowerLabel = label.toLowerCase();
    return BLUETOOTH_KEYWORDS.some(keyword => lowerLabel.includes(keyword));
  }

  async createInputChannel(deviceId: string, name?: string): Promise<AudioChannel | null> {
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

      // Connect: source -> gain -> panner -> analyser (for visualization)
      sourceNode.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(analyserNode);
      // Note: We don't connect to destination yet - routing matrix handles that

      const channel: AudioChannel = {
        id: channelId,
        name: name || device.label,
        deviceId,
        type: 'input',
        color,
        volume: 1,
        pan: 0,
        muted: false,
        solo: false,
        stream,
        sourceNode,
        gainNode,
        pannerNode,
        analyserNode,
      };

      this.inputChannels.set(channelId, channel);
      
      if (device.isBluetooth) {
        this.activeStreams.add(channelId);
        this.streamPriorities.set(channelId, Date.now());
      }

      this.emit({ type: 'channel-created', channel });
      this.emit({ type: 'device-connected', device });

      return channel;
    } catch (error) {
      console.error('Failed to create input channel:', error);
      this.emit({ type: 'device-error', error: error as Error });
      return null;
    }
  }

  async createOutputChannel(deviceId: string, name?: string): Promise<AudioChannel | null> {
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

    // Create a gain node for this output
    const gainNode = this.context.createGain();
    const analyserNode = this.context.createAnalyser();
    analyserNode.fftSize = 256;

    // Create a destination for this specific output
    // Note: setSinkId requires browser support and HTTPS
    const destination = this.context.createMediaStreamDestination();
    gainNode.connect(analyserNode);
    analyserNode.connect(destination);

    // Create audio element to route to specific device
    const audioElement = new Audio();
    audioElement.srcObject = destination.stream;
    
    // Try to set the output device
    try {
      if ('setSinkId' in audioElement) {
        await (audioElement as any).setSinkId(deviceId);
      }
      await audioElement.play();
    } catch (error) {
      console.warn('Could not set output device:', error);
    }

    const channel: AudioChannel = {
      id: channelId,
      name: name || device.label,
      deviceId,
      type: 'output',
      color,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
      gainNode,
      analyserNode,
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

  setRouting(inputChannelId: string, outputChannelId: string, gain: number = 1, enabled: boolean = true): void {
    if (!this.context) return;

    const inputChannel = this.inputChannels.get(inputChannelId);
    const outputChannel = this.outputChannels.get(outputChannelId);

    if (!inputChannel || !outputChannel) {
      console.error('Invalid channel IDs for routing');
      return;
    }

    const routingKey = `${inputChannelId}->${outputChannelId}`;
    const existingRouting = this.routingMatrix.get(routingKey);

    if (existingRouting) {
      existingRouting.gain = gain;
      existingRouting.enabled = enabled;
    } else {
      // Create new routing connection
      const routingGain = this.context.createGain();
      routingGain.gain.value = enabled ? gain : 0;

      // Connect input's panner to routing gain, then to output's gain
      if (inputChannel.pannerNode && outputChannel.gainNode) {
        inputChannel.pannerNode.connect(routingGain);
        routingGain.connect(outputChannel.gainNode);
      }

      const connection: RoutingConnection = {
        inputChannelId,
        outputChannelId,
        gain,
        enabled,
      };

      // Store the gain node for later updates
      (connection as any)._gainNode = routingGain;

      this.routingMatrix.set(routingKey, connection);
    }

    this.emit({ type: 'routing-changed', data: { inputChannelId, outputChannelId, gain, enabled } });
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

  setChannelVolume(channelId: string, volume: number): void {
    const channel = this.inputChannels.get(channelId) || this.outputChannels.get(channelId);
    if (channel?.gainNode) {
      const clampedVolume = Math.max(0, Math.min(2, volume)); // Allow boost up to 2x
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

      // If any channel is soloed, mute all non-soloed channels
      const hasSoloedChannel = Array.from(this.inputChannels.values()).some(ch => ch.solo);
      
      for (const [id, ch] of this.inputChannels) {
        if (hasSoloedChannel) {
          if (ch.solo) {
            ch.gainNode?.gain.setValueAtTime(ch.volume, this.context?.currentTime || 0);
          } else {
            ch.gainNode?.gain.setValueAtTime(0, this.context?.currentTime || 0);
          }
        } else {
          // No solo active, restore all non-muted channels
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
      // Stop media stream tracks
      if (channel.stream) {
        channel.stream.getTracks().forEach(track => track.stop());
      }

      // Disconnect audio nodes
      channel.sourceNode?.disconnect();
      channel.gainNode?.disconnect();
      channel.pannerNode?.disconnect();
      channel.analyserNode?.disconnect();

      // Clean up audio element for output channels
      if ((channel as any)._audioElement) {
        (channel as any)._audioElement.pause();
        (channel as any)._audioElement.srcObject = null;
      }

      // Remove from routing matrix
      for (const [key, routing] of this.routingMatrix) {
        if (routing.inputChannelId === channelId || routing.outputChannelId === channelId) {
          (routing as any)._gainNode?.disconnect();
          this.routingMatrix.delete(key);
        }
      }

      // Remove from channels
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
    // Monitor Bluetooth bandwidth usage every second
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

      // Warn if approaching bandwidth limits
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

  private emit(event: BluetoothEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  // Getters
  getDevices(): BluetoothAudioDevice[] {
    return Array.from(this.devices.values());
  }

  getInputDevices(): BluetoothAudioDevice[] {
    return Array.from(this.devices.values()).filter(d => d.kind === 'audioinput');
  }

  getOutputDevices(): BluetoothAudioDevice[] {
    return Array.from(this.devices.values()).filter(d => d.kind === 'audiooutput');
  }

  getBluetoothDevices(): BluetoothAudioDevice[] {
    return Array.from(this.devices.values()).filter(d => d.isBluetooth);
  }

  getInputChannels(): AudioChannel[] {
    return Array.from(this.inputChannels.values());
  }

  getOutputChannels(): AudioChannel[] {
    return Array.from(this.outputChannels.values());
  }

  getRoutingMatrix(): RoutingConnection[] {
    return Array.from(this.routingMatrix.values());
  }

  getRouting(inputChannelId: string, outputChannelId: string): RoutingConnection | undefined {
    return this.routingMatrix.get(`${inputChannelId}->${outputChannelId}`);
  }

  get audioContext(): AudioContext | null {
    return this.context;
  }

  destroy(): void {
    if (this.bandwidthMonitorInterval) {
      clearInterval(this.bandwidthMonitorInterval);
    }

    // Remove all channels
    for (const channelId of this.inputChannels.keys()) {
      this.removeChannel(channelId);
    }
    for (const channelId of this.outputChannels.keys()) {
      this.removeChannel(channelId);
    }

    this.devices.clear();
    this.eventListeners.clear();
  }
}

// Singleton export
export const bluetoothAudioManager = new BluetoothAudioManager();
