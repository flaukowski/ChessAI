/**
 * React hook for the Pedalboard Engine
 * Provides state management and actions for the audio playground
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  pedalboardEngine,
  type PedalboardState,
  type AudioLevels,
  type PedalboardEffect,
} from '@/lib/dsp/pedalboard-engine';
import { type WorkletEffectType } from '@/lib/dsp/worklet-effects';

export type { PedalboardEffect, AudioLevels, WorkletEffectType };

export interface UsePedalboardReturn {
  // State
  isInitialized: boolean;
  isPlaying: boolean;
  inputGain: number;
  outputGain: number;
  globalBypass: boolean;
  effects: PedalboardEffect[];
  inputSource: 'file' | 'microphone' | null;
  levels: AudioLevels;

  // Actions
  initialize: () => Promise<void>;
  connectAudioFile: (element: HTMLAudioElement) => Promise<void>;
  connectMicrophone: () => Promise<void>;
  disconnectMicrophone: () => void;
  addEffect: (type: WorkletEffectType) => string;
  removeEffect: (id: string) => void;
  reorderEffects: (newOrder: string[]) => void;
  toggleEffect: (id: string) => void;
  updateEffectParam: (id: string, param: string, value: number) => void;
  setInputGain: (gain: number) => void;
  setOutputGain: (gain: number) => void;
  setGlobalBypass: (bypass: boolean) => void;
  getFrequencyData: () => Uint8Array;
  getTimeDomainData: () => Uint8Array;
  exportPreset: () => string;
  importPreset: (json: string) => void;

  // Audio context
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  outputNode: GainNode | null;
}

export function usePedalboard(): UsePedalboardReturn {
  const [state, setState] = useState<PedalboardState>({
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
  });

  const [levels, setLevels] = useState<AudioLevels>({
    inputPeakL: 0, inputPeakR: 0, inputRmsL: 0, inputRmsR: 0,
    outputPeakL: 0, outputPeakR: 0, outputRmsL: 0, outputRmsR: 0,
  });

  const unsubscribeRef = useRef<(() => void)[]>([]);

  // Subscribe to engine state changes
  useEffect(() => {
    const unsubState = pedalboardEngine.onStateChange((newState) => {
      setState(newState);
    });

    const unsubLevels = pedalboardEngine.onLevelsChange((newLevels) => {
      setLevels(newLevels);
    });

    unsubscribeRef.current = [unsubState, unsubLevels];

    // Sync initial state
    setState(pedalboardEngine.getState());

    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pedalboardEngine.destroy();
    };
  }, []);

  const initialize = useCallback(async () => {
    await pedalboardEngine.initialize();
  }, []);

  const connectAudioFile = useCallback(async (element: HTMLAudioElement) => {
    await pedalboardEngine.connectAudioElement(element);
  }, []);

  const connectMicrophone = useCallback(async () => {
    await pedalboardEngine.connectMicrophone();
  }, []);

  const disconnectMicrophone = useCallback(() => {
    pedalboardEngine.disconnectMicrophone();
  }, []);

  const addEffect = useCallback((type: WorkletEffectType): string => {
    return pedalboardEngine.addEffect(type);
  }, []);

  const removeEffect = useCallback((id: string) => {
    pedalboardEngine.removeEffect(id);
  }, []);

  const reorderEffects = useCallback((newOrder: string[]) => {
    pedalboardEngine.reorderEffects(newOrder);
  }, []);

  const toggleEffect = useCallback((id: string) => {
    pedalboardEngine.toggleEffect(id);
  }, []);

  const updateEffectParam = useCallback((id: string, param: string, value: number) => {
    pedalboardEngine.updateEffectParam(id, param, value);
  }, []);

  const setInputGain = useCallback((gain: number) => {
    pedalboardEngine.setInputGain(gain);
  }, []);

  const setOutputGain = useCallback((gain: number) => {
    pedalboardEngine.setOutputGain(gain);
  }, []);

  const setGlobalBypass = useCallback((bypass: boolean) => {
    pedalboardEngine.setGlobalBypass(bypass);
  }, []);

  const getFrequencyData = useCallback(() => {
    return pedalboardEngine.getFrequencyData();
  }, []);

  const getTimeDomainData = useCallback(() => {
    return pedalboardEngine.getTimeDomainData();
  }, []);

  const exportPreset = useCallback(() => {
    return pedalboardEngine.exportPreset();
  }, []);

  const importPreset = useCallback((json: string) => {
    pedalboardEngine.importPreset(json);
  }, []);

  return {
    // State
    isInitialized: state.isInitialized,
    isPlaying: state.isPlaying,
    inputGain: state.inputGain,
    outputGain: state.outputGain,
    globalBypass: state.globalBypass,
    effects: state.effects,
    inputSource: state.inputSource,
    levels,

    // Actions
    initialize,
    connectAudioFile,
    connectMicrophone,
    disconnectMicrophone,
    addEffect,
    removeEffect,
    reorderEffects,
    toggleEffect,
    updateEffectParam,
    setInputGain,
    setOutputGain,
    setGlobalBypass,
    getFrequencyData,
    getTimeDomainData,
    exportPreset,
    importPreset,

    // Audio context
    audioContext: pedalboardEngine.audioContext,
    analyser: pedalboardEngine.analyser,
    outputNode: pedalboardEngine.outputNode,
  };
}
