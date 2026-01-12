/**
 * React hook for AudioNoise DSP Engine
 * Manages real-time audio processing with effects
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { audioEngine } from '@/lib/dsp';
import { 
  createEchoNode, 
  createFlangerNode, 
  createPhaserNode 
} from '@/lib/dsp/effects';
import { createBiquadNode, BiquadFilterType } from '@/lib/dsp/biquad';

export type EffectType = 'echo' | 'flanger' | 'phaser' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface EffectInstance {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
  node: AudioNode | null;
}

export interface AudioDSPState {
  isInitialized: boolean;
  isPlaying: boolean;
  volume: number;
  effects: EffectInstance[];
  inputSource: 'file' | 'microphone' | null;
}

const defaultEffectParams: Record<EffectType, Record<string, number>> = {
  echo: { delayMs: 300, feedback: 0.5, mix: 0.5 },
  flanger: { rate: 0.5, depth: 0.5, feedback: 0.5, mix: 0.5 },
  phaser: { rate: 0.5, depth: 800, feedback: 0.5, mix: 0.5 },
  lowpass: { frequency: 2000, Q: 0.707 },
  highpass: { frequency: 200, Q: 0.707 },
  bandpass: { frequency: 1000, Q: 1 },
  notch: { frequency: 1000, Q: 1 },
};

export function useAudioDSP() {
  const [state, setState] = useState<AudioDSPState>({
    isInitialized: false,
    isPlaying: false,
    volume: 1,
    effects: [],
    inputSource: null,
  });

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const effectNodesRef = useRef<Map<string, any>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);

  const initialize = useCallback(async () => {
    try {
      await audioEngine.initialize();
      setState(prev => ({ ...prev, isInitialized: true }));
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
    }
  }, []);

  const connectAudioFile = useCallback(async (audioElement: HTMLAudioElement) => {
    if (!state.isInitialized) await initialize();
    
    audioElementRef.current = audioElement;
    await audioEngine.connectAudioElement(audioElement);
    await audioEngine.resume();
    
    setState(prev => ({ ...prev, inputSource: 'file' }));
  }, [state.isInitialized, initialize]);

  const connectMicrophone = useCallback(async () => {
    if (!state.isInitialized) await initialize();
    
    try {
      streamRef.current = await audioEngine.connectMicrophone();
      await audioEngine.resume();
      setState(prev => ({ ...prev, inputSource: 'microphone' }));
    } catch (error) {
      console.error('Failed to connect microphone:', error);
      throw error;
    }
  }, [state.isInitialized, initialize]);

  const disconnectMicrophone = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setState(prev => ({ ...prev, inputSource: null }));
  }, []);

  const addEffect = useCallback((type: EffectType): string => {
    const context = audioEngine.audioContext;
    if (!context) return '';

    const id = `${type}-${Date.now()}`;
    const params = { ...defaultEffectParams[type] };
    let node: any = null;

    switch (type) {
      case 'echo':
        node = createEchoNode(context, params.delayMs, params.feedback, params.mix);
        break;
      case 'flanger':
        node = createFlangerNode(context, params.rate, 2, params.depth, params.feedback, params.mix);
        break;
      case 'phaser':
        node = createPhaserNode(context, params.rate, params.depth, params.feedback, params.mix);
        break;
      case 'lowpass':
      case 'highpass':
      case 'bandpass':
      case 'notch':
        node = createBiquadNode(context, type as BiquadFilterType, params.frequency, params.Q);
        break;
    }

    if (node) {
      effectNodesRef.current.set(id, node);
      
      // For nodes with input/output structure
      const audioNode = node.input || node;
      audioEngine.addEffect(audioNode);
    }

    const effect: EffectInstance = {
      id,
      type,
      enabled: true,
      params,
      node,
    };

    setState(prev => ({
      ...prev,
      effects: [...prev.effects, effect],
    }));

    return id;
  }, []);

  const removeEffect = useCallback((id: string) => {
    const node = effectNodesRef.current.get(id);
    if (node) {
      const audioNode = node.input || node;
      audioEngine.removeEffect(audioNode);
      effectNodesRef.current.delete(id);
    }

    setState(prev => ({
      ...prev,
      effects: prev.effects.filter(e => e.id !== id),
    }));
  }, []);

  const updateEffectParam = useCallback((id: string, param: string, value: number) => {
    const node = effectNodesRef.current.get(id);
    if (!node) return;

    const context = audioEngine.audioContext;
    if (!context) return;

    // Update the node parameters based on effect type
    const effect = state.effects.find(e => e.id === id);
    if (!effect) return;

    switch (effect.type) {
      case 'echo':
        if (param === 'delayMs' && node.delay) {
          node.delay.delayTime.setValueAtTime(value / 1000, context.currentTime);
        } else if (param === 'feedback' && node.feedbackGain) {
          node.feedbackGain.gain.setValueAtTime(value, context.currentTime);
        }
        break;
      case 'flanger':
        if (param === 'rate' && node.setRate) node.setRate(value);
        else if (param === 'depth' && node.setDepth) node.setDepth(value);
        else if (param === 'feedback' && node.setFeedback) node.setFeedback(value);
        break;
      case 'phaser':
        if (param === 'rate' && node.setRate) node.setRate(value);
        else if (param === 'depth' && node.setDepth) node.setDepth(value);
        else if (param === 'feedback' && node.setFeedback) node.setFeedback(value);
        break;
      case 'lowpass':
      case 'highpass':
      case 'bandpass':
      case 'notch':
        if (param === 'frequency') {
          node.frequency.setValueAtTime(value, context.currentTime);
        } else if (param === 'Q') {
          node.Q.setValueAtTime(value, context.currentTime);
        }
        break;
    }

    setState(prev => ({
      ...prev,
      effects: prev.effects.map(e =>
        e.id === id ? { ...e, params: { ...e.params, [param]: value } } : e
      ),
    }));
  }, [state.effects]);

  const toggleEffect = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      effects: prev.effects.map(e =>
        e.id === id ? { ...e, enabled: !e.enabled } : e
      ),
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioEngine.setVolume(volume);
    setState(prev => ({ ...prev, volume }));
  }, []);

  const getFrequencyData = useCallback(() => {
    return audioEngine.getFrequencyData();
  }, []);

  const getTimeDomainData = useCallback(() => {
    return audioEngine.getTimeDomainData();
  }, []);

  useEffect(() => {
    return () => {
      disconnectMicrophone();
      audioEngine.destroy();
    };
  }, [disconnectMicrophone]);

  return {
    ...state,
    initialize,
    connectAudioFile,
    connectMicrophone,
    disconnectMicrophone,
    addEffect,
    removeEffect,
    updateEffectParam,
    toggleEffect,
    setVolume,
    getFrequencyData,
    getTimeDomainData,
    audioContext: audioEngine.audioContext,
    analyser: audioEngine.analyser,
  };
}
