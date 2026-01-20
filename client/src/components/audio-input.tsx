import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Upload, FileAudio, X, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface AudioInputProps {
  onAudioElementReady: (element: HTMLAudioElement) => void;
  onMicrophoneConnect: () => Promise<void>;
  onMicrophoneDisconnect: () => void;
  onFileLoaded?: (file: File) => void;
  inputSource: 'file' | 'microphone' | null;
  volume: number;
  onVolumeChange: (volume: number) => void;
  className?: string;
}

export interface AudioInputRef {
  loadFromUrl: (url: string, title: string) => Promise<void>;
}

export const AudioInput = forwardRef<AudioInputRef, AudioInputProps>(function AudioInput({
  onAudioElementReady,
  onMicrophoneConnect,
  onMicrophoneDisconnect,
  onFileLoaded,
  inputSource,
  volume,
  onVolumeChange,
  className,
}, ref) {
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [isConnectingMic, setIsConnectingMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Cleanup object URL to prevent memory leaks
  const revokeCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    // Revoke previous URL to prevent memory leaks
    revokeCurrentUrl();

    setLoadedFile(file);
    setMicError(null);

    // Notify parent about the file
    onFileLoaded?.(file);

    // Create object URL and set on audio element
    if (audioRef.current) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      audioRef.current.src = url;
      audioRef.current.load();
      onAudioElementReady(audioRef.current);
    }
  }, [onAudioElementReady, onFileLoaded, revokeCurrentUrl]);

  const handleMicrophoneToggle = useCallback(async () => {
    if (inputSource === 'microphone') {
      onMicrophoneDisconnect();
      setMicError(null);
    } else {
      setIsConnectingMic(true);
      setMicError(null);
      try {
        await onMicrophoneConnect();
      } catch (error) {
        setMicError('Microphone access denied. Please allow microphone access in your browser settings.');
        console.error('Microphone error:', error);
      } finally {
        setIsConnectingMic(false);
      }
    }
  }, [inputSource, onMicrophoneConnect, onMicrophoneDisconnect]);

  const handleClearFile = useCallback(() => {
    revokeCurrentUrl();
    setLoadedFile(null);
    if (audioRef.current) {
      audioRef.current.src = '';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [revokeCurrentUrl]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      // Revoke previous URL to prevent memory leaks
      revokeCurrentUrl();

      setLoadedFile(file);
      setMicError(null);

      // Notify parent about the file
      onFileLoaded?.(file);

      if (audioRef.current) {
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        audioRef.current.src = url;
        audioRef.current.load();
        onAudioElementReady(audioRef.current);
      }
    }
  }, [onAudioElementReady, onFileLoaded, revokeCurrentUrl]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // Load audio from URL (for loading saved/community recordings)
  const loadFromUrl = useCallback(async (url: string, title: string) => {
    try {
      console.log('[AudioInput] Loading from URL:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Audio file is empty');
      }

      // Determine content type and extension
      const contentType = blob.type || response.headers.get('content-type') || 'audio/wav';
      const extension = contentType.split('/')[1]?.split(';')[0] || 'wav';
      const file = new File([blob], `${title}.${extension}`, { type: contentType });

      console.log('[AudioInput] Loaded file:', file.name, 'size:', file.size, 'type:', file.type);

      // Revoke previous URL to prevent memory leaks
      revokeCurrentUrl();

      setLoadedFile(file);
      setMicError(null);

      // Notify parent about the file (for export functionality)
      onFileLoaded?.(file);

      if (audioRef.current) {
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        audioRef.current.src = objectUrl;
        
        // Wait for the audio to be ready before connecting
        await new Promise<void>((resolve, reject) => {
          const audio = audioRef.current!;
          const handleCanPlay = () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          };
          const handleError = () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(new Error('Audio failed to load'));
          };
          audio.addEventListener('canplaythrough', handleCanPlay);
          audio.addEventListener('error', handleError);
          audio.load();
        });

        console.log('[AudioInput] Audio loaded and ready, connecting to audio context');
        onAudioElementReady(audioRef.current);
      }
    } catch (error) {
      console.error('[AudioInput] Failed to load audio from URL:', error);
      setMicError(`Failed to load recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [onAudioElementReady, onFileLoaded, revokeCurrentUrl]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    loadFromUrl,
  }), [loadFromUrl]);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-cyan-500" />
          Audio Input
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden audio element for file playback */}
        <audio ref={audioRef} controls className="w-full h-10 rounded" />

        {/* File Upload */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
            loadedFile ? "border-cyan-500/50 bg-cyan-500/5" : "border-border hover:border-primary/50"
          )}
        >
          {loadedFile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileAudio className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                <span className="text-sm truncate">{loadedFile.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={handleClearFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drop audio file here or click to browse
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
                id="audio-file-input"
              />
              <Label htmlFor="audio-file-input">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-3 h-3 mr-1" />
                    Browse Files
                  </span>
                </Button>
              </Label>
            </>
          )}
        </div>

        {/* Microphone Input */}
        <div className="flex items-center gap-3">
          <Button
            variant={inputSource === 'microphone' ? "default" : "outline"}
            className={cn(
              "flex-1",
              inputSource === 'microphone' && "bg-gradient-to-r from-red-500 to-pink-500"
            )}
            onClick={handleMicrophoneToggle}
            disabled={isConnectingMic}
          >
            {inputSource === 'microphone' ? (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Stop Microphone
              </>
            ) : isConnectingMic ? (
              <>
                <Mic className="w-4 h-4 mr-2 animate-pulse" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Use Microphone
              </>
            )}
          </Button>
        </div>

        {micError && (
          <p className="text-xs text-destructive">{micError}</p>
        )}

        {/* Feedback Warning for Microphone */}
        {inputSource === 'microphone' && (
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-500">
              <strong>Feedback Warning:</strong> Use headphones to avoid audio feedback when using the microphone with speakers. The processed audio is playing through your output device.
            </p>
          </div>
        )}

        {/* Volume Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              Output Volume
            </Label>
            <span className="text-xs font-mono">{Math.round(volume * 100)}%</span>
          </div>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v]) => onVolumeChange(v)}
          />
        </div>

        {/* Input Status */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                inputSource ? "bg-green-500 animate-pulse" : "bg-gray-500"
              )}
            />
            {inputSource === 'microphone' ? (
              <span>Live microphone input active</span>
            ) : inputSource === 'file' ? (
              <span>Audio file loaded - use controls to play</span>
            ) : (
              <span>No audio source connected</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
