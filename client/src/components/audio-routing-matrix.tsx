import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GitBranch, Volume2, Mic, Speaker, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AudioChannel, RoutingConnection } from "@/lib/dsp/bluetooth-audio-manager";

interface AudioRoutingMatrixProps {
  inputChannels: AudioChannel[];
  outputChannels: AudioChannel[];
  routingMatrix: RoutingConnection[];
  channelLevels: { [channelId: string]: { peak: number; rms: number } };
  onSetRouting: (
    inputChannelId: string,
    outputChannelId: string,
    gain?: number,
    enabled?: boolean
  ) => void;
  onToggleRouting: (inputChannelId: string, outputChannelId: string) => void;
  onUpdateRoutingGain: (
    inputChannelId: string,
    outputChannelId: string,
    gain: number
  ) => void;
  onSetChannelVolume: (channelId: string, volume: number) => void;
  onSetChannelPan: (channelId: string, pan: number) => void;
  className?: string;
}

export function AudioRoutingMatrix({
  inputChannels,
  outputChannels,
  routingMatrix,
  channelLevels,
  onSetRouting,
  onToggleRouting,
  onUpdateRoutingGain,
  onSetChannelVolume,
  onSetChannelPan,
  className,
}: AudioRoutingMatrixProps) {
  const getRouting = (inputId: string, outputId: string): RoutingConnection | undefined => {
    return routingMatrix.find(
      (r) => r.inputChannelId === inputId && r.outputChannelId === outputId
    );
  };

  const hasNoChannels = inputChannels.length === 0 || outputChannels.length === 0;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-500" />
          Audio Routing Matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasNoChannels ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {inputChannels.length === 0 && outputChannels.length === 0
                ? "Add input and output channels to configure routing"
                : inputChannels.length === 0
                ? "Add input channels to configure routing"
                : "Add output channels to configure routing"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Matrix Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-xs text-left text-muted-foreground w-32">
                      Input → Output
                    </th>
                    {outputChannels.map((output) => (
                      <th key={output.id} className="p-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Speaker
                            className="w-4 h-4"
                            style={{ color: output.color }}
                          />
                          <span className="text-[10px] max-w-16 truncate block">
                            {output.name}
                          </span>
                          <LevelMeter
                            level={channelLevels[output.id]?.peak || 0}
                            color={output.color}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inputChannels.map((input) => (
                    <tr key={input.id} className="border-t border-border/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Mic
                            className="w-4 h-4"
                            style={{ color: input.color }}
                          />
                          <div className="flex flex-col">
                            <span className="text-xs truncate max-w-24">
                              {input.name}
                            </span>
                            <LevelMeter
                              level={channelLevels[input.id]?.peak || 0}
                              color={input.color}
                              horizontal
                            />
                          </div>
                        </div>
                      </td>
                      {outputChannels.map((output) => {
                        const routing = getRouting(input.id, output.id);
                        const isConnected = routing?.enabled ?? false;
                        
                        return (
                          <td key={output.id} className="p-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={isConnected ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8 mx-auto block",
                                      isConnected && "bg-gradient-to-br",
                                      isConnected && `from-[${input.color}] to-[${output.color}]`
                                    )}
                                    style={
                                      isConnected
                                        ? {
                                            background: `linear-gradient(135deg, ${input.color}, ${output.color})`,
                                          }
                                        : undefined
                                    }
                                    onClick={() => {
                                      if (routing) {
                                        onToggleRouting(input.id, output.id);
                                      } else {
                                        onSetRouting(input.id, output.id, 1, true);
                                      }
                                    }}
                                  >
                                    {isConnected ? (
                                      <Check className="w-4 h-4 text-white" />
                                    ) : (
                                      <X className="w-4 h-4 opacity-30" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {isConnected
                                      ? `${input.name} → ${output.name} (Click to disconnect)`
                                      : `Connect ${input.name} to ${output.name}`}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Channel Controls */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              {/* Input Channel Controls */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  Input Channels
                </h4>
                {inputChannels.map((channel) => (
                  <ChannelControls
                    key={channel.id}
                    channel={channel}
                    showPan
                    onVolumeChange={(v) => onSetChannelVolume(channel.id, v)}
                    onPanChange={(p) => onSetChannelPan(channel.id, p)}
                  />
                ))}
              </div>

              {/* Output Channel Controls */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Speaker className="w-3 h-3" />
                  Output Channels
                </h4>
                {outputChannels.map((channel) => (
                  <ChannelControls
                    key={channel.id}
                    channel={channel}
                    onVolumeChange={(v) => onSetChannelVolume(channel.id, v)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface LevelMeterProps {
  level: number;
  color: string;
  horizontal?: boolean;
}

function LevelMeter({ level, color, horizontal }: LevelMeterProps) {
  const percentage = Math.min(100, level * 100);
  const isClipping = level > 0.95;

  if (horizontal) {
    return (
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-75 rounded-full",
            isClipping && "animate-pulse"
          )}
          style={{
            width: `${percentage}%`,
            backgroundColor: isClipping ? "#ef4444" : color,
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-1.5 h-8 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "w-full transition-all duration-75 rounded-full",
          isClipping && "animate-pulse"
        )}
        style={{
          height: `${percentage}%`,
          backgroundColor: isClipping ? "#ef4444" : color,
          marginTop: `${100 - percentage}%`,
        }}
      />
    </div>
  );
}

interface ChannelControlsProps {
  channel: AudioChannel;
  showPan?: boolean;
  onVolumeChange: (volume: number) => void;
  onPanChange?: (pan: number) => void;
}

function ChannelControls({
  channel,
  showPan,
  onVolumeChange,
  onPanChange,
}: ChannelControlsProps) {
  return (
    <div
      className="p-2 rounded-md bg-muted/30"
      style={{ borderLeft: `3px solid ${channel.color}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium truncate max-w-32">{channel.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {Math.round(channel.volume * 100)}%
        </Badge>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2">
        <Volume2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <Slider
          value={[channel.volume]}
          min={0}
          max={2}
          step={0.01}
          onValueChange={([v]) => onVolumeChange(v)}
          className="flex-1"
        />
      </div>

      {/* Pan (only for inputs) */}
      {showPan && onPanChange && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground w-3">L</span>
          <Slider
            value={[channel.pan]}
            min={-1}
            max={1}
            step={0.01}
            onValueChange={([p]) => onPanChange(p)}
            className="flex-1"
          />
          <span className="text-[10px] text-muted-foreground w-3">R</span>
        </div>
      )}
    </div>
  );
}
