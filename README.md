<p align="center">
  <img src="https://img.shields.io/badge/AudioNoise%20Web-Real--Time%20DSP-gradient?style=for-the-badge&labelColor=0d1117&color=06b6d4" alt="AudioNoise Web" />
</p>

<h1 align="center">
  <br>
  🎛️ AudioNoise Web
  <br>
  <sub>Real-time audio DSP in your browser</sub>
</h1>

<p align="center">
  <strong>Professional-grade audio effects ported from torvalds/AudioNoise C algorithms</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#dsp-engine">DSP Engine</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#support">Support</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Web%20Audio%20API-FF6B6B?style=flat-square&logo=webaudio&logoColor=white" alt="Web Audio API" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-GPL%20v2-blue?style=flat-square" alt="License" />
</p>

---

## ✨ The Vision

**AudioNoise Web** brings professional guitar pedal DSP effects to your browser. Process audio in real-time with sub-millisecond latency using algorithms ported from Linus Torvalds' [AudioNoise](https://github.com/torvalds/AudioNoise) C library.

> *"The main design goal has been to learn about digital audio processing basics. Just IIR filters and basic delay loops. Everything is single sample in, single sample out with no latency."* — Linus Torvalds

---

## 🚀 Features

### 🎛️ AudioNoise DSP Engine
Real-time audio processing ported from C-based guitar pedal algorithms:

| Effect | Description |
|--------|-------------|
| **Echo** | Delay with feedback and LFO modulation |
| **Flanger** | Classic modulated delay sweeping |
| **Phaser** | 4-stage allpass cascade with LFO |
| **Low Pass** | Warm tone shaping biquad filter |
| **High Pass** | Clean up muddy frequencies |
| **Band Pass** | Isolate frequency ranges |
| **Notch** | Surgical frequency removal |
| **All Pass** | Phase shifting without amplitude change |

### 📊 Real-Time Visualization
- **Waveform** — Time-domain audio visualization
- **Spectrum Analyzer** — Frequency distribution bars
- **Spectrogram** — Scrolling frequency/time heatmap

### 🎤 Multiple Input Sources
- **File Upload** — Process any audio file (MP3, WAV, OGG)
- **Microphone** — Live real-time processing
- **Bluetooth** — Multi-channel instrument routing

### 🤖 Optional AI Effect Suggestions
- Bring your own API key (OpenAI, Anthropic, Ollama, or custom)
- Analyzes your audio in real-time
- Recommends effects based on frequency profile
- One-click effect application with optimized parameters

---

## 🏃 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/audionoise-web.git
cd audionoise-web

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5000` in your browser.

---

## 🔧 DSP Engine

The **AudioNoise DSP Engine** is a complete audio processing toolkit ported from C to TypeScript/Web Audio API.

### Architecture

```
client/src/lib/dsp/
├── audio-engine.ts      # Web Audio context management
├── lfo.ts               # Low Frequency Oscillator
├── biquad.ts            # IIR filter implementations
├── delay-line.ts        # Circular buffer with interpolation
├── effects/
│   ├── echo.ts          # Delay-based echo
│   ├── flanger.ts       # Modulated delay flanger
│   └── phaser.ts        # Allpass cascade phaser
└── index.ts             # Module exports
```

### Design Philosophy

Inspired by the original AudioNoise C library:

- **Zero Latency** — Single sample in, single sample out
- **IIR Filters** — Efficient recursive filtering
- **Real-Time Safe** — No allocations in audio path
- **Analog Emulation** — Digital recreation of classic circuits

### Usage

```typescript
import { audioEngine, createEchoNode, createPhaserNode } from '@/lib/dsp';

// Initialize engine
await audioEngine.initialize();

// Connect audio source
await audioEngine.connectMicrophone();

// Add effects
const echo = createEchoNode(audioEngine.audioContext, 300, 0.5, 0.5);
audioEngine.addEffect(echo.input);

// Get visualization data
const freqData = audioEngine.getFrequencyData();
```

---

## 🏗️ Architecture

```
audionoise-web/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── effects-rack.tsx
│   │   │   ├── audio-visualizer.tsx
│   │   │   ├── ai-effect-suggester.tsx
│   │   │   └── audio-input.tsx
│   │   ├── hooks/          # React hooks
│   │   │   └── use-audio-dsp.ts
│   │   ├── lib/
│   │   │   └── dsp/        # AudioNoise DSP library
│   │   └── pages/
│   │       └── studio.tsx  # Main application
│   └── index.html
├── server/                 # Express backend
├── reference/              # Original C algorithms
│   └── audionoise-c/
└── shared/                 # Shared types
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui, Radix Primitives |
| **Audio** | Web Audio API, AudioWorklet |
| **State** | React Query, Zustand |
| **Backend** | Express, Node.js |
| **Build** | Vite, ESBuild |

---

## 🤝 Contributing

We love contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

**Quick contribution ideas:**
- 🎸 Port more effects from AudioNoise (FM synthesis, AM synthesis, distortion)
- 📊 Add FFT frequency-domain analysis (see [issue #37](https://github.com/torvalds/AudioNoise/issues/37))
- 🎛️ Add granular synthesis controls (see [issue #40](https://github.com/torvalds/AudioNoise/issues/40))
- 🧪 Add unit tests for DSP algorithms
- 📱 Improve mobile responsiveness

---

## 💖 Support the Project

If AudioNoise Web helps you process audio, consider supporting development:

### Ethereum / EVM Chains
```
REDACTED_WALLET_ADDRESS
```

<p align="center">
  <a href="https://etherscan.io/address/REDACTED_WALLET_ADDRESS">
    <img src="https://img.shields.io/badge/Donate-ETH-627EEA?style=for-the-badge&logo=ethereum&logoColor=white" alt="Donate ETH" />
  </a>
</p>

Your support helps us:
- 🚀 Port more effects from AudioNoise
- 🔊 Add FFT visualization and analysis
- 📱 Improve mobile experience
- 📚 Create tutorials and documentation

---

## 📜 License

This project is licensed under the **GNU General Public License v2** — see the [LICENSE](LICENSE) file for details.

This is free and open source software. You are free to use, modify, and distribute this software under the terms of the GPL v2.

---

## 🙏 Acknowledgments

- **AudioNoise** — Original C DSP algorithms for guitar pedals
- **DaisySP** — Inspiration for flanger implementation
- **Web Audio API** — Making browser audio processing possible
- **shadcn/ui** — Beautiful component primitives

---

<p align="center">
  <strong>Built with 💜 for audio enthusiasts</strong>
</p>

<p align="center">
  <sub>AudioNoise Web — Real-time DSP in your browser</sub>
</p>
