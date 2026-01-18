/**
 * Audio Adapter Panel
 * Enhanced device panel with connection type detection, latency indicators,
 * and instrument preset support.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bluetooth,
  BluetoothSearching,
  Mic,
  Speaker,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Headphones,
  Usb,
  Plug,
  Monitor,
  Cpu,
  Layers,
  HelpCircle,
  Clock,
  Guitar,
  Piano,
  Music,
  Disc,
  Waves,
  Cable,
  Power,
  PowerOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdapterAudioChannel, AdapterRoutingConnection } from '@/lib/dsp/audio-adapter-manager';
import type {
  AudioAdapterDevice,
  AudioConnectionType,
  InstrumentPreset,
} from '@/lib/dsp/audio-adapter-types';
import { CONNECTION_TYPE_INFO, getLatencyColor, getLatencyLabel } from '@/lib/dsp/audio-adapter-types';

// Icon mapping for connection types
const CONNECTION_ICONS: Record<AudioConnectionType, React.ComponentType<{ className?: string }>> = {
  bluetooth: Bluetooth,
  usb: Usb,
  'audio-jack': Plug,
  hdmi: Monitor,
  'built-in': Cpu,
  virtual: Layers,
  unknown: HelpCircle,
};

// Icon mapping for instrument presets
const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Guitar: Guitar,
  Piano: Piano,
  Music: Music,
  Mic: Mic,
  Disc: Disc,
  Waves: Waves,
  Cable: Cable,
  Headphones: Headphones,
};

interface AudioAdapterPanelProps {
  devices: AudioAdapterDevice[];
  inputChannels: AdapterAudioChannel[];
  outputChannels: AdapterAudioChannel[];
  isScanning: boolean;
  bandwidthWarning: string | null;
  latencyWarning: string | null;
  presets: InstrumentPreset[];
  globalOutputMute: boolean;
  globalInputMute: boolean;
  disabledDevices: string[];
  onScanDevices: () => void;
  onCreateInputChannel: (deviceId: string, name?: string, presetId?: string) => Promise<AdapterAudioChannel | null>;
  onCreateOutputChannel: (deviceId: string, name?: string) => Promise<AdapterAudioChannel | null>;
  onRemoveChannel: (channelId: string) => void;
  onSetChannelMute: (channelId: string, muted: boolean) => void;
  onApplyPreset?: (channelId: string, presetId: string) => void;
  onSetGlobalOutputMute?: (muted: boolean) => void;
  onSetGlobalInputMute?: (muted: boolean) => void;
  onDisableDevice?: (deviceId: string) => void;
  onEnableDevice?: (deviceId: string) => void;
  className?: string;
}

export function AudioAdapterPanel({
  devices,
  inputChannels,
  outputChannels,
  isScanning,
  bandwidthWarning,
  latencyWarning,
  presets,
  globalOutputMute,
  globalInputMute,
  disabledDevices,
  onScanDevices,
  onCreateInputChannel,
  onCreateOutputChannel,
  onRemoveChannel,
  onSetChannelMute,
  onApplyPreset,
  onSetGlobalOutputMute,
  onSetGlobalInputMute,
  onDisableDevice,
  onEnableDevice,
  className,
}: AudioAdapterPanelProps) {
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Group devices by connection type
  const devicesByType = groupDevicesByConnectionType(devices);
  const inputDevices = devices.filter((d) => d.kind === 'audioinput');
  const outputDevices = devices.filter((d) => d.kind === 'audiooutput');

  const isDeviceInUse = (deviceId: string) => {
    return (
      inputChannels.some((c) => c.deviceId === deviceId) ||
      outputChannels.some((c) => c.deviceId === deviceId)
    );
  };

  const handleCreateChannel = async (device: AudioAdapterDevice) => {
    setCreatingChannel(device.id);
    try {
      if (device.kind === 'audioinput') {
        await onCreateInputChannel(device.id, undefined, selectedPresetId || undefined);
      } else {
        await onCreateOutputChannel(device.id, undefined);
      }
      setSelectedPresetId(null);
    } finally {
      setCreatingChannel(null);
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Headphones className="w-4 h-4 text-violet-500" />
            Audio Adapters
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onScanDevices}
            disabled={isScanning}
          >
            {isScanning ? (
              <BluetoothSearching className="w-4 h-4 mr-1 animate-pulse" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Global Controls for Feedback Prevention */}
        <div className="flex items-center gap-4 p-3 rounded-md bg-muted/30">
          <div className="flex items-center gap-2">
            <Speaker className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">Speakers</span>
            <Button
              variant={globalOutputMute ? "destructive" : "default"}
              size="sm"
              onClick={() => onSetGlobalOutputMute?.(!globalOutputMute)}
              className="h-7 px-2"
            >
              {globalOutputMute ? <VolumeX className="w-3 h-3 mr-1" /> : <Volume2 className="w-3 h-3 mr-1" />}
              {globalOutputMute ? "Muted" : "On"}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium">Inputs</span>
            <Button
              variant={globalInputMute ? "destructive" : "default"}
              size="sm"
              onClick={() => onSetGlobalInputMute?.(!globalInputMute)}
              className="h-7 px-2"
            >
              {globalInputMute ? <VolumeX className="w-3 h-3 mr-1" /> : <Volume2 className="w-3 h-3 mr-1" />}
              {globalInputMute ? "Muted" : "On"}
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {bandwidthWarning && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-amber-500 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{bandwidthWarning}</span>
          </div>
        )}
        {latencyWarning && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-orange-500/10 text-orange-500 text-xs">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{latencyWarning}</span>
          </div>
        )}

        {/* Devices by Connection Type */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-3 h-3 text-cyan-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Inputs ({inputDevices.length})
            </span>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-3 pr-3">
              {Array.from(devicesByType.entries()).map(([type, typeDevices]) => {
                const inputs = typeDevices.filter((d) => d.kind === 'audioinput');
                if (inputs.length === 0) return null;

                const info = CONNECTION_TYPE_INFO[type];
                const Icon = CONNECTION_ICONS[type];

                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: info.color }}>
                        <Icon className="w-3 h-3" />
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: info.color }}>
                        {info.label}
                      </span>
                    </div>
                    <div className="space-y-1 ml-5">
                      {inputs.map((device) => (
                        <DeviceItem
                          key={device.id}
                          device={device}
                          inUse={isDeviceInUse(device.id)}
                          isCreating={creatingChannel === device.id}
                          isDisabled={disabledDevices.includes(device.id)}
                          onAdd={() => handleCreateChannel(device)}
                          onDisable={onDisableDevice}
                          onEnable={onEnableDevice}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {inputDevices.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No input devices found
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Output Devices */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Speaker className="w-3 h-3 text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Outputs ({outputDevices.length})
            </span>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-3 pr-3">
              {Array.from(devicesByType.entries()).map(([type, typeDevices]) => {
                const outputs = typeDevices.filter((d) => d.kind === 'audiooutput');
                if (outputs.length === 0) return null;

                const info = CONNECTION_TYPE_INFO[type];
                const Icon = CONNECTION_ICONS[type];

                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: info.color }}>
                        <Icon className="w-3 h-3" />
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: info.color }}>
                        {info.label}
                      </span>
                    </div>
                    <div className="space-y-1 ml-5">
                      {outputs.map((device) => (
                        <DeviceItem
                          key={device.id}
                          device={device}
                          inUse={isDeviceInUse(device.id)}
                          isCreating={creatingChannel === device.id}
                          isDisabled={disabledDevices.includes(device.id)}
                          onAdd={() => handleCreateChannel(device)}
                          onDisable={onDisableDevice}
                          onEnable={onEnableDevice}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {outputDevices.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No output devices found
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Active Channels */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Headphones className="w-3 h-3 text-violet-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Active Channels ({inputChannels.length + outputChannels.length})
            </span>
          </div>
          <ScrollArea className="h-48">
            <div className="space-y-1 pr-3">
              {inputChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  presets={presets}
                  onRemove={() => onRemoveChannel(channel.id)}
                  onToggleMute={() => onSetChannelMute(channel.id, !channel.muted)}
                  onApplyPreset={onApplyPreset}
                />
              ))}
              {outputChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  presets={presets}
                  onRemove={() => onRemoveChannel(channel.id)}
                  onToggleMute={() => onSetChannelMute(channel.id, !channel.muted)}
                  onApplyPreset={onApplyPreset}
                />
              ))}
              {inputChannels.length === 0 && outputChannels.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No active channels. Add devices above to create channels.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

interface DeviceItemProps {
  device: AudioAdapterDevice;
  inUse: boolean;
  isCreating: boolean;
  onAdd: () => void;
}

function DeviceItem({ device, inUse, isCreating, onAdd, isDisabled, onDisable, onEnable }: DeviceItemProps & { 
  isDisabled?: boolean; 
  onDisable?: (deviceId: string) => void; 
  onEnable?: (deviceId: string) => void; 
}) {
  const latencyColor = getLatencyColor(device.latencyMs);
  const latencyLabel = getLatencyLabel(device.latencyMs);

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-md transition-colors',
        inUse ? 'bg-primary/5' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {device.kind === 'audioinput' ? (
          <Mic className="w-3 h-3 text-cyan-500 flex-shrink-0" />
        ) : (
          <Speaker className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        )}
        <span className="text-xs truncate" title={device.label}>
          {device.label}
        </span>
        {/* Latency indicator */}
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 h-4"
          style={{ borderColor: latencyColor, color: latencyColor }}
          title={`${device.latencyMs}ms - ${latencyLabel}`}
        >
          {device.latencyMs}ms
        </Badge>
        {/* Instrument category indicator */}
        {device.instrumentCategory && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {device.instrumentCategory}
          </Badge>
        )}
      </div>
      {inUse ? (
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            In Use
          </Badge>
          {onDisable && onEnable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => isDisabled ? onEnable(device.id) : onDisable(device.id)}
              title={isDisabled ? "Enable device" : "Disable device"}
            >
              {isDisabled ? <Power className="w-3 h-3 text-green-500" /> : <PowerOff className="w-3 h-3 text-red-500" />}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {onDisable && onEnable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => isDisabled ? onEnable(device.id) : onDisable(device.id)}
              title={isDisabled ? "Enable device" : "Disable device"}
            >
              {isDisabled ? <Power className="w-3 h-3 text-green-500" /> : <PowerOff className="w-3 h-3 text-red-500" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAdd}
            disabled={isCreating || isDisabled}
          >
            <Plus className={cn('w-3 h-3', isCreating && 'animate-spin')} />
          </Button>
        </div>
      )}
    </div>
  );
}

interface ChannelItemProps {
  channel: AdapterAudioChannel;
  presets: InstrumentPreset[];
  onRemove: () => void;
  onToggleMute: () => void;
  onApplyPreset?: (channelId: string, presetId: string) => void;
}

function ChannelItem({
  channel,
  presets,
  onRemove,
  onToggleMute,
  onApplyPreset,
}: ChannelItemProps) {
  const [showPresets, setShowPresets] = useState(false);
  const connectionInfo = CONNECTION_TYPE_INFO[channel.connectionType];
  const ConnectionIcon = CONNECTION_ICONS[channel.connectionType];
  const latencyColor = getLatencyColor(channel.latencyMs);

  return (
    <div className="space-y-1">
      <div
        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
        style={{ borderLeft: `3px solid ${channel.color}` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {channel.type === 'input' ? (
            <Mic className="w-3 h-3 flex-shrink-0" style={{ color: channel.color }} />
          ) : (
            <Speaker className="w-3 h-3 flex-shrink-0" style={{ color: channel.color }} />
          )}
          <span className="text-xs truncate">{channel.name}</span>

          {/* Connection type badge */}
          <span className="flex-shrink-0" style={{ color: connectionInfo.color }}>
            <ConnectionIcon className="w-3 h-3" />
          </span>

          {/* Latency badge */}
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 h-4"
            style={{ borderColor: latencyColor, color: latencyColor }}
          >
            {channel.latencyMs}ms
          </Badge>

          {/* Preset badge */}
          {channel.instrumentPreset && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1 py-0 h-4"
              title={channel.instrumentPreset.description}
            >
              {channel.instrumentPreset.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Preset selector for inputs */}
          {channel.type === 'input' && onApplyPreset && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowPresets(!showPresets)}
              title="Select instrument preset"
            >
              <Guitar className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleMute}
          >
            {channel.muted ? (
              <VolumeX className="w-3 h-3 text-red-500" />
            ) : (
              <Volume2 className="w-3 h-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Preset dropdown */}
      {showPresets && onApplyPreset && (
        <div className="ml-5 p-2 bg-muted/30 rounded-md space-y-1">
          {presets
            .filter((p) => p.connectionTypes.includes(channel.connectionType))
            .map((preset) => {
              const PresetIcon = PRESET_ICONS[preset.icon] || Music;
              return (
                <Button
                  key={preset.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => {
                    onApplyPreset(channel.id, preset.id);
                    setShowPresets(false);
                  }}
                >
                  <PresetIcon className="w-3 h-3 mr-2" />
                  {preset.name}
                </Button>
              );
            })}
        </div>
      )}
    </div>
  );
}

// Helper to group devices by connection type
function groupDevicesByConnectionType(
  devices: AudioAdapterDevice[]
): Map<AudioConnectionType, AudioAdapterDevice[]> {
  const grouped = new Map<AudioConnectionType, AudioAdapterDevice[]>();

  // Define order of connection types
  const typeOrder: AudioConnectionType[] = [
    'usb',
    'audio-jack',
    'bluetooth',
    'hdmi',
    'built-in',
    'virtual',
    'unknown',
  ];

  // Initialize with empty arrays in order
  for (const type of typeOrder) {
    grouped.set(type, []);
  }

  // Group devices
  for (const device of devices) {
    const existing = grouped.get(device.connectionType) || [];
    existing.push(device);
    grouped.set(device.connectionType, existing);
  }

  // Remove empty groups
  for (const [type, typeDevices] of grouped) {
    if (typeDevices.length === 0) {
      grouped.delete(type);
    }
  }

  return grouped;
}

export default AudioAdapterPanel;
