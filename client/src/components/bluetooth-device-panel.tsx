import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Bluetooth,
  BluetoothConnected,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BluetoothAudioDevice, AudioChannel } from "@/lib/dsp/bluetooth-audio-manager";

interface BluetoothDevicePanelProps {
  devices: BluetoothAudioDevice[];
  inputChannels: AudioChannel[];
  outputChannels: AudioChannel[];
  isScanning: boolean;
  bandwidthWarning: string | null;
  onScanDevices: () => void;
  onCreateInputChannel: (deviceId: string, name?: string) => Promise<AudioChannel | null>;
  onCreateOutputChannel: (deviceId: string, name?: string) => Promise<AudioChannel | null>;
  onRemoveChannel: (channelId: string) => void;
  onSetChannelMute: (channelId: string, muted: boolean) => void;
  className?: string;
}

export function BluetoothDevicePanel({
  devices,
  inputChannels,
  outputChannels,
  isScanning,
  bandwidthWarning,
  onScanDevices,
  onCreateInputChannel,
  onCreateOutputChannel,
  onRemoveChannel,
  onSetChannelMute,
  className,
}: BluetoothDevicePanelProps) {
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");

  const inputDevices = devices.filter((d) => d.kind === "audioinput");
  const outputDevices = devices.filter((d) => d.kind === "audiooutput");
  const bluetoothDevices = devices.filter((d) => d.isBluetooth);

  const isDeviceInUse = (deviceId: string) => {
    return (
      inputChannels.some((c) => c.deviceId === deviceId) ||
      outputChannels.some((c) => c.deviceId === deviceId)
    );
  };

  const handleCreateChannel = async (device: BluetoothAudioDevice) => {
    setCreatingChannel(device.id);
    try {
      if (device.kind === "audioinput") {
        await onCreateInputChannel(device.id, channelName || undefined);
      } else {
        await onCreateOutputChannel(device.id, channelName || undefined);
      }
      setChannelName("");
    } finally {
      setCreatingChannel(null);
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-500" />
            Audio Devices
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
            {isScanning ? "Scanning..." : "Scan"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bandwidth Warning */}
        {bandwidthWarning && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-amber-500 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{bandwidthWarning}</span>
          </div>
        )}

        {/* Bluetooth Devices Section */}
        {bluetoothDevices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BluetoothConnected className="w-3 h-3 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Bluetooth ({bluetoothDevices.length})
              </span>
            </div>
            <div className="space-y-1">
              {bluetoothDevices.map((device) => (
                <DeviceItem
                  key={device.id}
                  device={device}
                  inUse={isDeviceInUse(device.id)}
                  isCreating={creatingChannel === device.id}
                  onAdd={() => handleCreateChannel(device)}
                />
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Input Devices */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-3 h-3 text-cyan-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Inputs ({inputDevices.length})
            </span>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-1 pr-3">
              {inputDevices.map((device) => (
                <DeviceItem
                  key={device.id}
                  device={device}
                  inUse={isDeviceInUse(device.id)}
                  isCreating={creatingChannel === device.id}
                  onAdd={() => handleCreateChannel(device)}
                />
              ))}
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
            <div className="space-y-1 pr-3">
              {outputDevices.map((device) => (
                <DeviceItem
                  key={device.id}
                  device={device}
                  inUse={isDeviceInUse(device.id)}
                  isCreating={creatingChannel === device.id}
                  onAdd={() => handleCreateChannel(device)}
                />
              ))}
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
          <ScrollArea className="h-40">
            <div className="space-y-1 pr-3">
              {inputChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  onRemove={() => onRemoveChannel(channel.id)}
                  onToggleMute={() => onSetChannelMute(channel.id, !channel.muted)}
                />
              ))}
              {outputChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  onRemove={() => onRemoveChannel(channel.id)}
                  onToggleMute={() => onSetChannelMute(channel.id, !channel.muted)}
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
  device: BluetoothAudioDevice;
  inUse: boolean;
  isCreating: boolean;
  onAdd: () => void;
}

function DeviceItem({ device, inUse, isCreating, onAdd }: DeviceItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-md transition-colors",
        inUse ? "bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {device.kind === "audioinput" ? (
          <Mic className="w-3 h-3 text-cyan-500 flex-shrink-0" />
        ) : (
          <Speaker className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        )}
        <span className="text-xs truncate">{device.label}</span>
        {device.isBluetooth && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-blue-500 border-blue-500/30">
            BT
          </Badge>
        )}
      </div>
      {inUse ? (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
          In Use
        </Badge>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onAdd}
          disabled={isCreating}
        >
          <Plus className={cn("w-3 h-3", isCreating && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}

interface ChannelItemProps {
  channel: AudioChannel;
  onRemove: () => void;
  onToggleMute: () => void;
}

function ChannelItem({ channel, onRemove, onToggleMute }: ChannelItemProps) {
  return (
    <div
      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
      style={{ borderLeft: `3px solid ${channel.color}` }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {channel.type === "input" ? (
          <Mic className="w-3 h-3 flex-shrink-0" style={{ color: channel.color }} />
        ) : (
          <Speaker className="w-3 h-3 flex-shrink-0" style={{ color: channel.color }} />
        )}
        <span className="text-xs truncate">{channel.name}</span>
        <Badge
          variant="outline"
          className="text-[10px] px-1 py-0 h-4"
          style={{ borderColor: channel.color, color: channel.color }}
        >
          {channel.type === "input" ? "IN" : "OUT"}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
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
  );
}
