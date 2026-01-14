# Multi-Channel Bluetooth Audio System

## Overview

SonicVision now supports **multi-channel Bluetooth audio connectivity**, allowing multiple instruments to connect simultaneously with intelligent routing to different speakers/outputs.

## Architecture

### Innovative Approach: Priority-Based Bandwidth Scheduling

Bluetooth has inherent bandwidth limitations (~3Mbps for A2DP). When multiple devices connect, audio quality can degrade. Our solution:

1. **Virtual Audio Channels** - Each instrument gets an isolated processing chain
2. **Routing Matrix** - Any input can route to any output with independent mixing
3. **Priority Scheduling** - Prevents Bluetooth bandwidth saturation
4. **Bandwidth Monitoring** - Real-time warnings when approaching limits

### Components

```
client/src/lib/dsp/
├── bluetooth-audio-manager.ts   # Core device/channel management
└── index.ts                     # Exports

client/src/hooks/
└── use-bluetooth-audio.ts       # React hook for state management

client/src/components/
├── bluetooth-device-panel.tsx   # Device discovery & channel creation
└── audio-routing-matrix.tsx     # Visual routing matrix UI
```

## Features

### Device Discovery
- Automatic detection of all audio input/output devices
- Bluetooth device identification (keywords: bluetooth, bt, wireless, airpods, bose, etc.)
- Real-time device change monitoring

### Multi-Channel Input
- Connect multiple Bluetooth instruments simultaneously
- Each input gets:
  - Isolated gain control (0-200%)
  - Stereo panning (-100% L to +100% R)
  - Mute/Solo controls
  - Real-time level metering
  - Per-channel color coding

### Multi-Output Routing
- Route to multiple speakers/outputs
- Per-output volume control
- Independent routing gain per connection
- Visual routing matrix with click-to-connect

### Bandwidth Management
- Maximum 3 concurrent Bluetooth streams (configurable)
- Real-time bandwidth monitoring
- Warning notifications when approaching limits
- Latency estimation per device (BT ~40ms vs wired ~10ms)

## Usage

### Studio Page Integration

Navigate to **Multi-Channel** tab in the Studio:

1. **Scan Devices** - Click "Scan" to discover available devices
2. **Create Input Channel** - Click (+) on an input device to create a channel
3. **Create Output Channel** - Click (+) on an output device to create a channel
4. **Route Audio** - Click cells in the routing matrix to connect inputs to outputs
5. **Adjust Levels** - Use sliders to control volume and pan

### Programmatic Usage

```typescript
import { useBluetoothAudio } from '@/hooks/use-bluetooth-audio';

function MyComponent() {
  const {
    devices,
    inputChannels,
    outputChannels,
    scanDevices,
    createInputChannel,
    createOutputChannel,
    setRouting,
    setChannelVolume,
    setChannelPan,
  } = useBluetoothAudio();

  // Scan for devices
  await scanDevices();

  // Create channels
  const inputChannel = await createInputChannel(deviceId, 'Guitar');
  const outputChannel = await createOutputChannel(speakerId, 'Main Speakers');

  // Route input to output
  setRouting(inputChannel.id, outputChannel.id, 1.0, true);

  // Adjust volume and pan
  setChannelVolume(inputChannel.id, 0.8);  // 80%
  setChannelPan(inputChannel.id, -0.5);     // 50% left
}
```

## API Reference

### BluetoothAudioManager

| Method | Description |
|--------|-------------|
| `initialize(context?)` | Initialize with optional existing AudioContext |
| `discoverDevices()` | Scan for all audio devices |
| `createInputChannel(deviceId, name?)` | Create input from device |
| `createOutputChannel(deviceId, name?)` | Create output to device |
| `setRouting(inputId, outputId, gain?, enabled?)` | Configure routing |
| `setChannelVolume(channelId, volume)` | Set channel volume (0-2) |
| `setChannelPan(channelId, pan)` | Set pan (-1 to 1) |
| `setChannelMute(channelId, muted)` | Mute/unmute channel |
| `setChannelSolo(channelId, solo)` | Solo channel |
| `getChannelLevels(channelId)` | Get peak/RMS levels |
| `removeChannel(channelId)` | Remove and cleanup channel |

### Events

```typescript
bluetoothAudioManager.on((event) => {
  switch (event.type) {
    case 'device-discovered':
    case 'device-connected':
    case 'device-disconnected':
    case 'device-error':
    case 'channel-created':
    case 'channel-removed':
    case 'routing-changed':
    case 'bandwidth-warning':
      // Handle event
  }
});
```

## Browser Requirements

- **Chrome 110+** - Full support including `setSinkId()` for output selection
- **Firefox** - Partial support (no output device selection)
- **Safari** - Limited Bluetooth support
- **HTTPS required** - MediaDevices API requires secure context

## Limitations

1. **Bluetooth bandwidth** - Max ~3 concurrent high-quality streams
2. **Latency** - Bluetooth adds ~40ms latency vs wired
3. **Output selection** - `setSinkId()` not supported in all browsers
4. **iOS** - Limited Bluetooth audio device enumeration

## Future Enhancements

- [ ] MIDI over Bluetooth (BLE-MIDI)
- [ ] Automatic latency compensation
- [ ] Preset routing configurations
- [ ] Audio interface detection (Focusrite, etc.)
- [ ] Multi-room audio sync
