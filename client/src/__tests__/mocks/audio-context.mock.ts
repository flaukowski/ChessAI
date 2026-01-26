import { vi } from 'vitest';

/**
 * Mock AudioContext for testing audio processing code.
 * This provides a minimal implementation of the Web Audio API
 * that can be used in Node.js test environments.
 */

export class MockAudioNode {
  context: MockAudioContext;
  numberOfInputs: number = 1;
  numberOfOutputs: number = 1;
  channelCount: number = 2;
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn().mockReturnValue(true);
}

export class MockAudioParam {
  value: number;
  defaultValue: number;
  minValue: number = -3.4028234663852886e38;
  maxValue: number = 3.4028234663852886e38;
  automationRate: AutomationRate = 'a-rate';

  constructor(defaultValue: number = 0) {
    this.value = defaultValue;
    this.defaultValue = defaultValue;
  }

  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  setTargetAtTime = vi.fn().mockReturnThis();
  setValueCurveAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
  cancelAndHoldAtTime = vi.fn().mockReturnThis();
}

export class MockGainNode extends MockAudioNode {
  gain: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.gain = new MockAudioParam(1);
  }
}

export class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency: MockAudioParam;
  Q: MockAudioParam;
  gain: MockAudioParam;
  detune: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
    this.detune = new MockAudioParam(0);
  }

  getFrequencyResponse = vi.fn();
}

export class MockDelayNode extends MockAudioNode {
  delayTime: MockAudioParam;

  constructor(context: MockAudioContext, maxDelayTime: number = 1) {
    super(context);
    this.delayTime = new MockAudioParam(0);
  }
}

export class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency: MockAudioParam;
  detune: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
  }

  start = vi.fn();
  stop = vi.fn();
  setPeriodicWave = vi.fn();
}

export class MockDynamicsCompressorNode extends MockAudioNode {
  threshold: MockAudioParam;
  knee: MockAudioParam;
  ratio: MockAudioParam;
  attack: MockAudioParam;
  release: MockAudioParam;
  reduction: number = 0;

  constructor(context: MockAudioContext) {
    super(context);
    this.threshold = new MockAudioParam(-24);
    this.knee = new MockAudioParam(30);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.25);
  }
}

export class MockWaveShaperNode extends MockAudioNode {
  curve: Float32Array | null = null;
  oversample: OverSampleType = 'none';

  constructor(context: MockAudioContext) {
    super(context);
  }
}

export class MockAnalyserNode extends MockAudioNode {
  fftSize: number = 2048;
  frequencyBinCount: number = 1024;
  minDecibels: number = -100;
  maxDecibels: number = -30;
  smoothingTimeConstant: number = 0.8;

  constructor(context: MockAudioContext) {
    super(context);
  }

  getByteTimeDomainData = vi.fn();
  getFloatTimeDomainData = vi.fn();
  getByteFrequencyData = vi.fn();
  getFloatFrequencyData = vi.fn();
}

export class MockConvolverNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  normalize: boolean = true;

  constructor(context: MockAudioContext) {
    super(context);
  }
}

export class MockAudioDestinationNode extends MockAudioNode {
  maxChannelCount: number = 2;

  constructor(context: MockAudioContext) {
    super(context);
  }
}

export class MockMediaStreamAudioSourceNode extends MockAudioNode {
  mediaStream: MediaStream;

  constructor(context: MockAudioContext, options: { mediaStream: MediaStream }) {
    super(context);
    this.mediaStream = options.mediaStream;
  }
}

export class MockAudioWorkletNode extends MockAudioNode {
  parameters: Map<string, MockAudioParam> = new Map();
  port: MessagePort;
  onprocessorerror: ((event: Event) => void) | null = null;

  constructor(context: MockAudioContext, name: string, options?: AudioWorkletNodeOptions) {
    super(context);
    // Create a mock MessagePort
    this.port = {
      postMessage: vi.fn(),
      onmessage: null,
      onmessageerror: null,
      start: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(true),
    } as unknown as MessagePort;
  }
}

export class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate: number = 48000;
  currentTime: number = 0;
  baseLatency: number = 0.005;
  outputLatency: number = 0.01;
  destination: MockAudioDestinationNode;
  listener: AudioListener = {} as AudioListener;
  audioWorklet: AudioWorklet;

  constructor(options?: AudioContextOptions) {
    if (options?.sampleRate) {
      this.sampleRate = options.sampleRate;
    }
    this.destination = new MockAudioDestinationNode(this);
    this.audioWorklet = {
      addModule: vi.fn().mockResolvedValue(undefined),
    } as unknown as AudioWorklet;
  }

  createGain = vi.fn(() => new MockGainNode(this));
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode(this));
  createDelay = vi.fn((maxDelayTime?: number) => new MockDelayNode(this, maxDelayTime));
  createOscillator = vi.fn(() => new MockOscillatorNode(this));
  createDynamicsCompressor = vi.fn(() => new MockDynamicsCompressorNode(this));
  createWaveShaper = vi.fn(() => new MockWaveShaperNode(this));
  createAnalyser = vi.fn(() => new MockAnalyserNode(this));
  createConvolver = vi.fn(() => new MockConvolverNode(this));
  createMediaStreamSource = vi.fn((stream: MediaStream) => new MockMediaStreamAudioSourceNode(this, { mediaStream: stream }));
  createMediaElementSource = vi.fn((element: HTMLMediaElement) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    mediaElement: element,
    context: this,
    numberOfInputs: 0,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
  }));
  createBuffer = vi.fn((numberOfChannels: number, length: number, sampleRate: number) => ({
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  }));
  createBufferSource = vi.fn(() => ({
    buffer: null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    playbackRate: new MockAudioParam(1),
    detune: new MockAudioParam(0),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  decodeAudioData = vi.fn().mockResolvedValue({
    numberOfChannels: 2,
    length: 48000,
    sampleRate: 48000,
    duration: 1,
    getChannelData: vi.fn(() => new Float32Array(48000)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  });

  suspend = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn().mockReturnValue(true);
}

// Export a factory function for easy mock creation
export function createMockAudioContext(options?: AudioContextOptions): MockAudioContext {
  return new MockAudioContext(options);
}

// Setup global mocks for Web Audio API
export function setupAudioContextMock(): void {
  // @ts-ignore - Mocking global AudioContext
  global.AudioContext = MockAudioContext;
  // @ts-ignore
  global.webkitAudioContext = MockAudioContext;
  // @ts-ignore
  global.GainNode = MockGainNode;
  // @ts-ignore
  global.BiquadFilterNode = MockBiquadFilterNode;
  // @ts-ignore
  global.DelayNode = MockDelayNode;
  // @ts-ignore
  global.OscillatorNode = MockOscillatorNode;
  // @ts-ignore
  global.DynamicsCompressorNode = MockDynamicsCompressorNode;
  // @ts-ignore
  global.WaveShaperNode = MockWaveShaperNode;
  // @ts-ignore
  global.AnalyserNode = MockAnalyserNode;
  // @ts-ignore
  global.ConvolverNode = MockConvolverNode;
  // @ts-ignore
  global.AudioWorkletNode = MockAudioWorkletNode;
}

// Cleanup function
export function cleanupAudioContextMock(): void {
  // @ts-ignore
  delete global.AudioContext;
  // @ts-ignore
  delete global.webkitAudioContext;
  // @ts-ignore
  delete global.GainNode;
  // @ts-ignore
  delete global.BiquadFilterNode;
  // @ts-ignore
  delete global.DelayNode;
  // @ts-ignore
  delete global.OscillatorNode;
  // @ts-ignore
  delete global.DynamicsCompressorNode;
  // @ts-ignore
  delete global.WaveShaperNode;
  // @ts-ignore
  delete global.AnalyserNode;
  // @ts-ignore
  delete global.ConvolverNode;
  // @ts-ignore
  delete global.AudioWorkletNode;
}
