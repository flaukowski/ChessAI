<p align="center">
  <img src="https://img.shields.io/badge/SonicVision-AI%20Music%20Creation-gradient?style=for-the-badge&labelColor=0d1117&color=06b6d4" alt="SonicVision" />
</p>

<h1 align="center">
  <br>
  🎵 SonicVision
  <br>
  <sub>Powered by AudioNoise DSP</sub>
</h1>

<p align="center">
  <strong>Next-generation AI music creation platform with real-time DSP effects</strong>
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
  <img src="https://img.shields.io/license/MIT-blue?style=flat-square" alt="License" />
</p>

---

## ✨ The Vision

**SonicVision** bridges the gap between AI-powered music generation and professional audio processing. Create music with AI, then sculpt it with studio-grade DSP effects—all in your browser.

> *"What if creating professional-sounding music was as simple as describing what you want to hear?"*

We're building the future of music creation: **intuitive**, **powerful**, and **accessible to everyone**.

---

## 🚀 Features

### 🤖 AI Music Generation
- **Natural Language Prompts** — Describe your music in plain English
- **Style Selection** — Choose from indie-pop, electronic, ambient, lo-fi, and more
- **Multiple AI Models** — V5, V4, V3.5 generation engines
- **Vocal Options** — Instrumental, male vocals, female vocals
- **Advanced Controls** — Style weight, creativity sliders, negative tags

### 🎛️ AudioNoise DSP Engine
Real-time audio processing ported from C-based guitar pedal algorithms:

| Effect | Description |
|--------|-------------|
| **Echo** | Delay with feedback and LFO modulation |
| **Flanger** | Classic modulated delay sweeping |
| **Phaser** | 4-stage allpass cascade with LFO |
| **Low Pass** | Warm tone shaping filter |
| **High Pass** | Clean up muddy frequencies |
| **Band Pass** | Isolate frequency ranges |
| **Notch** | Surgical frequency removal |

### 📊 Real-Time Visualization
- **Waveform** — Time-domain audio visualization
- **Spectrum Analyzer** — Frequency distribution bars
- **Spectrogram** — Scrolling frequency/time heatmap

### 🧠 AI Effect Suggestions
- Analyzes your audio in real-time
- Recommends effects based on genre and frequency profile
- One-click effect application with optimized parameters

### 🎤 Multiple Input Sources
- **File Upload** — Process any audio file
- **Microphone** — Live real-time processing
- **AI Generated** — Process your AI creations

---

## 🏃 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/sonicvision.git
cd sonicvision

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
sonicvision/
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
- 🎸 Port more effects from AudioNoise (FM synthesis, distortion)
- 🎨 Improve visualizations (3D, reactive animations)
- 🧪 Add unit tests for DSP algorithms
- 📱 Improve mobile responsiveness
- 🌍 Add internationalization

---

## 💖 Support the Project

If SonicVision helps you create amazing music, consider supporting development:

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
- 🚀 Develop new features
- 🎵 Improve AI music quality
- 🔊 Add more DSP effects
- 📚 Create tutorials and documentation

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

The AudioNoise DSP algorithms are also MIT licensed.

---

## 🙏 Acknowledgments

- **AudioNoise** — Original C DSP algorithms for guitar pedals
- **DaisySP** — Inspiration for flanger implementation
- **Web Audio API** — Making browser audio processing possible
- **shadcn/ui** — Beautiful component primitives

---

<p align="center">
  <strong>Built with 💜 for musicians, by musicians</strong>
</p>

<p align="center">
  <sub>SonicVision — Where AI meets Audio Engineering</sub>
</p>
