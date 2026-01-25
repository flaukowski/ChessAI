/**
 * WebRTC Jam Session Manager
 * Real-time audio collaboration with peer-to-peer connections
 */

import { audioEngine } from '../dsp/audio-engine';

export interface JamParticipant {
  id: string;
  peerId: string;
  userId: string;
  username: string;
  isMuted: boolean;
  isDeafened: boolean;
  latency: number;
  connectionState: RTCPeerConnectionState;
  audioLevel: number;
  joinedAt: Date;
}

export interface JamSessionConfig {
  workspaceId: string;
  sessionId: string;
  userId: string;
  username: string;
  iceServers?: RTCIceServer[];
  audioConstraints?: MediaTrackConstraints;
}

export interface LatencyMeasurement {
  peerId: string;
  rtt: number;
  jitter: number;
  packetLoss: number;
  timestamp: Date;
}

export interface JamSessionEvents {
  'participant-joined': (participant: JamParticipant) => void;
  'participant-left': (peerId: string) => void;
  'participant-updated': (participant: JamParticipant) => void;
  'latency-updated': (measurement: LatencyMeasurement) => void;
  'audio-level': (peerId: string, level: number) => void;
  'connection-state': (state: 'connecting' | 'connected' | 'disconnected' | 'failed') => void;
  'error': (error: Error) => void;
}

type EventCallback<K extends keyof JamSessionEvents> = JamSessionEvents[K];

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 2,
};

const LATENCY_BUFFER_MS = 20;
const MAX_ACCEPTABLE_LATENCY_MS = 150;

class PeerConnectionManager {
  private connection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private remoteStream: MediaStream | null = null;
  private latencyHistory: number[] = [];

  public peerId: string;
  public userId: string;
  public username: string;
  public isMuted = false;
  public isDeafened = false;
  public latency = 0;
  public jitter = 0;
  public packetLoss = 0;
  public audioLevel = 0;

  constructor(
    peerId: string,
    userId: string,
    username: string,
    iceServers: RTCIceServer[],
    private onTrack: (stream: MediaStream) => void,
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onConnectionStateChange: (state: RTCPeerConnectionState) => void,
    private onLatencyUpdate: (measurement: LatencyMeasurement) => void
  ) {
    this.peerId = peerId;
    this.userId = userId;
    this.username = username;
    this.connection = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    this.connection.onicecandidate = (e) => {
      if (e.candidate) this.onIceCandidate(e.candidate);
    };
    this.connection.ontrack = (e) => {
      this.remoteStream = e.streams[0];
      this.onTrack(e.streams[0]);
      this.startAudioLevelMonitoring();
    };
    this.connection.onconnectionstatechange = () => {
      this.onConnectionStateChange(this.connection.connectionState);
    };
    this.connection.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannel();
    };
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;
    this.dataChannel.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'ping') {
        this.dataChannel?.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
      } else if (data.type === 'pong') {
        this.updateLatency(Date.now() - data.timestamp);
      }
    };
  }

  private updateLatency(rtt: number): void {
    this.latencyHistory.push(rtt);
    if (this.latencyHistory.length > 20) this.latencyHistory.shift();
    this.latency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    if (this.latencyHistory.length > 1) {
      const variance = this.latencyHistory.reduce((sum, val) => sum + Math.pow(val - this.latency, 2), 0) / this.latencyHistory.length;
      this.jitter = Math.sqrt(variance);
    }
    this.onLatencyUpdate({
      peerId: this.peerId,
      rtt: this.latency,
      jitter: this.jitter,
      packetLoss: this.packetLoss,
      timestamp: new Date(),
    });
  }

  private startAudioLevelMonitoring(): void {
    if (!this.remoteStream || !audioEngine.audioContext) return;
    const source = audioEngine.audioContext.createMediaStreamSource(this.remoteStream);
    const analyser = audioEngine.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const updateLevel = () => {
      if (!this.remoteStream?.getTracks().length) return;
      analyser.getByteFrequencyData(dataArray);
      this.audioLevel = (dataArray.reduce((a, b) => a + b, 0) / dataArray.length) / 255;
      requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }

  async addLocalTrack(track: MediaStreamTrack, stream: MediaStream): Promise<void> {
    this.connection.addTrack(track, stream);
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.dataChannel = this.connection.createDataChannel('latency', { ordered: false, maxRetransmits: 0 });
    this.setupDataChannel();
    const offer = await this.connection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await this.connection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  pingForLatency(): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.connection.connectionState;
  }

  close(): void {
    this.dataChannel?.close();
    this.connection.close();
    this.remoteStream?.getTracks().forEach((t) => t.stop());
  }
}

class AudioMixer {
  private audioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private inputGains = new Map<string, GainNode>();
  private analyserNodes = new Map<string, AnalyserNode>();

  async initialize(): Promise<void> {
    if (this.audioContext) return;
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.outputNode = this.audioContext.createGain();
    this.outputNode.gain.value = 1.0;
    this.outputNode.connect(this.audioContext.destination);
  }

  addStream(peerId: string, stream: MediaStream): void {
    if (!this.audioContext || !this.outputNode) return;
    const source = this.audioContext.createMediaStreamSource(stream);
    const gain = this.audioContext.createGain();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(this.outputNode);
    this.inputGains.set(peerId, gain);
    this.analyserNodes.set(peerId, analyser);
  }

  removeStream(peerId: string): void {
    this.inputGains.get(peerId)?.disconnect();
    this.analyserNodes.get(peerId)?.disconnect();
    this.inputGains.delete(peerId);
    this.analyserNodes.delete(peerId);
  }

  setParticipantVolume(peerId: string, volume: number): void {
    const gain = this.inputGains.get(peerId);
    if (gain && this.audioContext) {
      gain.gain.setValueAtTime(Math.max(0, Math.min(2, volume)), this.audioContext.currentTime);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.outputNode && this.audioContext) {
      this.outputNode.gain.setValueAtTime(Math.max(0, Math.min(2, volume)), this.audioContext.currentTime);
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') await this.audioContext.resume();
  }

  close(): void {
    this.inputGains.forEach((_, id) => this.removeStream(id));
    this.outputNode?.disconnect();
    this.audioContext?.close();
    this.audioContext = null;
    this.outputNode = null;
  }
}

export class JamSessionManager {
  private config: JamSessionConfig | null = null;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerConnectionManager>();
  private participants = new Map<string, JamParticipant>();
  private mixer: AudioMixer;
  private eventListeners = new Map<string, Set<Function>>();
  private latencyInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isMuted = false;
  private isDeafened = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';

  constructor() {
    this.mixer = new AudioMixer();
  }

  on<K extends keyof JamSessionEvents>(event: K, callback: EventCallback<K>): void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
    this.eventListeners.get(event)!.add(callback);
  }

  off<K extends keyof JamSessionEvents>(event: K, callback: EventCallback<K>): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit<K extends keyof JamSessionEvents>(event: K, ...args: Parameters<JamSessionEvents[K]>): void {
    this.eventListeners.get(event)?.forEach((cb) => {
      try {
        (cb as Function)(...args);
      } catch (e) {
        console.error('[JamSession] Event error:', e);
      }
    });
  }

  async joinSession(sessionId: string, workspaceId: string, userId: string, username: string, iceServers?: RTCIceServer[]): Promise<void> {
    this.config = {
      sessionId,
      workspaceId,
      userId,
      username,
      iceServers: iceServers || DEFAULT_ICE_SERVERS,
      audioConstraints: DEFAULT_AUDIO_CONSTRAINTS,
    };
    this.setConnectionState('connecting');
    try {
      await this.mixer.initialize();
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: this.config.audioConstraints, video: false });
      await this.connectSignaling();
    } catch (error) {
      this.setConnectionState('failed');
      throw error;
    }
  }

  async leaveSession(): Promise<void> {
    if (this.latencyInterval) {
      clearInterval(this.latencyInterval);
      this.latencyInterval = null;
    }
    this.peers.forEach((peer, id) => {
      peer.close();
      this.mixer.removeStream(id);
    });
    this.peers.clear();
    this.participants.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.ws?.close();
    this.ws = null;
    this.mixer.close();
    this.setConnectionState('disconnected');
    this.config = null;
  }

  private async connectSignaling(): Promise<void> {
    if (!this.config) throw new Error('No session config');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/jam-sessions/${this.config.sessionId}/ws`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.sendSignal({ type: 'join', userId: this.config!.userId, username: this.config!.username });
    };
    this.ws.onmessage = async (e) => await this.handleSignalingMessage(JSON.parse(e.data));
    this.ws.onerror = () => this.emit('error', new Error('WebSocket error'));
    this.ws.onclose = () => {
      if (this.connectionState === 'connected') this.handleDisconnect();
    };
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
      const check = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else if (this.ws?.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          reject(new Error('Failed'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private sendSignal(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private async handleSignalingMessage(msg: any): Promise<void> {
    switch (msg.type) {
      case 'joined':
        this.setConnectionState('connected');
        this.startLatencyMonitoring();
        break;
      case 'participant-list':
        for (const p of msg.participants) {
          if (p.peerId !== this.config?.userId) {
            await this.initiateConnection(p.peerId, p.userId, p.username);
          }
        }
        break;
      case 'participant-left':
        this.handlePeerDisconnect(msg.peerId);
        break;
      case 'offer':
        await this.handleOffer(msg);
        break;
      case 'answer':
        await this.handleAnswer(msg);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(msg);
        break;
      case 'mute-state':
        this.handleMuteState(msg);
        break;
      case 'error':
        this.emit('error', new Error(msg.message));
        break;
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.setConnectionState('connecting');
      setTimeout(() => this.connectSignaling(), 1000 * this.reconnectAttempts);
    } else {
      this.setConnectionState('failed');
      this.emit('error', new Error('Reconnect failed'));
    }
  }

  private async initiateConnection(peerId: string, userId: string, username: string): Promise<void> {
    if (!this.config || !this.localStream) return;
    const peer = new PeerConnectionManager(
      peerId,
      userId,
      username,
      this.config.iceServers!,
      (s) => this.handleRemoteStream(peerId, s),
      (c) => this.sendSignal({ type: 'ice-candidate', targetPeerId: peerId, candidate: c.toJSON() }),
      (s) => this.handleConnectionStateChange(peerId, s),
      (m) => this.emit('latency-updated', m)
    );
    for (const track of this.localStream.getTracks()) {
      await peer.addLocalTrack(track, this.localStream);
    }
    this.peers.set(peerId, peer);
    const offer = await peer.createOffer();
    this.sendSignal({ type: 'offer', targetPeerId: peerId, offer, userId: this.config.userId, username: this.config.username });
  }

  private async handleOffer(msg: any): Promise<void> {
    if (!this.config || !this.localStream) return;
    const peer = new PeerConnectionManager(
      msg.peerId,
      msg.userId,
      msg.username,
      this.config.iceServers!,
      (s) => this.handleRemoteStream(msg.peerId, s),
      (c) => this.sendSignal({ type: 'ice-candidate', targetPeerId: msg.peerId, candidate: c.toJSON() }),
      (s) => this.handleConnectionStateChange(msg.peerId, s),
      (m) => this.emit('latency-updated', m)
    );
    for (const track of this.localStream.getTracks()) {
      await peer.addLocalTrack(track, this.localStream);
    }
    this.peers.set(msg.peerId, peer);
    const answer = await peer.createAnswer(msg.offer);
    this.sendSignal({ type: 'answer', targetPeerId: msg.peerId, answer });
  }

  private async handleAnswer(msg: any): Promise<void> {
    await this.peers.get(msg.peerId)?.setRemoteAnswer(msg.answer);
  }

  private async handleIceCandidate(msg: any): Promise<void> {
    await this.peers.get(msg.peerId)?.addIceCandidate(msg.candidate);
  }

  private handleRemoteStream(peerId: string, stream: MediaStream): void {
    this.mixer.addStream(peerId, stream);
    this.mixer.resume();
    const peer = this.peers.get(peerId);
    if (peer) this.addParticipant(peer);
  }

  private handleConnectionStateChange(peerId: string, state: RTCPeerConnectionState): void {
    const p = this.participants.get(peerId);
    if (p) {
      p.connectionState = state;
      this.emit('participant-updated', p);
    }
    if (state === 'failed' || state === 'disconnected') this.handlePeerDisconnect(peerId);
  }

  private handlePeerDisconnect(peerId: string): void {
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
    this.mixer.removeStream(peerId);
    this.participants.delete(peerId);
    this.emit('participant-left', peerId);
  }

  private handleMuteState(msg: any): void {
    const p = this.participants.get(msg.peerId);
    if (p) {
      p.isMuted = msg.isMuted;
      p.isDeafened = msg.isDeafened;
      this.emit('participant-updated', p);
    }
  }

  private addParticipant(peer: PeerConnectionManager): void {
    const p: JamParticipant = {
      id: peer.peerId,
      peerId: peer.peerId,
      userId: peer.userId,
      username: peer.username,
      isMuted: peer.isMuted,
      isDeafened: peer.isDeafened,
      latency: peer.latency,
      connectionState: peer.getConnectionState(),
      audioLevel: 0,
      joinedAt: new Date(),
    };
    this.participants.set(peer.peerId, p);
    this.emit('participant-joined', p);
  }

  getParticipants(): JamParticipant[] {
    return Array.from(this.participants.values());
  }

  getParticipant(peerId: string): JamParticipant | undefined {
    return this.participants.get(peerId);
  }

  async setMuted(muted: boolean): Promise<void> {
    this.isMuted = muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.sendSignal({ type: 'mute-state', isMuted: muted, isDeafened: this.isDeafened });
  }

  async setDeafened(deafened: boolean): Promise<void> {
    this.isDeafened = deafened;
    this.mixer.setMasterVolume(deafened ? 0 : 1);
    this.sendSignal({ type: 'mute-state', isMuted: this.isMuted, isDeafened: deafened });
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  toggleDeafen(): boolean {
    this.setDeafened(!this.isDeafened);
    return this.isDeafened;
  }

  setParticipantVolume(peerId: string, volume: number): void {
    this.mixer.setParticipantVolume(peerId, volume);
  }

  setMasterVolume(volume: number): void {
    if (!this.isDeafened) this.mixer.setMasterVolume(volume);
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  getDeafened(): boolean {
    return this.isDeafened;
  }

  private startLatencyMonitoring(): void {
    this.latencyInterval = setInterval(() => this.peers.forEach((p) => p.pingForLatency()), 1000);
  }

  getLatencyCompensationHint(peerId: string): number {
    const peer = this.peers.get(peerId);
    if (!peer) return 0;
    return Math.min(peer.latency / 2 + peer.jitter * 2 + LATENCY_BUFFER_MS, MAX_ACCEPTABLE_LATENCY_MS);
  }

  getAverageLatency(): number {
    if (this.peers.size === 0) return 0;
    let total = 0;
    this.peers.forEach((p) => (total += p.latency));
    return total / this.peers.size;
  }

  isLatencyAcceptable(peerId?: string): boolean {
    if (peerId) {
      const p = this.peers.get(peerId);
      return p ? p.latency < MAX_ACCEPTABLE_LATENCY_MS : true;
    }
    return this.getAverageLatency() < MAX_ACCEPTABLE_LATENCY_MS;
  }

  private setConnectionState(state: 'connecting' | 'connected' | 'disconnected' | 'failed'): void {
    this.connectionState = state;
    this.emit('connection-state', state);
  }

  getConnectionState(): typeof this.connectionState {
    return this.connectionState;
  }

  getSessionId(): string | null {
    return this.config?.sessionId || null;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}

export const jamSession = new JamSessionManager();

export async function createJamSession(workspaceId: string): Promise<string> {
  const res = await fetch('/api/v1/jam-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ workspaceId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create session');
  }
  return (await res.json()).sessionId;
}

export async function joinJamSession(
  sessionId: string,
  workspaceId: string,
  userId: string,
  username: string
): Promise<JamSessionManager> {
  await jamSession.joinSession(sessionId, workspaceId, userId, username);
  return jamSession;
}

export async function leaveJamSession(): Promise<void> {
  await jamSession.leaveSession();
}
