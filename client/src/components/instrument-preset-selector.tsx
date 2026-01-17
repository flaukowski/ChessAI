/**
 * Instrument Preset Selector
 * UI component for selecting and applying instrument presets to audio channels
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Guitar,
  Piano,
  Mic,
  Music,
  Disc,
  Waves,
  Cable,
  Headphones,
  Sliders,
  Zap,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  InstrumentPreset,
  InstrumentCategory,
  AudioConnectionType,
} from '@/lib/dsp/audio-adapter-types';
import { CONNECTION_TYPE_INFO } from '@/lib/dsp/audio-adapter-types';

// Icon mapping for presets
const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Guitar: Guitar,
  Piano: Piano,
  Mic: Mic,
  Music: Music,
  Disc: Disc,
  Waves: Waves,
  Cable: Cable,
  Headphones: Headphones,
};

// Category labels
const CATEGORY_LABELS: Record<InstrumentCategory, string> = {
  guitar: 'Guitars',
  bass: 'Bass',
  keyboard: 'Keyboards',
  microphone: 'Microphones',
  drums: 'Drums',
  synthesizer: 'Synthesizers',
  'line-in': 'Line In',
  other: 'Other',
};

interface InstrumentPresetSelectorProps {
  presets: InstrumentPreset[];
  selectedPresetId?: string;
  connectionType?: AudioConnectionType;
  onSelectPreset: (presetId: string) => void;
  onClose?: () => void;
  className?: string;
}

export function InstrumentPresetSelector({
  presets,
  selectedPresetId,
  connectionType,
  onSelectPreset,
  onClose,
  className,
}: InstrumentPresetSelectorProps) {
  const [filterCategory, setFilterCategory] = useState<InstrumentCategory | 'all'>('all');

  // Filter presets by connection type and category
  const filteredPresets = presets.filter((preset) => {
    const matchesConnection = !connectionType || preset.connectionTypes.includes(connectionType);
    const matchesCategory = filterCategory === 'all' || preset.category === filterCategory;
    return matchesConnection && matchesCategory;
  });

  // Group presets by category
  const presetsByCategory = groupPresetsByCategory(filteredPresets);

  // Get unique categories
  const availableCategories = Array.from(
    new Set(presets.map((p) => p.category))
  ) as InstrumentCategory[];

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-500" />
            Instrument Presets
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        {connectionType && (
          <Badge
            variant="outline"
            className="w-fit text-xs"
            style={{
              borderColor: CONNECTION_TYPE_INFO[connectionType].color,
              color: CONNECTION_TYPE_INFO[connectionType].color,
            }}
          >
            {CONNECTION_TYPE_INFO[connectionType].label} compatible
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category filter */}
        <Select
          value={filterCategory}
          onValueChange={(v) => setFilterCategory(v as InstrumentCategory | 'all')}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Presets list */}
        <ScrollArea className="h-64">
          <div className="space-y-4 pr-3">
            {Array.from(presetsByCategory.entries()).map(([category, categoryPresets]) => (
              <div key={category}>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {CATEGORY_LABELS[category]}
                </div>
                <div className="space-y-1">
                  {categoryPresets.map((preset) => (
                    <PresetItem
                      key={preset.id}
                      preset={preset}
                      isSelected={preset.id === selectedPresetId}
                      onSelect={() => onSelectPreset(preset.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {filteredPresets.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No presets available for this configuration
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface PresetItemProps {
  preset: InstrumentPreset;
  isSelected: boolean;
  onSelect: () => void;
}

function PresetItem({ preset, isSelected, onSelect }: PresetItemProps) {
  const Icon = PRESET_ICONS[preset.icon] || Music;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors',
        isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center',
            isSelected ? 'bg-primary/20' : 'bg-muted'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-medium">{preset.name}</div>
          <div className="text-[10px] text-muted-foreground">{preset.description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Impedance hint */}
        {preset.impedanceHint !== 'unknown' && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {preset.impedanceHint}
          </Badge>
        )}
        {/* Gain indicator */}
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
          {preset.recommendedGain.toFixed(1)}x
        </Badge>
        {isSelected && <Check className="w-4 h-4 text-primary" />}
      </div>
    </div>
  );
}

// Compact preset selector for inline use
interface CompactPresetSelectorProps {
  presets: InstrumentPreset[];
  selectedPresetId?: string;
  connectionType?: AudioConnectionType;
  onSelectPreset: (presetId: string) => void;
  className?: string;
}

export function CompactPresetSelector({
  presets,
  selectedPresetId,
  connectionType,
  onSelectPreset,
  className,
}: CompactPresetSelectorProps) {
  // Filter presets by connection type
  const filteredPresets = connectionType
    ? presets.filter((p) => p.connectionTypes.includes(connectionType))
    : presets;

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);
  const Icon = selectedPreset ? PRESET_ICONS[selectedPreset.icon] || Music : Sliders;

  return (
    <Select value={selectedPresetId || ''} onValueChange={onSelectPreset}>
      <SelectTrigger className={cn('h-8 text-xs', className)}>
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3" />
          <SelectValue placeholder="Select preset" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {filteredPresets.map((preset) => {
          const PresetIcon = PRESET_ICONS[preset.icon] || Music;
          return (
            <SelectItem key={preset.id} value={preset.id}>
              <div className="flex items-center gap-2">
                <PresetIcon className="w-3 h-3" />
                <span>{preset.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">
                  {preset.recommendedGain.toFixed(1)}x
                </Badge>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Preset quick picker (icon grid)
interface PresetQuickPickerProps {
  presets: InstrumentPreset[];
  selectedPresetId?: string;
  connectionType?: AudioConnectionType;
  onSelectPreset: (presetId: string) => void;
  className?: string;
}

export function PresetQuickPicker({
  presets,
  selectedPresetId,
  connectionType,
  onSelectPreset,
  className,
}: PresetQuickPickerProps) {
  // Filter presets by connection type
  const filteredPresets = connectionType
    ? presets.filter((p) => p.connectionTypes.includes(connectionType))
    : presets;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {filteredPresets.slice(0, 6).map((preset) => {
        const Icon = PRESET_ICONS[preset.icon] || Music;
        const isSelected = preset.id === selectedPresetId;

        return (
          <Button
            key={preset.id}
            variant={isSelected ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onSelectPreset(preset.id)}
            title={preset.name}
          >
            <Icon className="w-4 h-4" />
          </Button>
        );
      })}
    </div>
  );
}

// Preset info display
interface PresetInfoProps {
  preset: InstrumentPreset;
  className?: string;
}

export function PresetInfo({ preset, className }: PresetInfoProps) {
  const Icon = PRESET_ICONS[preset.icon] || Music;

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-md bg-muted/30', className)}>
      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{preset.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {CATEGORY_LABELS[preset.category]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-[10px]">
            Gain: {preset.recommendedGain.toFixed(1)}x
          </Badge>
          {preset.impedanceHint !== 'unknown' && (
            <Badge variant="secondary" className="text-[10px]">
              {preset.impedanceHint.toUpperCase()}
            </Badge>
          )}
          {preset.suggestedEffects && preset.suggestedEffects.length > 0 && (
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-muted-foreground">
                {preset.suggestedEffects.join(', ')}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {preset.connectionTypes.map((type) => (
            <Badge
              key={type}
              variant="outline"
              className="text-[10px] px-1 py-0 h-4"
              style={{
                borderColor: CONNECTION_TYPE_INFO[type].color,
                color: CONNECTION_TYPE_INFO[type].color,
              }}
            >
              {CONNECTION_TYPE_INFO[type].label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper to group presets by category
function groupPresetsByCategory(
  presets: InstrumentPreset[]
): Map<InstrumentCategory, InstrumentPreset[]> {
  const grouped = new Map<InstrumentCategory, InstrumentPreset[]>();

  for (const preset of presets) {
    const existing = grouped.get(preset.category) || [];
    existing.push(preset);
    grouped.set(preset.category, existing);
  }

  return grouped;
}

export default InstrumentPresetSelector;
