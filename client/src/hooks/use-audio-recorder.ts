/**
 * Audio Recorder Hook
 * Records processed audio from the Web Audio API pipeline
 */

import { useState, useCallback, useRef } from 'react';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
}

export interface UseAudioRecorderReturn {
  state: RecordingState;
  startRecording: (audioContext: AudioContext, sourceNode: AudioNode) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const updateDuration = useCallback(() => {
    if (state.isPaused) return;
    const elapsed = (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000;
    setState(prev => ({ ...prev, duration: elapsed }));
  }, [state.isPaused]);

  const startRecording = useCallback(async (audioContext: AudioContext, sourceNode: AudioNode) => {
    try {
      // Create a MediaStreamDestination to capture processed audio
      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;

      // Connect the source to the destination
      sourceNode.connect(destination);

      // Determine supported mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error('No supported audio recording format found');
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms

      // Track duration
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      durationIntervalRef.current = setInterval(updateDuration, 100);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [updateDuration]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      // Clear duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        chunksRef.current = [];

        // Disconnect from destination
        if (destinationRef.current) {
          try {
            destinationRef.current.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
          destinationRef.current = null;
        }

        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioBlob: blob,
        }));

        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      pausedDurationRef.current = Date.now() - startTimeRef.current - pausedDurationRef.current;
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      startTimeRef.current = Date.now() - state.duration * 1000;
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.duration]);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = null; // Don't process the data
      mediaRecorder.stop();
    }

    // Disconnect from destination
    if (destinationRef.current) {
      try {
        destinationRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      destinationRef.current = null;
    }

    chunksRef.current = [];
    mediaRecorderRef.current = null;

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
    });
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
}

// Utility function to convert blob to base64
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Format duration as mm:ss
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
