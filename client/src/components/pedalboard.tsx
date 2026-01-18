/**
 * AudioNoise Web - Pedalboard Component
 * Full-featured audio effects pedalboard with drag-and-drop, presets, and export
 */

import { useState, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Power,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
  Upload,
  Share2,
  Copy,
  Link,
  Sliders,
  Disc,
  Mic2,
  Guitar,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { VirtualKnob } from '@/components/ui/virtual-knob';
import { LevelMeter, DualLevelMeter } from '@/components/level-meter';
import { type PedalboardEffect, type WorkletEffectType } from '@/hooks/use-pedalboard';

// Effect configuration metadata
const EFFECT_CONFIGS: Record<WorkletEffectType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  params: { key: string; label: string; min: number; max: number; step: number; unit?: string }[];
}> = {
  eq: {
    label: '3-Band EQ',
    icon: <Sliders className="w-4 h-4" />,
    color: 'from-blue-500 to-cyan-500',
    description: 'Shape your tone with low, mid, and high bands',
    params: [
      { key: 'lowGain', label: 'Low', min: -24, max: 24, step: 1, unit: 'dB' },
      { key: 'lowFreq', label: 'Low Freq', min: 20, max: 500, step: 10, unit: 'Hz' },
      { key: 'midGain', label: 'Mid', min: -24, max: 24, step: 1, unit: 'dB' },
      { key: 'midFreq', label: 'Mid Freq', min: 200, max: 5000, step: 50, unit: 'Hz' },
      { key: 'midQ', label: 'Mid Q', min: 0.1, max: 10, step: 0.1 },
      { key: 'highGain', label: 'High', min: -24, max: 24, step: 1, unit: 'dB' },
      { key: 'highFreq', label: 'High Freq', min: 1000, max: 20000, step: 100, unit: 'Hz' },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  distortion: {
    label: 'Distortion',
    icon: <Guitar className="w-4 h-4" />,
    color: 'from-orange-500 to-red-500',
    description: 'From subtle warmth to face-melting crunch',
    params: [
      { key: 'drive', label: 'Drive', min: 0, max: 1, step: 0.05 },
      { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.05 },
      { key: 'mode', label: 'Mode', min: 0, max: 6, step: 1 },
      { key: 'level', label: 'Level', min: 0, max: 1, step: 0.05 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  delay: {
    label: 'Delay',
    icon: <Disc className="w-4 h-4" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Echo and repeat for depth and space',
    params: [
      { key: 'time', label: 'Time', min: 1, max: 2000, step: 10, unit: 'ms' },
      { key: 'feedback', label: 'Feedback', min: 0, max: 0.95, step: 0.05 },
      { key: 'damping', label: 'Damping', min: 0, max: 1, step: 0.05 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  chorus: {
    label: 'Chorus',
    icon: <Mic2 className="w-4 h-4" />,
    color: 'from-green-500 to-teal-500',
    description: 'Rich, shimmering modulation',
    params: [
      { key: 'rate', label: 'Rate', min: 0.1, max: 10, step: 0.1, unit: 'Hz' },
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.05 },
      { key: 'voices', label: 'Voices', min: 1, max: 4, step: 1 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  compressor: {
    label: 'Compressor',
    icon: <Volume2 className="w-4 h-4" />,
    color: 'from-indigo-500 to-violet-500',
    description: 'Control dynamics and add punch',
    params: [
      { key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 1, unit: 'dB' },
      { key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.5 },
      { key: 'attack', label: 'Attack', min: 0.1, max: 100, step: 1, unit: 'ms' },
      { key: 'release', label: 'Release', min: 10, max: 1000, step: 10, unit: 'ms' },
      { key: 'makeupGain', label: 'Makeup', min: 0, max: 24, step: 1, unit: 'dB' },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  basspurr: {
    label: 'BassPurr',
    icon: <Guitar className="w-4 h-4" />,
    color: 'from-amber-500 to-yellow-500',
    description: 'Bass harmonics generator with fundamental, even, and odd paths',
    params: [
      { key: 'fundamental', label: 'Fundamental', min: 0, max: 1, step: 0.05 },
      { key: 'even', label: 'Even', min: 0, max: 1, step: 0.05 },
      { key: 'odd', label: 'Odd', min: 0, max: 1, step: 0.05 },
      { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.05 },
      { key: 'output', label: 'Output', min: 0, max: 1, step: 0.05 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  tremolo: {
    label: 'Tremolo',
    icon: <Volume2 className="w-4 h-4" />,
    color: 'from-rose-500 to-pink-500',
    description: 'Classic LFO-modulated amplitude for pulsing dynamics',
    params: [
      { key: 'rate', label: 'Rate', min: 0.5, max: 15, step: 0.5, unit: 'Hz' },
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.05 },
      { key: 'waveform', label: 'Wave', min: 0, max: 1, step: 1 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
  reverb: {
    label: 'Reverb',
    icon: <Waves className="w-4 h-4" />,
    color: 'from-cyan-500 to-blue-500',
    description: 'Algorithmic reverb for room simulation and spatial depth',
    params: [
      { key: 'roomSize', label: 'Room Size', min: 0, max: 1, step: 0.05 },
      { key: 'damping', label: 'Damping', min: 0, max: 1, step: 0.05 },
      { key: 'preDelay', label: 'Pre-Delay', min: 0, max: 100, step: 1, unit: 'ms' },
      { key: 'decay', label: 'Decay', min: 0.1, max: 10, step: 0.1, unit: 's' },
      { key: 'width', label: 'Width', min: 0, max: 1, step: 0.05 },
      { key: 'mix', label: 'Mix', min: 0, max: 1, step: 0.05 },
    ],
  },
};

// Extended distortion modes including new waveshaper primitives from AudioNoise PR #64
const DISTORTION_MODES = ['Soft Clip', 'Hard Clip', 'Tube', 'Quadratic', 'Foldback', 'Tube Clip', 'Diode'];

// Gradient to knob color mapping
const gradientToKnobColor: Record<string, string> = {
  'from-blue-500 to-cyan-500': 'cyan',
  'from-orange-500 to-red-500': 'orange',
  'from-purple-500 to-pink-500': 'purple',
  'from-green-500 to-teal-500': 'green',
  'from-indigo-500 to-violet-500': 'purple',
  'from-amber-500 to-yellow-500': 'orange',
  'from-rose-500 to-pink-500': 'pink',
  'from-cyan-500 to-blue-500': 'cyan',
};

const TREMOLO_WAVEFORMS = ['Sine', 'Triangle'];

// Sortable Effect Card
interface SortableEffectCardProps {
  effect: PedalboardEffect;
  config: typeof EFFECT_CONFIGS[WorkletEffectType];
  onRemove: () => void;
  onToggle: () => void;
  onParamChange: (param: string, value: number) => void;
}

function SortableEffectCard({
  effect,
  config,
  onRemove,
  onToggle,
  onParamChange,
}: SortableEffectCardProps) {
  const [expanded, setExpanded] = useState(true);
  const knobColor = gradientToKnobColor[config.color] || 'cyan';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: effect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-200',
        !effect.enabled && 'opacity-50',
        isDragging && 'shadow-lg z-50'
      )}
    >
      <div
        className={cn(
          'h-1 rounded-t-lg bg-gradient-to-r',
          config.color
        )}
      />
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-r text-white',
                config.color
              )}
            >
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <Switch
                      checked={effect.enabled}
                      onCheckedChange={onToggle}
                      className="scale-75"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{effect.enabled ? 'Bypass' : 'Enable'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
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
        <CardContent className="p-3 pt-2">
          <div className="flex flex-wrap justify-center gap-4 py-2">
            {config.params.map((param) => {
              // Special handling for distortion mode
              if (param.key === 'mode' && effect.type === 'distortion') {
                return (
                  <div key={param.key} className="flex flex-col items-center gap-1">
                    <Label className="text-xs text-muted-foreground">{param.label}</Label>
                    <Select
                      value={String(effect.params[param.key] || 0)}
                      onValueChange={(v) => onParamChange(param.key, parseInt(v))}
                      disabled={!effect.enabled}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISTORTION_MODES.map((mode, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            {mode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              // Special handling for tremolo waveform
              if (param.key === 'waveform' && effect.type === 'tremolo') {
                return (
                  <div key={param.key} className="flex flex-col items-center gap-1">
                    <Label className="text-xs text-muted-foreground">{param.label}</Label>
                    <Select
                      value={String(effect.params[param.key] || 0)}
                      onValueChange={(v) => onParamChange(param.key, parseInt(v))}
                      disabled={!effect.enabled}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TREMOLO_WAVEFORMS.map((waveform, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            {waveform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              return (
                <VirtualKnob
                  key={param.key}
                  value={effect.params[param.key] ?? param.min}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  label={param.label}
                  unit={param.unit}
                  color={knobColor}
                  size="sm"
                  disabled={!effect.enabled}
                  onChange={(value) => onParamChange(param.key, value)}
                />
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Main Pedalboard Props
interface PedalboardProps {
  effects: PedalboardEffect[];
  inputGain: number;
  outputGain: number;
  globalBypass: boolean;
  levels: {
    inputPeakL: number;
    inputPeakR: number;
    inputRmsL: number;
    inputRmsR: number;
    outputPeakL: number;
    outputPeakR: number;
    outputRmsL: number;
    outputRmsR: number;
  };
  onAddEffect: (type: WorkletEffectType) => void;
  onRemoveEffect: (id: string) => void;
  onReorderEffects: (newOrder: string[]) => void;
  onToggleEffect: (id: string) => void;
  onUpdateParam: (id: string, param: string, value: number) => void;
  onSetInputGain: (gain: number) => void;
  onSetOutputGain: (gain: number) => void;
  onSetGlobalBypass: (bypass: boolean) => void;
  onExportPreset: () => string;
  onImportPreset: (json: string) => void;
  className?: string;
}

export function Pedalboard({
  effects,
  inputGain,
  outputGain,
  globalBypass,
  levels,
  onAddEffect,
  onRemoveEffect,
  onReorderEffects,
  onToggleEffect,
  onUpdateParam,
  onSetInputGain,
  onSetOutputGain,
  onSetGlobalBypass,
  onExportPreset,
  onImportPreset,
  className,
}: PedalboardProps) {
  const [selectedEffectType, setSelectedEffectType] = useState<WorkletEffectType>('eq');
  const [presetName, setPresetName] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = effects.findIndex((e) => e.id === active.id);
        const newIndex = effects.findIndex((e) => e.id === over.id);
        const newOrder = arrayMove(
          effects.map((e) => e.id),
          oldIndex,
          newIndex
        );
        onReorderEffects(newOrder);
      }
    },
    [effects, onReorderEffects]
  );

  const handleExport = useCallback(() => {
    const json = onExportPreset();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presetName || 'preset'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [onExportPreset, presetName]);

  const handleImport = useCallback(() => {
    try {
      onImportPreset(importJson);
      setImportDialogOpen(false);
      setImportJson('');
    } catch (error) {
      console.error('Failed to import preset:', error);
    }
  }, [importJson, onImportPreset]);

  const handleShare = useCallback(() => {
    const json = onExportPreset();
    const encoded = btoa(encodeURIComponent(json));
    const url = `${window.location.origin}${window.location.pathname}?preset=${encoded}`;
    setShareUrl(url);
    setShareDialogOpen(true);
  }, [onExportPreset]);

  const handleCopyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleFileImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          onImportPreset(content);
          setImportDialogOpen(false);
        } catch (error) {
          console.error('Failed to import preset:', error);
        }
      };
      reader.readAsText(file);
    },
    [onImportPreset]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Global Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Guitar className="w-5 h-5 text-orange-500" />
              Pedalboard
            </CardTitle>
            <div className="flex items-center gap-4">
              {/* Global Bypass */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={globalBypass ? 'destructive' : 'secondary'}
                      size="sm"
                      onClick={() => onSetGlobalBypass(!globalBypass)}
                    >
                      {globalBypass ? (
                        <VolumeX className="w-4 h-4 mr-1" />
                      ) : (
                        <Power className="w-4 h-4 mr-1" />
                      )}
                      {globalBypass ? 'Bypassed' : 'Active'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle global bypass</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Preset Actions */}
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleExport}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export Preset</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Upload className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Import Preset</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Preset</DialogTitle>
                      <DialogDescription>
                        Paste preset JSON or upload a file
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Paste preset JSON here..."
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        className="min-h-[200px] font-mono text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <Label htmlFor="preset-file" className="cursor-pointer">
                          <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted">
                            <Upload className="w-4 h-4" />
                            Upload File
                          </div>
                          <Input
                            id="preset-file"
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleFileImport}
                          />
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleImport} disabled={!importJson.trim()}>
                        Import
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleShare}>
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share Preset</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share Preset</DialogTitle>
                      <DialogDescription>
                        Copy this URL to share your preset
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2">
                      <Input
                        value={shareUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button size="icon" onClick={handleCopyShareUrl}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setShareDialogOpen(false)}>Done</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Gain Controls and Level Meters */}
          <div className="flex items-center gap-8 justify-center py-4 bg-muted/50 rounded-lg">
            {/* Input Gain */}
            <div className="flex flex-col items-center gap-2">
              <Label className="text-xs text-muted-foreground">Input Gain</Label>
              <div className="flex items-center gap-3">
                <LevelMeter
                  peakL={levels.inputPeakL}
                  peakR={levels.inputPeakR}
                  rmsL={levels.inputRmsL}
                  rmsR={levels.inputRmsR}
                  orientation="vertical"
                  stereo={true}
                />
                <div className="h-24 flex flex-col justify-center">
                  <Slider
                    orientation="vertical"
                    value={[inputGain * 100]}
                    min={0}
                    max={200}
                    step={1}
                    onValueChange={([v]) => onSetInputGain(v / 100)}
                    className="h-20"
                  />
                </div>
              </div>
              <span className="text-xs font-mono">
                {((inputGain - 1) * 100).toFixed(0)}%
              </span>
            </div>

            {/* Signal Flow Indicator */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-px bg-gradient-to-r from-cyan-500 to-purple-500" />
              <span className="text-xs">EFFECTS</span>
              <div className="w-8 h-px bg-gradient-to-r from-purple-500 to-orange-500" />
            </div>

            {/* Output Gain */}
            <div className="flex flex-col items-center gap-2">
              <Label className="text-xs text-muted-foreground">Output Gain</Label>
              <div className="flex items-center gap-3">
                <div className="h-24 flex flex-col justify-center">
                  <Slider
                    orientation="vertical"
                    value={[outputGain * 100]}
                    min={0}
                    max={200}
                    step={1}
                    onValueChange={([v]) => onSetOutputGain(v / 100)}
                    className="h-20"
                  />
                </div>
                <LevelMeter
                  peakL={levels.outputPeakL}
                  peakR={levels.outputPeakR}
                  rmsL={levels.outputRmsL}
                  rmsR={levels.outputRmsR}
                  orientation="vertical"
                  stereo={true}
                />
              </div>
              <span className="text-xs font-mono">
                {((outputGain - 1) * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Add Effect */}
          <div className="flex gap-2">
            <Select
              value={selectedEffectType}
              onValueChange={(v) => setSelectedEffectType(v as WorkletEffectType)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EFFECT_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => onAddEffect(selectedEffectType)}
              className=""
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Effect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Effects Chain */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link className="w-4 h-4" />
            Effect Chain
            <span className="text-xs text-muted-foreground font-normal">
              ({effects.length} effects)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {effects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sliders className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No effects in chain</p>
              <p className="text-xs">Add effects above to start building your tone</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={effects.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {effects.map((effect) => (
                    <SortableEffectCard
                      key={effect.id}
                      effect={effect}
                      config={EFFECT_CONFIGS[effect.type]}
                      onRemove={() => onRemoveEffect(effect.id)}
                      onToggle={() => onToggleEffect(effect.id)}
                      onParamChange={(param, value) =>
                        onUpdateParam(effect.id, param, value)
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
