/**
 * React hook for multi-channel Bluetooth audio management
 * Provides state management and controls for BluetoothAudioManager
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  bluetoothAudioManager,
  BluetoothAudioDevice,
  AudioChannel,
  RoutingConnection,
  BluetoothEvent,
} from '@/lib/dsp/bluetooth-audio-manager';
import { audioEngine } from '@/lib/dsp';

export interface BluetoothAudioState {
  isInitialized: boolean;
  devices: BluetoothAudioDevice[];
  inputChannels: AudioChannel[];
  outputChannels: AudioChannel[];
  routingMatrix: RoutingConnection[];
  bandwidthWarning: string | null;
  isScanning: boolean;
  globalOutputMute: boolean;
  globalInputMute: boolean;
  disabledDevices: string[];
}

export interface ChannelLevels {
  [channelId: string]: { peak: number; rms: number };
}

export function useBluetoothAudio() {
  const [state, setState] = useState<BluetoothAudioState>({
    isInitialized: false,
    devices: [],
    inputChannels: [],
    outputChannels: [],
    routingMatrix: [],
    bandwidthWarning: null,
    isScanning: false,
    globalOutputMute: false,
    globalInputMute: false,
    disabledDevices: [],
  });

  const [channelLevels, setChannelLevels] = useState<ChannelLevels>({});
  const levelAnimationRef = useRef<number | null>(null);

  const updateState = useCallback(() => {
    setState(prev => ({
      ...prev,
      devices: bluetoothAudioManager.getDevices(),
      inputChannels: bluetoothAudioManager.getInputChannels(),
      outputChannels: bluetoothAudioManager.getOutputChannels(),
      routingMatrix: bluetoothAudioManager.getRoutingMatrix(),
      globalOutputMute: bluetoothAudioManager.getGlobalOutputMute(),
      globalInputMute: bluetoothAudioManager.getGlobalInputMute(),
      disabledDevices: bluetoothAudioManager.getDisabledDevices(),
    }));
  }, []);

  const initialize = useCallback(async () => {
    try {
      // Initialize audio engine first if not already
      await audioEngine.initialize();
      
      // Pass the existing audio context to bluetooth manager
      await bluetoothAudioManager.initialize(audioEngine.audioContext!);
      
      setState(prev => ({ ...prev, isInitialized: true }));
      updateState();
    } catch (error) {
      console.error('Failed to initialize Bluetooth audio:', error);
    }
  }, [updateState]);

  const scanDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isScanning: true }));
    try {
      await bluetoothAudioManager.discoverDevices();
      updateState();
    } finally {
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, [updateState]);

  const createInputChannel = useCallback(async (deviceId: string, name?: string) => {
    const channel = await bluetoothAudioManager.createInputChannel(deviceId, name);
    if (channel) {
      updateState();
    }
    return channel;
  }, [updateState]);

  const createOutputChannel = useCallback(async (deviceId: string, name?: string) => {
    const channel = await bluetoothAudioManager.createOutputChannel(deviceId, name);
    if (channel) {
      updateState();
    }
    return channel;
  }, [updateState]);

  const removeChannel = useCallback((channelId: string) => {
    bluetoothAudioManager.removeChannel(channelId);
    updateState();
  }, [updateState]);

  const setRouting = useCallback((
    inputChannelId: string,
    outputChannelId: string,
    gain?: number,
    enabled?: boolean
  ) => {
    bluetoothAudioManager.setRouting(inputChannelId, outputChannelId, gain, enabled);
    updateState();
  }, [updateState]);

  const toggleRouting = useCallback((inputChannelId: string, outputChannelId: string) => {
    bluetoothAudioManager.toggleRouting(inputChannelId, outputChannelId);
    updateState();
  }, [updateState]);

  const updateRoutingGain = useCallback((
    inputChannelId: string,
    outputChannelId: string,
    gain: number
  ) => {
    bluetoothAudioManager.updateRoutingGain(inputChannelId, outputChannelId, gain);
  }, []);

  const setChannelVolume = useCallback((channelId: string, volume: number) => {
    bluetoothAudioManager.setChannelVolume(channelId, volume);
    updateState();
  }, [updateState]);

  const setChannelPan = useCallback((channelId: string, pan: number) => {
    bluetoothAudioManager.setChannelPan(channelId, pan);
    updateState();
  }, [updateState]);

  const setChannelMute = useCallback((channelId: string, muted: boolean) => {
    bluetoothAudioManager.setChannelMute(channelId, muted);
    updateState();
  }, [updateState]);

  const setChannelSolo = useCallback((channelId: string, solo: boolean) => {
    bluetoothAudioManager.setChannelSolo(channelId, solo);
    updateState();
  }, [updateState]);

  const getChannelLevels = useCallback((channelId: string) => {
    return bluetoothAudioManager.getChannelLevels(channelId);
  }, []);

  // Auto-route: connect input to all outputs
  const autoRouteInput = useCallback((inputChannelId: string) => {
    const outputs = bluetoothAudioManager.getOutputChannels();
    for (const output of outputs) {
      bluetoothAudioManager.setRouting(inputChannelId, output.id, 1, true);
    }
    updateState();
  }, [updateState]);

  // Connect input directly to master output (default destination)
  const connectToMaster = useCallback((inputChannelId: string) => {
    const channel = state.inputChannels.find(c => c.id === inputChannelId);
    if (channel?.pannerNode && audioEngine.audioContext) {
      // Connect to master gain which goes to destination
      channel.pannerNode.connect(audioEngine.audioContext.destination);
    }
  }, [state.inputChannels]);

  // Level metering animation loop
  const startLevelMetering = useCallback(() => {
    const updateLevels = () => {
      const levels: ChannelLevels = {};
      
      for (const channel of bluetoothAudioManager.getInputChannels()) {
        levels[channel.id] = bluetoothAudioManager.getChannelLevels(channel.id);
      }
      
      for (const channel of bluetoothAudioManager.getOutputChannels()) {
        levels[channel.id] = bluetoothAudioManager.getChannelLevels(channel.id);
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

  // Event handling
  useEffect(() => {
    const unsubscribe = bluetoothAudioManager.on((event: BluetoothEvent) => {
      switch (event.type) {
        case 'device-discovered':
        case 'device-connected':
        case 'device-disconnected':
        case 'channel-created':
        case 'channel-removed':
        case 'routing-changed':
          updateState();
          break;
        case 'bandwidth-warning':
          setState(prev => ({
            ...prev,
            bandwidthWarning: event.data?.message || 'Bluetooth bandwidth warning',
          }));
          // Auto-clear warning after 5 seconds
          setTimeout(() => {
            setState(prev => ({ ...prev, bandwidthWarning: null }));
          }, 5000);
          break;
        case 'device-error':
          console.error('Bluetooth device error:', event.error);
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
    autoRouteInput,
    connectToMaster,
    startLevelMetering,
    stopLevelMetering,
    getBluetoothDevices: () => bluetoothAudioManager.getBluetoothDevices(),
    getInputDevices: () => bluetoothAudioManager.getInputDevices(),
    getOutputDevices: () => bluetoothAudioManager.getOutputDevices(),
    // New global controls for feedback prevention
    setGlobalOutputMute: (muted: boolean) => {
      bluetoothAudioManager.setGlobalOutputMute(muted);
      updateState();
    },
    setGlobalInputMute: (muted: boolean) => {
      bluetoothAudioManager.setGlobalInputMute(muted);
      updateState();
    },
    disableDevice: (deviceId: string) => {
      bluetoothAudioManager.disableDevice(deviceId);
      updateState();
    },
    enableDevice: (deviceId: string) => {
      bluetoothAudioManager.enableDevice(deviceId);
      updateState();
    },
    isDeviceDisabled: (deviceId: string) => bluetoothAudioManager.isDeviceDisabled(deviceId),
  };
}
