/**
 * AudioNoise Web - Pedalboard Engine
 * Full signal flow: Input → Input Gain → Effect Chain → Output Gain → Output
 * Supports drag-and-drop effect reordering, global bypass, and level metering
 */

import {
  loadEffectWorklets,
  createWorkletEffect,
  LevelMeter,
  WorkletEffectType,
  defaultWorkletParams,
  type EffectNode,
} from './worklet-effects';

export interface PedalboardEffect {
  id: string;
  type: WorkletEffectType;
  enabled: boolean;
  params: Record<string, number>;
  node: EffectNode | null;
}

export interface AudioLevels {
  inputPeakL: number;
  inputPeakR: number;
  inputRmsL: number;
  inputRmsR: number;
  outputPeakL: number;
  outputPeakR: number;
  outputRmsL: number;
  outputRmsR: number;
}

export interface PedalboardState {
  isInitialized: boolean;
  isPlaying: boolean;
  inputGain: number;
  outputGain: number;
  globalBypass: boolean;
  effects: PedalboardEffect[];
  inputSource: 'file' | 'microphone' | null;
  levels: AudioLevels;
}

type StateChangeCallback = (state: PedalboardState) => void;
type LevelsChangeCallback = (levels: AudioLevels) => void;

/**
 * Main Pedalboard Engine class
 * Manages the entire audio signal chain
 */
export class PedalboardEngine {
  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null;
  private inputGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private bypassNode: GainNode | null = null;
  private wetNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private inputMeter: LevelMeter | null = null;
  private outputMeter: LevelMeter | null = null;

  private effects: Map<string, { effect: PedalboardEffect; node: EffectNode }> = new Map();
  private effectOrder: string[] = [];

  private state: PedalboardState = {
    isInitialized: false,
    isPlaying: false,
    inputGain: 1,
    outputGain: 1,
    globalBypass: false,
    effects: [],
    inputSource: null,
    levels: {
      inputPeakL: 0, inputPeakR: 0, inputRmsL: 0, inputRmsR: 0,
      outputPeakL: 0, outputPeakR: 0, outputRmsL: 0, outputRmsR: 0,
    },
  };

  private stateCallbacks: StateChangeCallback[] = [];
  private levelsCallbacks: LevelsChangeCallback[] = [];
  private mediaStream: MediaStream | null = null;
  private mediaElementSourceCreated = false;

  /**
   * Initialize the audio context and load worklets
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;

    this.context = new AudioContext({ sampleRate: 48000 });

    // Load AudioWorklet processors
    await loadEffectWorklets(this.context);

    // Create gain nodes
    this.inputGainNode = this.context.createGain();
    this.outputGainNode = this.context.createGain();
    this.bypassNode = this.context.createGain();
    this.wetNode = this.context.createGain();

    // Create analyser for visualization
    this.analyserNode = this.context.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Create level meters
    this.inputMeter = new LevelMeter(this.context);
    this.outputMeter = new LevelMeter(this.context);

    // Set up level meter callbacks
    this.inputMeter.onLevels((levels) => {
      this.state.levels.inputPeakL = levels.peakL;
      this.state.levels.inputPeakR = levels.peakR;
      this.state.levels.inputRmsL = levels.rmsL;
      this.state.levels.inputRmsR = levels.rmsR;
      this.notifyLevelsChange();
    });

    this.outputMeter.onLevels((levels) => {
      this.state.levels.outputPeakL = levels.peakL;
      this.state.levels.outputPeakR = levels.peakR;
      this.state.levels.outputRmsL = levels.rmsL;
      this.state.levels.outputRmsR = levels.rmsR;
      this.notifyLevelsChange();
    });

    this.state.isInitialized = true;
    this.notifyStateChange();
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Connect an audio element as the source
   */
  async connectAudioElement(element: HTMLAudioElement): Promise<void> {
    if (!this.context) await this.initialize();
    if (!this.context) return;

    // Disconnect existing source
    this.disconnectSource();

    // Create source only once per element
    if (!this.mediaElementSourceCreated) {
      this.sourceNode = this.context.createMediaElementSource(element);
      this.mediaElementSourceCreated = true;
    }

    this.rebuildAudioGraph();
    await this.resume();

    this.state.inputSource = 'file';
    this.notifyStateChange();
  }

  /**
   * Connect microphone as the source
   */
  async connectMicrophone(): Promise<MediaStream> {
    if (!this.context) await this.initialize();
    if (!this.context) throw new Error('Audio context not initialized');

    // Disconnect existing source
    this.disconnectSource();

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.sourceNode = this.context.createMediaStreamSource(this.mediaStream);
    this.rebuildAudioGraph();
    await this.resume();

    this.state.inputSource = 'microphone';
    this.notifyStateChange();

    return this.mediaStream;
  }

  /**
   * Disconnect the current source
   */
  disconnectSource(): void {
    if (this.sourceNode && !this.mediaElementSourceCreated) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.state.inputSource = null;
  }

  /**
   * Disconnect microphone specifically
   */
  disconnectMicrophone(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
      this.sourceNode = null;
    }
    this.state.inputSource = null;
    this.notifyStateChange();
  }

  /**
   * Rebuild the audio graph with current effect order
   */
  private rebuildAudioGraph(): void {
    if (!this.context || !this.inputGainNode || !this.outputGainNode) return;

    // Disconnect everything first
    if (this.sourceNode) this.sourceNode.disconnect();
    this.inputGainNode.disconnect();
    this.outputGainNode.disconnect();
    if (this.bypassNode) this.bypassNode.disconnect();
    if (this.wetNode) this.wetNode.disconnect();
    if (this.inputMeter) this.inputMeter.input.disconnect();
    if (this.outputMeter) this.outputMeter.input.disconnect();
    if (this.analyserNode) this.analyserNode.disconnect();

    this.effects.forEach(({ node }) => {
      node.input.disconnect();
      node.output.disconnect();
    });

    // Build the graph:
    // Source → Input Gain → Input Meter → [Effects Chain OR Bypass] → Output Meter → Analyser → Output Gain → Destination

    if (!this.sourceNode) return;

    // Source to input gain
    this.sourceNode.connect(this.inputGainNode);

    // Input gain to input meter
    this.inputGainNode.connect(this.inputMeter!.input);

    // Parallel paths: bypass and wet
    this.inputMeter!.output.connect(this.bypassNode!);
    this.inputMeter!.output.connect(this.wetNode!);

    // Build effect chain
    let currentNode: AudioNode = this.wetNode!;

    for (const effectId of this.effectOrder) {
      const effectData = this.effects.get(effectId);
      if (effectData && effectData.effect.enabled) {
        currentNode.connect(effectData.node.input);
        currentNode = effectData.node.output;
      }
    }

    // End of wet chain to output meter
    currentNode.connect(this.outputMeter!.input);
    this.bypassNode!.connect(this.outputMeter!.input);

    // Output meter to analyser
    this.outputMeter!.output.connect(this.analyserNode!);

    // Analyser to output gain
    this.analyserNode!.connect(this.outputGainNode);

    // Output gain to destination
    this.outputGainNode.connect(this.context.destination);

    // Set bypass/wet gains based on global bypass
    this.updateBypassGains();
  }

  /**
   * Update bypass/wet gain nodes based on global bypass state
   */
  private updateBypassGains(): void {
    if (!this.bypassNode || !this.wetNode || !this.context) return;

    const time = this.context.currentTime;
    if (this.state.globalBypass) {
      this.bypassNode.gain.setValueAtTime(1, time);
      this.wetNode.gain.setValueAtTime(0, time);
    } else {
      this.bypassNode.gain.setValueAtTime(0, time);
      this.wetNode.gain.setValueAtTime(1, time);
    }
  }

  /**
   * Add an effect to the chain
   */
  addEffect(type: WorkletEffectType): string {
    if (!this.context) return '';

    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const node = createWorkletEffect(this.context, type);
    const params = { ...defaultWorkletParams[type] };

    const effect: PedalboardEffect = {
      id,
      type,
      enabled: true,
      params,
      node,
    };

    this.effects.set(id, { effect, node });
    this.effectOrder.push(id);

    this.state.effects = this.getEffectsList();
    this.rebuildAudioGraph();
    this.notifyStateChange();

    return id;
  }

  /**
   * Remove an effect from the chain
   */
  removeEffect(id: string): void {
    const effectData = this.effects.get(id);
    if (!effectData) return;

    effectData.node.destroy();
    this.effects.delete(id);
    this.effectOrder = this.effectOrder.filter((eid) => eid !== id);

    this.state.effects = this.getEffectsList();
    this.rebuildAudioGraph();
    this.notifyStateChange();
  }

  /**
   * Reorder effects in the chain
   */
  reorderEffects(newOrder: string[]): void {
    // Validate that all IDs exist
    if (newOrder.length !== this.effectOrder.length) return;
    if (!newOrder.every((id) => this.effects.has(id))) return;

    this.effectOrder = newOrder;
    this.state.effects = this.getEffectsList();
    this.rebuildAudioGraph();
    this.notifyStateChange();
  }

  /**
   * Toggle an effect's enabled state
   */
  toggleEffect(id: string): void {
    const effectData = this.effects.get(id);
    if (!effectData) return;

    effectData.effect.enabled = !effectData.effect.enabled;
    effectData.node.setBypass(!effectData.effect.enabled);

    this.state.effects = this.getEffectsList();
    this.rebuildAudioGraph();
    this.notifyStateChange();
  }

  /**
   * Update an effect's parameter
   */
  updateEffectParam(id: string, param: string, value: number): void {
    const effectData = this.effects.get(id);
    if (!effectData) return;

    effectData.effect.params[param] = value;

    // Update the actual node parameter
    const node = effectData.node as any;
    if (param === 'mix') {
      node.setMix(value);
    } else {
      // Use setAllParams for type-safe parameter updates
      const paramUpdate = { [param]: value };
      if (typeof node.setAllParams === 'function') {
        node.setAllParams(paramUpdate);
      }
    }

    this.state.effects = this.getEffectsList();
    this.notifyStateChange();
  }

  /**
   * Set input gain
   */
  setInputGain(gain: number): void {
    this.state.inputGain = Math.max(0, Math.min(2, gain));
    if (this.inputGainNode && this.context) {
      this.inputGainNode.gain.setValueAtTime(this.state.inputGain, this.context.currentTime);
    }
    this.notifyStateChange();
  }

  /**
   * Set output gain
   */
  setOutputGain(gain: number): void {
    this.state.outputGain = Math.max(0, Math.min(2, gain));
    if (this.outputGainNode && this.context) {
      this.outputGainNode.gain.setValueAtTime(this.state.outputGain, this.context.currentTime);
    }
    this.notifyStateChange();
  }

  /**
   * Toggle global bypass
   */
  setGlobalBypass(bypass: boolean): void {
    this.state.globalBypass = bypass;
    this.updateBypassGains();
    this.notifyStateChange();
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  /**
   * Get time domain data for visualization
   */
  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  /**
   * Get current state
   */
  getState(): PedalboardState {
    return { ...this.state };
  }

  /**
   * Get audio context
   */
  get audioContext(): AudioContext | null {
    return this.context;
  }

  /**
   * Get analyser node for visualization
   */
  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribe to level changes
   */
  onLevelsChange(callback: LevelsChangeCallback): () => void {
    this.levelsCallbacks.push(callback);
    return () => {
      this.levelsCallbacks = this.levelsCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Get current effects as an array
   */
  private getEffectsList(): PedalboardEffect[] {
    return this.effectOrder.map((id) => {
      const data = this.effects.get(id);
      return data ? { ...data.effect } : null;
    }).filter(Boolean) as PedalboardEffect[];
  }

  /**
   * Notify state change callbacks
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateCallbacks.forEach((cb) => cb(state));
  }

  /**
   * Notify levels change callbacks
   */
  private notifyLevelsChange(): void {
    this.levelsCallbacks.forEach((cb) => cb(this.state.levels));
  }

  /**
   * Export current preset as JSON
   */
  exportPreset(): string {
    const preset = {
      version: 1,
      inputGain: this.state.inputGain,
      outputGain: this.state.outputGain,
      effects: this.effectOrder.map((id) => {
        const data = this.effects.get(id);
        if (!data) return null;
        return {
          type: data.effect.type,
          enabled: data.effect.enabled,
          params: data.effect.params,
        };
      }).filter(Boolean),
    };
    return JSON.stringify(preset);
  }

  /**
   * Import preset from JSON
   */
  importPreset(json: string): void {
    try {
      const preset = JSON.parse(json);
      if (preset.version !== 1) return;

      // Clear existing effects
      this.effectOrder.forEach((id) => this.removeEffect(id));

      // Set gains
      this.setInputGain(preset.inputGain ?? 1);
      this.setOutputGain(preset.outputGain ?? 1);

      // Add effects
      for (const effectData of preset.effects) {
        const id = this.addEffect(effectData.type);
        if (!effectData.enabled) {
          this.toggleEffect(id);
        }
        for (const [param, value] of Object.entries(effectData.params)) {
          this.updateEffectParam(id, param, value as number);
        }
      }
    } catch (error) {
      console.error('Failed to import preset:', error);
    }
  }

  /**
   * Clean up and destroy the engine
   */
  destroy(): void {
    this.disconnectSource();

    this.effects.forEach(({ node }) => node.destroy());
    this.effects.clear();
    this.effectOrder = [];

    if (this.inputMeter) this.inputMeter.destroy();
    if (this.outputMeter) this.outputMeter.destroy();

    if (this.context) {
      this.context.close();
      this.context = null;
    }

    this.state.isInitialized = false;
  }
}

// Singleton instance
export const pedalboardEngine = new PedalboardEngine();
