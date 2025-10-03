import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Download, 
  MoreVertical, 
  PlayCircle,
  Sparkles
} from "lucide-react";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { cn } from "@/lib/utils";
import type { MusicGeneration } from "@shared/schema";

interface AudioPlayerProps {
  musicGeneration: MusicGeneration | null;
  className?: string;
}

export function AudioPlayer({ musicGeneration, className }: AudioPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLoading,
    loadTrack,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    formatTime,
    audioRef,
  } = useAudioPlayer();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Load track when musicGeneration changes
  useEffect(() => {
    if (musicGeneration?.audioUrl && musicGeneration?.status === "completed") {
      loadTrack({
        id: musicGeneration.id,
        title: musicGeneration.title || "Untitled",
        audioUrl: musicGeneration.audioUrl,
        imageUrl: musicGeneration.imageUrl || undefined,
        duration: musicGeneration.duration || undefined,
        style: musicGeneration.style || undefined,
      });
    }
  }, [musicGeneration, loadTrack]);

  // Waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !isPlaying) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const barCount = 60;
      const barWidth = width / barCount;

      ctx.clearRect(0, 0, width, height);

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "hsl(280, 85%, 60%)");
      gradient.addColorStop(1, "hsl(200, 90%, 60%)");

      for (let i = 0; i < barCount; i++) {
        // Simulate waveform data with some randomness and beat
        const time = Date.now() * 0.005;
        const baseHeight = Math.sin((i * 0.1) + time) * 0.3 + 0.4;
        const beatEffect = Math.sin(time * 2) * 0.2;
        const barHeight = (baseHeight + beatEffect + Math.random() * 0.1) * height * 0.8;

        const x = i * barWidth;
        const y = height - barHeight;

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth * 0.8, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Set canvas size on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(devicePixelRatio, devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const handleDownload = async () => {
    if (!musicGeneration?.id) return;

    try {
      const response = await fetch(`/api/music/${musicGeneration.id}/download`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${musicGeneration.title || 'generated-music'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  if (!musicGeneration) {
    return (
      <Card className={cn("", className)} data-testid="audio-player-empty">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <PlayCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">No Track Selected</h3>
              <p className="text-sm text-muted-foreground">Generate music to start playing</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="metadata" />
      <Card className={cn("hover:shadow-lg transition-shadow", className)} data-testid="audio-player">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-primary" />
              Now Playing
            </h2>
            <div className="flex items-center gap-2">
              {musicGeneration.status === "completed" && (
                <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white font-medium">
                  <Sparkles className="w-3 h-3 mr-1 inline" />
                  AI Generated
                </span>
              )}
              {musicGeneration.status === "processing" && (
                <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse mr-1 inline-block"></div>
                  Processing
                </span>
              )}
            </div>
          </div>

          {/* Track Info */}
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
              {musicGeneration.imageUrl ? (
                <img 
                  src={musicGeneration.imageUrl} 
                  alt="Album artwork" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <PlayCircle className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold mb-1" data-testid="track-title">
                {musicGeneration.title || "Untitled Track"}
              </h3>
              <p className="text-sm text-muted-foreground mb-3" data-testid="track-style">
                {musicGeneration.style ? 
                  `${musicGeneration.style.charAt(0).toUpperCase()}${musicGeneration.style.slice(1).replace('-', ' ')}` : 
                  'Generated Music'
                }
                {musicGeneration.metadata && typeof musicGeneration.metadata === 'object' && 'bpm' in musicGeneration.metadata ? <span> • {String((musicGeneration.metadata as any).bpm)} BPM</span> : null}
                {musicGeneration.metadata && typeof musicGeneration.metadata === 'object' && 'key' in musicGeneration.metadata ? <span> • {String((musicGeneration.metadata as any).key)}</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {musicGeneration.duration && (
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    {formatTime(musicGeneration.duration)}
                  </span>
                )}
                {musicGeneration.model && (
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    {musicGeneration.model}
                  </span>
                )}
                {musicGeneration.instrumental && (
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    Instrumental
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="relative h-32 bg-gradient-to-b from-primary/5 to-transparent rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ width: "100%", height: "100%" }}
            />
            {!isPlaying && musicGeneration.status === "completed" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={togglePlayPause}
                  size="lg"
                  className="rounded-full w-16 h-16 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                  data-testid="button-play-overlay"
                >
                  <Play className="w-6 h-6" />
                </Button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {musicGeneration.status === "completed" && (
            <div className="space-y-2">
              <div className="relative">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={(value) => seek(value[0])}
                  className="w-full"
                  data-testid="slider-progress"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span data-testid="time-current">{formatTime(currentTime)}</span>
                <span data-testid="time-duration">{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                data-testid="button-shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                data-testid="button-previous"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                onClick={togglePlayPause}
                disabled={musicGeneration.status !== "completed" || isLoading}
                size="lg"
                className="rounded-full w-14 h-14 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 disabled:opacity-50"
                data-testid="button-play-pause"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                data-testid="button-next"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                data-testid="button-repeat"
              >
                <Repeat className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleDownload}
                disabled={musicGeneration.status !== "completed"}
                variant="outline"
                className="px-4 py-2"
                data-testid="button-download"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Stem Controls */}
          {musicGeneration.status === "completed" && (
            <Collapsible>
              <CollapsibleTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Audio Stems
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Vocals</span>
                    <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-accent p-0 h-auto">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                  <Slider defaultValue={[100]} max={100} step={1} />
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Drums</span>
                    <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-accent p-0 h-auto">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                  <Slider defaultValue={[100]} max={100} step={1} />
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Bass</span>
                    <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-accent p-0 h-auto">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                  <Slider defaultValue={[100]} max={100} step={1} />
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Instruments</span>
                    <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-accent p-0 h-auto">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                  <Slider defaultValue={[100]} max={100} step={1} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </>
  );
}
