import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Waves, 
  Radio, 
  Disc, 
  AudioLines,
  ChevronDown,
  ChevronUp,
  GripVertical
} from "lucide-react";
import { useAudioDSP, EffectType, EffectInstance } from "@/hooks/use-audio-dsp";
import { cn } from "@/lib/utils";

const EFFECT_CONFIGS: Record<EffectType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  params: { key: string; label: string; min: number; max: number; step: number; unit?: string }[];
}> = {
  echo: {
    label: "Echo",
    icon: <Waves className="w-4 h-4" />,
    color: "from-blue-500 to-cyan-500",
    params: [
      { key: "delayMs", label: "Delay", min: 10, max: 1000, step: 10, unit: "ms" },
      { key: "feedback", label: "Feedback", min: 0, max: 0.95, step: 0.05 },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.05 },
    ],
  },
  flanger: {
    label: "Flanger",
    icon: <Radio className="w-4 h-4" />,
    color: "from-purple-500 to-pink-500",
    params: [
      { key: "rate", label: "Rate", min: 0.1, max: 10, step: 0.1, unit: "Hz" },
      { key: "depth", label: "Depth", min: 0, max: 1, step: 0.05 },
      { key: "feedback", label: "Feedback", min: 0, max: 0.95, step: 0.05 },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.05 },
    ],
  },
  phaser: {
    label: "Phaser",
    icon: <Disc className="w-4 h-4" />,
    color: "from-green-500 to-emerald-500",
    params: [
      { key: "rate", label: "Rate", min: 0.1, max: 5, step: 0.1, unit: "Hz" },
      { key: "depth", label: "Depth", min: 100, max: 2000, step: 50, unit: "Hz" },
      { key: "feedback", label: "Feedback", min: 0, max: 0.95, step: 0.05 },
      { key: "mix", label: "Mix", min: 0, max: 1, step: 0.05 },
    ],
  },
  lowpass: {
    label: "Low Pass",
    icon: <AudioLines className="w-4 h-4" />,
    color: "from-orange-500 to-amber-500",
    params: [
      { key: "frequency", label: "Cutoff", min: 20, max: 20000, step: 10, unit: "Hz" },
      { key: "Q", label: "Resonance", min: 0.1, max: 20, step: 0.1 },
    ],
  },
  highpass: {
    label: "High Pass",
    icon: <AudioLines className="w-4 h-4" />,
    color: "from-red-500 to-rose-500",
    params: [
      { key: "frequency", label: "Cutoff", min: 20, max: 20000, step: 10, unit: "Hz" },
      { key: "Q", label: "Resonance", min: 0.1, max: 20, step: 0.1 },
    ],
  },
  bandpass: {
    label: "Band Pass",
    icon: <AudioLines className="w-4 h-4" />,
    color: "from-indigo-500 to-violet-500",
    params: [
      { key: "frequency", label: "Center", min: 20, max: 20000, step: 10, unit: "Hz" },
      { key: "Q", label: "Width", min: 0.1, max: 20, step: 0.1 },
    ],
  },
  notch: {
    label: "Notch",
    icon: <AudioLines className="w-4 h-4" />,
    color: "from-teal-500 to-cyan-500",
    params: [
      { key: "frequency", label: "Frequency", min: 20, max: 20000, step: 10, unit: "Hz" },
      { key: "Q", label: "Width", min: 0.1, max: 20, step: 0.1 },
    ],
  },
};

interface EffectCardProps {
  effect: EffectInstance;
  config: typeof EFFECT_CONFIGS[EffectType];
  onRemove: () => void;
  onToggle: () => void;
  onParamChange: (param: string, value: number) => void;
}

function EffectCard({ effect, config, onRemove, onToggle, onParamChange }: EffectCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className={cn(
      "transition-all duration-200",
      !effect.enabled && "opacity-50"
    )}>
      <div className={cn(
        "h-1 rounded-t-lg bg-gradient-to-r",
        config.color
      )} />
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-r text-white",
              config.color
            )}>
              {config.icon}
            </div>
            <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={effect.enabled}
              onCheckedChange={onToggle}
              className="scale-75"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-3 pt-2 space-y-3">
          {config.params.map((param) => (
            <div key={param.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{param.label}</Label>
                <span className="text-xs font-mono">
                  {effect.params[param.key]?.toFixed(param.step < 1 ? 2 : 0)}
                  {param.unit && <span className="text-muted-foreground ml-0.5">{param.unit}</span>}
                </span>
              </div>
              <Slider
                value={[effect.params[param.key] || param.min]}
                min={param.min}
                max={param.max}
                step={param.step}
                onValueChange={([value]) => onParamChange(param.key, value)}
                disabled={!effect.enabled}
                className="w-full"
              />
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

interface EffectsRackProps {
  className?: string;
}

export function EffectsRack({ className }: EffectsRackProps) {
  const {
    effects,
    isInitialized,
    initialize,
    addEffect,
    removeEffect,
    updateEffectParam,
    toggleEffect,
  } = useAudioDSP();

  const [selectedEffect, setSelectedEffect] = useState<EffectType>("echo");

  const handleAddEffect = async () => {
    if (!isInitialized) {
      await initialize();
    }
    addEffect(selectedEffect);
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Waves className="w-5 h-5 text-cyan-500" />
            Effects Rack
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {effects.length} effect{effects.length !== 1 ? 's' : ''} active
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Effect Controls */}
        <div className="flex gap-2">
          <Select value={selectedEffect} onValueChange={(v) => setSelectedEffect(v as EffectType)}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EFFECT_CONFIGS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddEffect} className="bg-gradient-to-r from-cyan-500 to-purple-600">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Effects List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {effects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Waves className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No effects added yet</p>
              <p className="text-xs">Add effects to process your audio in real-time</p>
            </div>
          ) : (
            effects.map((effect) => (
              <EffectCard
                key={effect.id}
                effect={effect}
                config={EFFECT_CONFIGS[effect.type]}
                onRemove={() => removeEffect(effect.id)}
                onToggle={() => toggleEffect(effect.id)}
                onParamChange={(param, value) => updateEffectParam(effect.id, param, value)}
              />
            ))
          )}
        </div>

        {/* DSP Info */}
        {effects.length > 0 && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <p className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              DSP Engine: Web Audio API
            </p>
            <p className="mt-1 opacity-70">
              Algorithms ported from AudioNoise C library
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
