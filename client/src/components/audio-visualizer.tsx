import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, BarChart3, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

export type VisualizationType = 'waveform' | 'spectrum' | 'spectrogram';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying?: boolean;
  className?: string;
}

export function AudioVisualizer({ analyser, isPlaying = false, className }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [visualType, setVisualType] = useState<VisualizationType>('waveform');
  const spectrogramDataRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Clear canvas with gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, "rgba(0, 0, 0, 0.95)");
      bgGradient.addColorStop(1, "rgba(10, 10, 20, 0.95)");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      if (!isPlaying) {
        // Draw idle state
        ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Play audio to see visualization", width / 2, height / 2);
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(timeDataArray);

      if (visualType === 'waveform') {
        drawWaveform(ctx, timeDataArray, width, height);
      } else if (visualType === 'spectrum') {
        drawSpectrum(ctx, dataArray, width, height);
      } else if (visualType === 'spectrogram') {
        drawSpectrogram(ctx, dataArray, width, height);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, visualType]);

  const drawWaveform = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
    const sliceWidth = width / data.length;
    
    // Create gradient for waveform
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#06b6d4"); // cyan-500
    gradient.addColorStop(0.5, "#8b5cf6"); // violet-500
    gradient.addColorStop(1, "#ec4899"); // pink-500

    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw mirror effect
    ctx.globalAlpha = 0.3;
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -height);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  const drawSpectrum = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
    const barCount = 64;
    const barWidth = width / barCount;
    const step = Math.floor(data.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = data[i * step];
      const barHeight = (value / 255) * height * 0.85;

      // Gradient per bar based on frequency
      const hue = (i / barCount) * 180 + 180; // Cyan to purple
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.8)`);
      gradient.addColorStop(1, `hsla(${hue}, 80%, 70%, 0.4)`);

      ctx.fillStyle = gradient;
      
      const x = i * barWidth;
      const radius = barWidth / 4;
      
      // Rounded bars
      ctx.beginPath();
      ctx.roundRect(x + 2, height - barHeight, barWidth - 4, barHeight, [radius, radius, 0, 0]);
      ctx.fill();

      // Glow effect
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.5)`;
      ctx.shadowBlur = 10;
    }
    ctx.shadowBlur = 0;
  };

  const drawSpectrogram = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
    // Store historical data for spectrogram
    const newData = new Uint8Array(data);
    spectrogramDataRef.current.push(newData);
    
    const maxHistory = Math.floor(width / 2);
    if (spectrogramDataRef.current.length > maxHistory) {
      spectrogramDataRef.current.shift();
    }

    const history = spectrogramDataRef.current;
    const colWidth = width / maxHistory;
    const rowHeight = height / 128;

    for (let x = 0; x < history.length; x++) {
      const col = history[x];
      for (let y = 0; y < 128; y++) {
        const idx = Math.floor((y / 128) * col.length);
        const value = col[idx];
        const intensity = value / 255;

        // Color mapping: dark blue -> cyan -> yellow -> white
        const hue = 200 - intensity * 180;
        const lightness = 20 + intensity * 60;
        ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
        ctx.fillRect(
          x * colWidth,
          height - (y + 1) * rowHeight,
          colWidth + 1,
          rowHeight + 1
        );
      }
    }

    // Draw frequency labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px monospace";
    ctx.fillText("20kHz", 5, 15);
    ctx.fillText("10kHz", 5, height / 2);
    ctx.fillText("0Hz", 5, height - 5);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            Audio Visualization
          </CardTitle>
          <Tabs value={visualType} onValueChange={(v) => setVisualType(v as VisualizationType)}>
            <TabsList className="h-8">
              <TabsTrigger value="waveform" className="text-xs px-2 h-6">
                <Waves className="w-3 h-3 mr-1" />
                Wave
              </TabsTrigger>
              <TabsTrigger value="spectrum" className="text-xs px-2 h-6">
                <BarChart3 className="w-3 h-3 mr-1" />
                Spectrum
              </TabsTrigger>
              <TabsTrigger value="spectrogram" className="text-xs px-2 h-6">
                <Activity className="w-3 h-3 mr-1" />
                Spectro
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className="relative rounded-lg overflow-hidden bg-black/50">
          <canvas
            ref={canvasRef}
            className="w-full h-32"
            style={{ width: "100%", height: "128px" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
