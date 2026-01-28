/**
 * React hook for multi-channel audio adapter management
 * Provides state management and controls for AudioAdapterManager with
 * connection type detection, instrument presets, and latency monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  audioAdapterManager,
  AudioAdapterManager,
  AdapterAudioChannel,
  AdapterRoutingConnection,
  AdapterEvent,
} from '@/lib/dsp/audio-adapter-manager';
import {
  AudioAdapterDevice,
  AudioConnectionType,
  InstrumentCategory,
  InstrumentPreset,
} from '@/lib/dsp/audio-adapter-types';
import { audioEngine } from '@/lib/dsp';

export interface AudioAdapterState {
  isInitialized: boolean;
  devices: AudioAdapterDevice[];
  inputChannels: AdapterAudioChannel[];
  outputChannels: AdapterAudioChannel[];
  routingMatrix: AdapterRoutingConnection[];
  bandwidthWarning: string | null;
  latencyWarning: string | null;
  isScanning: boolean;
  isJackConnected: boolean;
}

export interface ChannelLevels {
  [channelId: string]: { peak: number; rms: number };
}

export interface UseAudioAdapterReturn extends AudioAdapterState {
  channelLevels: ChannelLevels;

  // Core operations
  initialize: () => Promise<void>;
  scanDevices: () => Promise<void>;
  createInputChannel: (deviceId: string, name?: string, presetId?: string) => Promise<AdapterAudioChannel | null>;
  createOutputChannel: (deviceId: string, name?: string) => Promise<AdapterAudioChannel | null>;
  removeChannel: (channelId: string) => void;

  // Routing
  setRouting: (inputChannelId: string, outputChannelId: string, gain?: number, enabled?: boolean) => void;
  toggleRouting: (inputChannelId: string, outputChannelId: string) => void;
  updateRoutingGain: (inputChannelId: string, outputChannelId: string, gain: number) => void;

  // Channel controls
  setChannelVolume: (channelId: string, volume: number) => void;
  setChannelPan: (channelId: string, pan: number) => void;
  setChannelMute: (channelId: string, muted: boolean) => void;
  setChannelSolo: (channelId: string, solo: boolean) => void;
  getChannelLevels: (channelId: string) => { peak: number; rms: number };
  setLatencyCompensation: (channelId: string, latencyMs: number) => void;
  getLatencyCompensation: (channelId: string) => number;

  // Presets
  applyPreset: (channelId: string, presetId: string) => boolean;
  getPresets: () => InstrumentPreset[];
  getPreset: (id: string) => InstrumentPreset | undefined;
  getPresetsByCategory: (category: InstrumentCategory) => InstrumentPreset[];
  getPresetsForConnectionType: (connectionType: AudioConnectionType) => InstrumentPreset[];

  // Device filtering
  getDevicesByConnectionType: (connectionType: AudioConnectionType) => AudioAdapterDevice[];
  getLowLatencyDevices: (maxLatencyMs?: number) => AudioAdapterDevice[];
  getBluetoothDevices: () => AudioAdapterDevice[];
  getUsbDevices: () => AudioAdapterDevice[];
  getInputDevices: () => AudioAdapterDevice[];
  getOutputDevices: () => AudioAdapterDevice[];

  // Convenience
  autoRouteInput: (inputChannelId: string) => void;
  connectToMaster: (inputChannelId: string) => void;

  // Level metering
  startLevelMetering: () => void;
  stopLevelMetering: () => void;

  // Clear warnings
  clearWarnings: () => void;
}

export function useAudioAdapter(): UseAudioAdapterReturn {
  const [state, setState] = useState<AudioAdapterState>({
    isInitialized: false,
    devices: [],
    inputChannels: [],
    outputChannels: [],
    routingMatrix: [],
    bandwidthWarning: null,
    latencyWarning: null,
    isScanning: false,
    isJackConnected: false,
  });

  const [channelLevels, setChannelLevels] = useState<ChannelLevels>({});
  const levelAnimationRef = useRef<number | null>(null);

  const updateState = useCallback(() => {
    setState(prev => ({
      ...prev,
      devices: audioAdapterManager.getDevices(),
      inputChannels: audioAdapterManager.getInputChannels(),
      outputChannels: audioAdapterManager.getOutputChannels(),
      routingMatrix: audioAdapterManager.getRoutingMatrix(),
      isJackConnected: audioAdapterManager.isJackConnected(),
    }));
  }, []);

  const initialize = useCallback(async () => {
    try {
      await audioEngine.initialize();
      await audioAdapterManager.initialize(audioEngine.audioContext!);

      setState(prev => ({ ...prev, isInitialized: true }));
      updateState();
    } catch (error) {
      console.error('Failed to initialize audio adapter:', error);
    }
  }, [updateState]);

  const scanDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isScanning: true }));
    try {
      await audioAdapterManager.discoverDevices();
      updateState();
    } finally {
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, [updateState]);

  const createInputChannel = useCallback(
    async (deviceId: string, name?: string, presetId?: string) => {
      const channel = await audioAdapterManager.createInputChannel(deviceId, name, presetId);
      if (channel) {
        updateState();
      }
      return channel;
    },
    [updateState]
  );

  const createOutputChannel = useCallback(
    async (deviceId: string, name?: string) => {
      const channel = await audioAdapterManager.createOutputChannel(deviceId, name);
      if (channel) {
        updateState();
      }
      return channel;
    },
    [updateState]
  );

  const removeChannel = useCallback(
    (channelId: string) => {
      audioAdapterManager.removeChannel(channelId);
      updateState();
    },
    [updateState]
  );

  const setRouting = useCallback(
    (inputChannelId: string, outputChannelId: string, gain?: number, enabled?: boolean) => {
      audioAdapterManager.setRouting(inputChannelId, outputChannelId, gain, enabled);
      updateState();
    },
    [updateState]
  );

  const toggleRouting = useCallback(
    (inputChannelId: string, outputChannelId: string) => {
      audioAdapterManager.toggleRouting(inputChannelId, outputChannelId);
      updateState();
    },
    [updateState]
  );

  const updateRoutingGain = useCallback(
    (inputChannelId: string, outputChannelId: string, gain: number) => {
      audioAdapterManager.updateRoutingGain(inputChannelId, outputChannelId, gain);
    },
    []
  );

  const setChannelVolume = useCallback(
    (channelId: string, volume: number) => {
      audioAdapterManager.setChannelVolume(channelId, volume);
      updateState();
    },
    [updateState]
  );

  const setChannelPan = useCallback(
    (channelId: string, pan: number) => {
      audioAdapterManager.setChannelPan(channelId, pan);
      updateState();
    },
    [updateState]
  );

  const setChannelMute = useCallback(
    (channelId: string, muted: boolean) => {
      audioAdapterManager.setChannelMute(channelId, muted);
      updateState();
    },
    [updateState]
  );

  const setChannelSolo = useCallback(
    (channelId: string, solo: boolean) => {
      audioAdapterManager.setChannelSolo(channelId, solo);
      updateState();
    },
    [updateState]
  );

  const getChannelLevels = useCallback((channelId: string) => {
    return audioAdapterManager.getChannelLevels(channelId);
  }, []);

  // Preset operations
  const applyPreset = useCallback(
    (channelId: string, presetId: string) => {
      const success = audioAdapterManager.applyPreset(channelId, presetId);
      if (success) {
        updateState();
      }
      return success;
    },
    [updateState]
  );

  const getPresets = useCallback(() => {
    return audioAdapterManager.getPresets();
  }, []);

  const getPreset = useCallback((id: string) => {
    return audioAdapterManager.getPreset(id);
  }, []);

  const getPresetsByCategory = useCallback((category: InstrumentCategory) => {
    return audioAdapterManager.getPresetsByCategory(category);
  }, []);

  const getPresetsForConnectionType = useCallback((connectionType: AudioConnectionType) => {
    return audioAdapterManager.getPresetsForConnectionType(connectionType);
  }, []);

  // Device filtering
  const getDevicesByConnectionType = useCallback((connectionType: AudioConnectionType) => {
    return audioAdapterManager.getDevicesByConnectionType(connectionType);
  }, []);

  const getLowLatencyDevices = useCallback((maxLatencyMs?: number) => {
    return audioAdapterManager.getLowLatencyDevices(maxLatencyMs);
  }, []);

  const getBluetoothDevices = useCallback(() => {
    return audioAdapterManager.getBluetoothDevices();
  }, []);

  const getUsbDevices = useCallback(() => {
    return audioAdapterManager.getUsbDevices();
  }, []);

  const getInputDevices = useCallback(() => {
    return audioAdapterManager.getInputDevices();
  }, []);

  const getOutputDevices = useCallback(() => {
    return audioAdapterManager.getOutputDevices();
  }, []);

  // Auto-route: connect input to all outputs
  const autoRouteInput = useCallback(
    (inputChannelId: string) => {
      const outputs = audioAdapterManager.getOutputChannels();
      for (const output of outputs) {
        audioAdapterManager.setRouting(inputChannelId, output.id, 1, true);
      }
      updateState();
    },
    [updateState]
  );

  // Connect input directly to master output
  const connectToMaster = useCallback(
    (inputChannelId: string) => {
      const channel = state.inputChannels.find(c => c.id === inputChannelId);
      if (channel?.pannerNode && audioEngine.audioContext) {
        channel.pannerNode.connect(audioEngine.audioContext.destination);
      }
    },
    [state.inputChannels]
  );

  // Level metering
  const startLevelMetering = useCallback(() => {
    const updateLevels = () => {
      const levels: ChannelLevels = {};

      for (const channel of audioAdapterManager.getInputChannels()) {
        levels[channel.id] = audioAdapterManager.getChannelLevels(channel.id);
      }

      for (const channel of audioAdapterManager.getOutputChannels()) {
        levels[channel.id] = audioAdapterManager.getChannelLevels(channel.id);
      }

      setChannelLevels(levels);
      levelAnimationRef.current = requestAnimationFrame(updateLevels);
    };

    levelAnimationRef.current = requestAnimationFrame(updateLevels);
  }, []);

  const stopLevelMetering = useCallback(() => {
    if (levelAnimationRef.current) {
      cancelAnimationFrame(levelAnimationRef.current);
      levelAnimationRef.current = null;
    }
  }, []);

  const clearWarnings = useCallback(() => {
    setState(prev => ({
      ...prev,
      bandwidthWarning: null,
      latencyWarning: null,
    }));
  }, []);

  // Event handling
  useEffect(() => {
    const unsubscribe = audioAdapterManager.on((event: AdapterEvent) => {
      switch (event.type) {
        case 'device-discovered':
        case 'device-connected':
        case 'device-disconnected':
        case 'channel-created':
        case 'channel-removed':
        case 'routing-changed':
        case 'preset-applied':
        case 'jack-connected':
        case 'jack-disconnected':
        case 'jack-ports-changed':
          updateState();
          break;

        case 'bandwidth-warning':
          setState(prev => ({
            ...prev,
            bandwidthWarning: event.data?.message || 'Bluetooth bandwidth warning',
          }));
          // Auto-clear after 5 seconds
          setTimeout(() => {
            setState(prev => ({ ...prev, bandwidthWarning: null }));
          }, 5000);
          break;

        case 'latency-warning':
          setState(prev => ({
            ...prev,
            latencyWarning: event.data?.message || 'High latency warning',
          }));
          // Auto-clear after 8 seconds
          setTimeout(() => {
            setState(prev => ({ ...prev, latencyWarning: null }));
          }, 8000);
          break;

        case 'device-error':
          console.error('Audio adapter error:', event.error);
          break;
      }
    });

    return () => {
      unsubscribe();
      stopLevelMetering();
    };
  }, [updateState, stopLevelMetering]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLevelMetering();
    };
  }, [stopLevelMetering]);

  const setLatencyCompensation = useCallback((channelId: string, latencyMs: number) => {
    audioAdapterManager.setLatencyCompensation(channelId, latencyMs);
    updateState();
  }, [updateState]);

  const getLatencyCompensation = useCallback((channelId: string) => {
    return audioAdapterManager.getLatencyCompensation(channelId);
  }, []);

  return {
    ...state,
    channelLevels,
    initialize,
    scanDevices,
    createInputChannel,
    createOutputChannel,
    removeChannel,
    setRouting,
    toggleRouting,
    updateRoutingGain,
    setChannelVolume,
    setChannelPan,
    setChannelMute,
    setChannelSolo,
    getChannelLevels,
    setLatencyCompensation,
    getLatencyCompensation,
    applyPreset,
    getPresets,
    getPreset,
    getPresetsByCategory,
    getPresetsForConnectionType,
    getDevicesByConnectionType,
    getLowLatencyDevices,
    getBluetoothDevices,
    getUsbDevices,
    getInputDevices,
    getOutputDevices,
    autoRouteInput,
    connectToMaster,
    startLevelMetering,
    stopLevelMetering,
    clearWarnings,
  };
}

export default useAudioAdapter;
