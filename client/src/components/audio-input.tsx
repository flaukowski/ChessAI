import { useState, useRef, useCallback } from "react";
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

export function AudioInput({
  onAudioElementReady,
  onMicrophoneConnect,
  onMicrophoneDisconnect,
  onFileLoaded,
  inputSource,
  volume,
  onVolumeChange,
  className,
}: AudioInputProps) {
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [isConnectingMic, setIsConnectingMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    setLoadedFile(file);
    setMicError(null);

    // Notify parent about the file
    onFileLoaded?.(file);

    // Create object URL and set on audio element
    if (audioRef.current) {
      const url = URL.createObjectURL(file);
      audioRef.current.src = url;
      audioRef.current.load();
      onAudioElementReady(audioRef.current);
    }
  }, [onAudioElementReady, onFileLoaded]);

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
    setLoadedFile(null);
    if (audioRef.current) {
      audioRef.current.src = '';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      setLoadedFile(file);
      setMicError(null);

      // Notify parent about the file
      onFileLoaded?.(file);

      if (audioRef.current) {
        const url = URL.createObjectURL(file);
        audioRef.current.src = url;
        audioRef.current.load();
        onAudioElementReady(audioRef.current);
      }
    }
  }, [onAudioElementReady, onFileLoaded]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

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
}
