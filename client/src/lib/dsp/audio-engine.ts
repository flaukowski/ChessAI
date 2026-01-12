/**
 * AudioNoise DSP Engine
 * Ported from C-based guitar pedal effects to Web Audio API
 * Original: https://github.com/torvalds/GuitarPedal
 */

export interface AudioEngineConfig {
  sampleRate?: number;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private effectsChain: AudioNode[] = [];
  private isInitialized = false;

  constructor(private config: AudioEngineConfig = {}) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.context = new AudioContext({
      sampleRate: this.config.sampleRate || 48000,
    });
    
    this.analyserNode = this.context.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;
    
    this.isInitialized = true;
  }

  get audioContext(): AudioContext | null {
    return this.context;
  }

  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  get sampleRate(): number {
    return this.context?.sampleRate || 48000;
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  async connectAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    if (!this.context) await this.initialize();
    
    const source = this.context!.createMediaElementSource(audioElement);
    this.connectSource(source);
  }

  async connectMicrophone(): Promise<MediaStream> {
    if (!this.context) await this.initialize();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.context!.createMediaStreamSource(stream);
    this.connectSource(source);
    
    return stream;
  }

  private connectSource(source: AudioNode): void {
    if (!this.context || !this.analyserNode || !this.gainNode) return;
    
    // Disconnect existing source
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    
    this.sourceNode = source as any;
    
    // Build chain: source -> effects -> analyser -> gain -> destination
    let currentNode: AudioNode = source;
    
    for (const effect of this.effectsChain) {
      currentNode.connect(effect);
      currentNode = effect;
    }
    
    currentNode.connect(this.analyserNode);
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);
  }

  addEffect(effect: AudioNode): void {
    this.effectsChain.push(effect);
  }

  removeEffect(effect: AudioNode): void {
    const index = this.effectsChain.indexOf(effect);
    if (index > -1) {
      this.effectsChain.splice(index, 1);
    }
  }

  clearEffects(): void {
    this.effectsChain = [];
  }

  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        Math.max(0, Math.min(1, value)),
        this.context?.currentTime || 0
      );
    }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  destroy(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    if (this.context) {
      this.context.close();
    }
    this.isInitialized = false;
  }
}

export const audioEngine = new AudioEngine();
