/**
 * JACK Bridge React Hook
 * Client-side WebSocket hook for JACK audio server integration.
 * Connects to the optional JACK bridge server for advanced audio routing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { JackServerState, JackPort } from '@/lib/dsp/audio-adapter-types';

interface JackBridgeState {
  isConnected: boolean;
  isJackRunning: boolean;
  serverState: JackServerState | null;
  error: string | null;
}

interface JackBridgeMessage {
  type: string;
  data?: any;
  error?: string;
}

interface UseJackBridgeReturn extends JackBridgeState {
  connect: () => void;
  disconnect: () => void;
  refreshState: () => void;
  connectPorts: (source: string, destination: string) => Promise<boolean>;
  disconnectPorts: (source: string, destination: string) => Promise<boolean>;
  getPorts: () => JackPort[];
  getInputPorts: () => JackPort[];
  getOutputPorts: () => JackPort[];
  getPhysicalPorts: () => JackPort[];
}

const DEFAULT_STATE: JackBridgeState = {
  isConnected: false,
  isJackRunning: false,
  serverState: null,
  error: null,
};

// Default JACK bridge WebSocket URL
const getJackBridgeUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = 5001; // JACK bridge port
  return `${protocol}//${host}:${port}`;
};

export function useJackBridge(autoConnect: boolean = false): UseJackBridgeReturn {
  const [state, setState] = useState<JackBridgeState>(DEFAULT_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Map<string, (result: any) => void>>(new Map());

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    pendingRequestsRef.current.clear();
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as JackBridgeMessage;

      switch (message.type) {
        case 'state':
          setState((prev) => ({
            ...prev,
            serverState: message.data,
            isJackRunning: message.data?.isRunning ?? false,
            error: null,
          }));
          break;

        case 'ports':
          setState((prev) => ({
            ...prev,
            serverState: prev.serverState
              ? { ...prev.serverState, ports: message.data }
              : null,
          }));
          break;

        case 'connectResult':
        case 'disconnectResult':
          const callback = pendingRequestsRef.current.get(message.type);
          if (callback) {
            callback(message.data?.success ?? false);
            pendingRequestsRef.current.delete(message.type);
          }
          break;

        case 'error':
          setState((prev) => ({
            ...prev,
            error: message.error || 'Unknown error',
          }));
          break;
      }
    } catch (error) {
      console.error('JACK Bridge: Failed to parse message:', error);
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    try {
      const url = getJackBridgeUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }));
        // Request initial state
        ws.send(JSON.stringify({ command: 'getState' }));
      };

      ws.onclose = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isJackRunning: false,
        }));

        // Auto-reconnect after 5 seconds
        if (autoConnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      ws.onerror = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: 'Failed to connect to JACK bridge',
        }));
      };

      ws.onmessage = handleMessage;

      wsRef.current = ws;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [cleanup, handleMessage, autoConnect]);

  const disconnect = useCallback(() => {
    cleanup();
    setState(DEFAULT_STATE);
  }, [cleanup]);

  const sendCommand = useCallback((command: string, args?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, args }));
    }
  }, []);

  const refreshState = useCallback(() => {
    sendCommand('getState');
  }, [sendCommand]);

  const connectPorts = useCallback(
    async (source: string, destination: string): Promise<boolean> => {
      return new Promise((resolve) => {
        pendingRequestsRef.current.set('connectResult', resolve);
        sendCommand('connect', { source, destination });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has('connectResult')) {
            pendingRequestsRef.current.delete('connectResult');
            resolve(false);
          }
        }, 5000);
      });
    },
    [sendCommand]
  );

  const disconnectPorts = useCallback(
    async (source: string, destination: string): Promise<boolean> => {
      return new Promise((resolve) => {
        pendingRequestsRef.current.set('disconnectResult', resolve);
        sendCommand('disconnect', { source, destination });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has('disconnectResult')) {
            pendingRequestsRef.current.delete('disconnectResult');
            resolve(false);
          }
        }, 5000);
      });
    },
    [sendCommand]
  );

  const getPorts = useCallback((): JackPort[] => {
    return state.serverState?.ports ?? [];
  }, [state.serverState]);

  const getInputPorts = useCallback((): JackPort[] => {
    return getPorts().filter((p) => p.direction === 'input');
  }, [getPorts]);

  const getOutputPorts = useCallback((): JackPort[] => {
    return getPorts().filter((p) => p.direction === 'output');
  }, [getPorts]);

  const getPhysicalPorts = useCallback((): JackPort[] => {
    return getPorts().filter((p) => p.isPhysical);
  }, [getPorts]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      cleanup();
    };
  }, [autoConnect, connect, cleanup]);

  return {
    ...state,
    connect,
    disconnect,
    refreshState,
    connectPorts,
    disconnectPorts,
    getPorts,
    getInputPorts,
    getOutputPorts,
    getPhysicalPorts,
  };
}

export default useJackBridge;
