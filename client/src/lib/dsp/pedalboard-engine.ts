/**
 * AudioNoise Web - Pedalboard Engine
 * Full signal flow: Input → Input Gain → Effect Chain → Output Gain → Output
 * Supports drag-and-drop effect reordering, global bypass, and level metering
 *
 * Phase 3.1 Optimization: Incremental audio graph updates with crossfade transitions
 * - Uses gain node crossfading for glitch-free effect chain modifications
 * - Only modifies affected nodes instead of rebuilding entire graph
 * - Maintains stable source/destination connections
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

// Crossfade duration in seconds for smooth transitions
const CROSSFADE_DURATION = 0.015; // 15ms crossfade - fast enough to be imperceptible, long enough to prevent clicks

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

  // Crossfade architecture: dual effect chains for seamless transitions
  private effectChainA: GainNode | null = null;  // Primary chain output
  private effectChainB: GainNode | null = null;  // Secondary chain output (for crossfading)
  private activeChain: 'A' | 'B' = 'A';
  private isGraphBuilt: boolean = false;

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
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private lastConnectedElement: HTMLAudioElement | null = null;
  private lastLevelsNotify: number = 0;
  private levelsThrottleMs: number = 100; // Throttle level updates to 10fps (sufficient for visualization)

  /**
   * Initialize the audio context and load worklets
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;

    if (!this.context) {
      this.context = new AudioContext({ sampleRate: 48000 });
    }

    // Load AudioWorklet processors
    await loadEffectWorklets(this.context);

    // Verify worklets are loaded by checking if we can create a node
    // This is a safety check to prevent the race condition
    try {
      const probeNode = new AudioWorkletNode(this.context, 'level-meter-processor');
      probeNode.disconnect();
    } catch (e) {
      console.warn('Worklets not fully ready, retrying in 100ms...');
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.initialize();
    }

    // Create gain nodes
    this.inputGainNode = this.context.createGain();
    this.outputGainNode = this.context.createGain();
    this.bypassNode = this.context.createGain();
    this.wetNode = this.context.createGain();

    // Create crossfade chain outputs for seamless transitions
    this.effectChainA = this.context.createGain();
    this.effectChainB = this.context.createGain();
    // Chain B starts silent - will be used for crossfade transitions
    this.effectChainB.gain.value = 0;

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

    // Create new source if element changed, or reuse existing one
    // Note: MediaElementAudioSourceNode can only be created once per element
    if (this.lastConnectedElement !== element) {
      this.mediaElementSource = this.context.createMediaElementSource(element);
      this.lastConnectedElement = element;
    }
    
    this.sourceNode = this.mediaElementSource;

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
    // Don't disconnect MediaElementSource - it can be reused
    // Only disconnect if it's a microphone stream source
    if (this.sourceNode && this.sourceNode !== this.mediaElementSource) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
      // Reset graph state when source changes
      this.isGraphBuilt = false;
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
   * Build the static portions of the audio graph (called once on first source connection)
   * These connections remain stable throughout the session
   */
  private buildStaticGraph(): void {
    if (!this.context || !this.sourceNode || !this.inputGainNode || !this.outputGainNode) return;
    if (this.isGraphBuilt) return;

    // Source → Input Gain
    this.sourceNode.connect(this.inputGainNode);

    // Input Gain → Input Meter
    this.inputGainNode.connect(this.inputMeter!.input);

    // Input Meter → Bypass path (direct)
    this.inputMeter!.output.connect(this.bypassNode!);

    // Input Meter → Wet path (goes through effect chains)
    this.inputMeter!.output.connect(this.wetNode!);

    // Both effect chain outputs merge to output meter
    this.effectChainA!.connect(this.outputMeter!.input);
    this.effectChainB!.connect(this.outputMeter!.input);

    // Bypass also connects to output meter
    this.bypassNode!.connect(this.outputMeter!.input);

    // Output Meter → Analyser → Output Gain → Destination
    this.outputMeter!.output.connect(this.analyserNode!);
    this.analyserNode!.connect(this.outputGainNode);
    this.outputGainNode.connect(this.context.destination);

    this.isGraphBuilt = true;
    this.updateBypassGains();

    // Build initial effect chain on active chain
    this.buildEffectChain(this.activeChain);
  }

  /**
   * Build effect chain on the specified chain (A or B)
   * This wires: wetNode → [effect1 → effect2 → ...] → chainOutput
   */
  private buildEffectChain(chain: 'A' | 'B'): void {
    if (!this.context || !this.wetNode) return;

    const chainOutput = chain === 'A' ? this.effectChainA : this.effectChainB;
    if (!chainOutput) return;

    // Start from wet node
    let currentNode: AudioNode = this.wetNode;

    // Connect each enabled effect in order
    for (const effectId of this.effectOrder) {
      const effectData = this.effects.get(effectId);
      if (effectData && effectData.effect.enabled) {
        currentNode.connect(effectData.node.input);
        currentNode = effectData.node.output;
      }
    }

    // Connect final node to chain output
    currentNode.connect(chainOutput);
  }

  /**
   * Disconnect all effects from the wet path and chain outputs
   * Used before rebuilding the effect chain
   */
  private disconnectEffectChain(): void {
    // Disconnect wet node from all effects
    if (this.wetNode) {
      try {
        this.wetNode.disconnect();
      } catch (e) {
        // Already disconnected
      }
      // Reconnect wet to effect chain outputs (will be rebuilt)
    }

    // Disconnect each effect
    this.effects.forEach(({ node }) => {
      try {
        node.input.disconnect();
        node.output.disconnect();
      } catch (e) {
        // Already disconnected
      }
    });

    // Disconnect chain outputs from output meter (will be reconnected)
    if (this.effectChainA) {
      try {
        this.effectChainA.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }
    if (this.effectChainB) {
      try {
        this.effectChainB.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }
  }

  /**
   * Incrementally update the audio graph using crossfade for smooth transitions
   * This is the key optimization - instead of disconnecting everything, we:
   * 1. Build the new chain on the inactive chain output
   * 2. Crossfade from active to inactive
   * 3. Disconnect old chain after crossfade completes
   */
  private updateAudioGraphWithCrossfade(): void {
    if (!this.context || !this.inputGainNode || !this.outputGainNode) return;

    // If graph isn't built yet, build it fresh (first time only)
    if (!this.isGraphBuilt) {
      if (this.sourceNode) {
        this.buildStaticGraph();
      }
      return;
    }

    const time = this.context.currentTime;
    const crossfadeEnd = time + CROSSFADE_DURATION;

    // Determine which chains to use
    const oldChain = this.activeChain;
    const newChain = oldChain === 'A' ? 'B' : 'A';
    const oldChainGain = oldChain === 'A' ? this.effectChainA : this.effectChainB;
    const newChainGain = newChain === 'A' ? this.effectChainA : this.effectChainB;

    if (!oldChainGain || !newChainGain) return;

    // Disconnect the new chain (it was silent anyway)
    try {
      newChainGain.disconnect();
    } catch (e) {
      // Already disconnected
    }

    // Disconnect effects from their current connections
    this.effects.forEach(({ node }) => {
      try {
        node.input.disconnect();
        node.output.disconnect();
      } catch (e) {
        // Already disconnected
      }
    });

    // Disconnect wet node from old chain effects
    try {
      this.wetNode?.disconnect();
    } catch (e) {
      // Already disconnected
    }

    // Reconnect wet node to both chain starting points
    // (We'll rebuild the chain connections below)

    // Build new effect chain
    let currentNode: AudioNode = this.wetNode!;
    for (const effectId of this.effectOrder) {
      const effectData = this.effects.get(effectId);
      if (effectData && effectData.effect.enabled) {
        currentNode.connect(effectData.node.input);
        currentNode = effectData.node.output;
      }
    }
    currentNode.connect(newChainGain);

    // Connect new chain to output meter
    newChainGain.connect(this.outputMeter!.input);

    // Crossfade: fade out old chain, fade in new chain
    oldChainGain.gain.setValueAtTime(1, time);
    oldChainGain.gain.linearRampToValueAtTime(0, crossfadeEnd);
    newChainGain.gain.setValueAtTime(0, time);
    newChainGain.gain.linearRampToValueAtTime(1, crossfadeEnd);

    // Switch active chain
    this.activeChain = newChain;

    // Schedule cleanup of old chain after crossfade completes
    // This disconnects the old chain output once it's silent
    setTimeout(() => {
      try {
        oldChainGain.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }, CROSSFADE_DURATION * 1000 + 10); // Add small buffer
  }

  /**
   * Legacy rebuild method - now uses incremental update with crossfade
   * Kept for backward compatibility and initial graph building
   */
  private rebuildAudioGraph(): void {
    if (!this.context || !this.inputGainNode || !this.outputGainNode) return;

    // For initial build when source connects, use the full static graph builder
    if (!this.isGraphBuilt && this.sourceNode) {
      this.buildStaticGraph();
      return;
    }

    // For subsequent updates, use incremental crossfade update
    if (this.isGraphBuilt) {
      this.updateAudioGraphWithCrossfade();
    }
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
   * Note: No graph rebuild needed - bypass is handled by the effect node itself
   */
  toggleEffect(id: string): void {
    const effectData = this.effects.get(id);
    if (!effectData) return;

    effectData.effect.enabled = !effectData.effect.enabled;
    // setBypass handles routing internally, no need to rebuild entire graph
    effectData.node.setBypass(!effectData.effect.enabled);

    this.state.effects = this.getEffectsList();
    // Removed rebuildAudioGraph() - unnecessary, causes audio glitches
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
   * Get output gain node for recording
   */
  get outputNode(): GainNode | null {
    return this.outputGainNode;
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
   * Notify levels change callbacks (throttled to prevent performance issues)
   */
  private notifyLevelsChange(): void {
    const now = performance.now();
    if (now - this.lastLevelsNotify < this.levelsThrottleMs) {
      return; // Skip this update, too soon
    }
    this.lastLevelsNotify = now;
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

    // Clean up crossfade chain nodes
    if (this.effectChainA) {
      this.effectChainA.disconnect();
      this.effectChainA = null;
    }
    if (this.effectChainB) {
      this.effectChainB.disconnect();
      this.effectChainB = null;
    }

    if (this.context) {
      this.context.close();
      this.context = null;
    }

    this.state.isInitialized = false;
    this.state.effects = [];
    this.isGraphBuilt = false;
    this.activeChain = 'A';
  }
}

// Singleton instance
export const pedalboardEngine = new PedalboardEngine();
