# Overview

AudioNoise Web is a full-stack web application for real-time audio Digital Signal Processing (DSP) effects in the browser. The application ports professional-grade audio algorithms from the AudioNoise C library (guitar pedals) to TypeScript and Web Audio API. Users can load audio files or connect a microphone, apply DSP effects (echo, flanger, phaser, biquad filters), visualize audio in real-time, and manage Bluetooth audio devices for multi-channel routing.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

- **January 2026**: Added BassPurr bass harmonics generator effect
  - Ported from firmware C implementation
  - Three signal paths: fundamental (HPF), even harmonics (rectification), odd harmonics (clipping)
  - 5-step tone control for harmonic filter cutoff
  - Soft limiter output stage

- **January 2026**: Refactored from SonicVision (AI music/image generation) to AudioNoise Web (DSP effects focus)
  - Removed Suno AI music generation and OpenAI image generation
  - Rebuilt Studio page with DSP effects rack, audio visualization, and Bluetooth routing
  - Simplified schema to users + userAISettings
  - Updated branding throughout

# System Architecture

## Frontend Architecture

**Technology Stack**: React 18 with TypeScript, Vite for bundling, and Wouter for client-side routing.

**UI Framework**: shadcn/ui component library built on Radix UI primitives with Tailwind CSS for styling. Dark-themed color palette with cyan/purple gradient accents.

**State Management**: TanStack Query (React Query) for server state management. Local state via React hooks for audio DSP and Bluetooth management.

**Key Components**:
- `AudioInput`: File upload and microphone input with volume control
- `AudioVisualizer`: Real-time waveform, spectrum, and spectrogram visualization using HTML5 Canvas
- `EffectsRack`: DSP effects chain with echo, flanger, phaser, and biquad filters (lowpass, highpass, bandpass, notch)
- `BluetoothDevicePanel`: Bluetooth audio device discovery and channel management
- `AudioRoutingMatrix`: Input-to-output routing configuration with gain control
- `MobileNav`/`MobileHeader`: Mobile-responsive navigation components

**Key Hooks**:
- `useAudioDSP`: Manages audio engine, effects chain, and file/microphone input
- `useBluetoothAudio`: Manages Bluetooth device discovery, channels, and routing
- `useSpaceChildAuth`: Authentication state management
- `useIsMobile`: Responsive breakpoint detection

**Routing**: Single-page application with `/` (landing) and `/studio` (main DSP workspace) routes.

## Backend Architecture

**Framework**: Express.js server with TypeScript, running on Node.js.

**API Design**: Minimal RESTful API under `/api` namespace:
- `GET /health` - Health check endpoint
- `GET /metrics` - Application metrics
- `GET /ready` - Database readiness check
- `/api/space-child-auth/*` - Authentication routes

**Authentication**: Space Child Auth integration for user login/registration with password hashing (bcryptjs).

## Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect, using Neon serverless database driver.

**Schema Design** (`shared/schema.ts`):
- `users` table: User authentication (id, username, email, firstName, lastName, password)
- `userAISettings` table: Optional LLM integration settings per user
  - Supports providers: none, openai, anthropic, ollama, custom
  - Stores API keys, base URLs, model preferences

**Validation**: Zod schemas auto-generated from Drizzle schemas using `drizzle-zod`.

## DSP Library (`client/src/lib/dsp/`)

**Audio Engine** (`audio-engine.ts`):
- Web Audio API context management
- Source node connection (file/microphone)
- Effects chain management
- Analyser node for visualization

**Effects** (`effects/`):
- `echo.ts`: Delay-based echo with feedback
- `flanger.ts`: LFO-modulated delay for flanging effect
- `phaser.ts`: Multi-stage all-pass filter phaser

**AudioWorklet Effects** (`worklet-effects.ts`, `public/worklets/effect-processor.js`):
- EQ: 3-band parametric equalizer (low shelf, mid peak, high shelf)
- Distortion: Soft clip, hard clip, and tube saturation modes
- Delay: Tempo-synced delay with feedback and damping
- Chorus: Multi-voice modulated delay chorus
- Compressor: RMS-based dynamics compressor
- BassPurr: Bass harmonics generator with fundamental/even/odd paths

**Filters** (`biquad.ts`):
- Biquad filter implementation (lowpass, highpass, bandpass, notch, allpass)
- Frequency and Q parameter control

**Modulation** (`lfo.ts`):
- Low-frequency oscillator for effect modulation
- Sine, triangle, square waveforms

**Bluetooth Audio** (`bluetooth-audio-manager.ts`):
- Multi-device discovery
- Input/output channel creation
- Routing matrix with gain control
- Level metering

## External Dependencies

**Neon Database**:
- Serverless PostgreSQL hosting
- WebSocket-based connection using `@neondatabase/serverless` driver
- Configured via `DATABASE_URL` environment variable

**Development Tools**:
- Replit-specific plugins for runtime error overlay and dev banner
- Vite HMR for hot module replacement

## Application Build and Deployment

**Build Process**:
- Frontend: Vite builds React app to `dist/public`
- Backend: esbuild bundles Express server to `dist/index.js` as ESM module
- Development: tsx for TypeScript execution without compilation

**Environment Variables Required**:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `OPENAI_API_KEY` - Optional, for AI effect suggestions
- `NODE_ENV` - Environment mode (development/production)

**Static Asset Serving**: In production, Express serves built frontend from `dist/public`. In development, Vite dev server handles assets via middleware mode with HMR.
