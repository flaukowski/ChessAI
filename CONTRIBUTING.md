# Contributing to SonicVision

First off, thank you for considering contributing to SonicVision! 🎵

This project combines AI music generation with real-time DSP processing, and we're excited to have you join us in pushing the boundaries of what's possible in browser-based audio.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [DSP Development Guidelines](#dsp-development-guidelines)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)

---

## Code of Conduct

This project follows a simple code of conduct:

- **Be respectful** — Treat everyone with respect and kindness
- **Be constructive** — Provide helpful feedback and suggestions
- **Be inclusive** — Welcome newcomers and help them get started
- **Be patient** — Remember that everyone is learning

---

## Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **pnpm**
- Basic understanding of:
  - TypeScript
  - React
  - Web Audio API (for DSP contributions)

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/sonicvision.git
cd sonicvision

# Install dependencies
npm install

# Start the development server
npm run dev

# Run tests (when available)
npm test
```

The app will be available at `http://localhost:5000`.

---

## Project Structure

```
sonicvision/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/             # shadcn/ui primitives
│   │   │   ├── effects-rack.tsx
│   │   │   ├── audio-visualizer.tsx
│   │   │   └── ...
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── use-audio-dsp.ts
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── dsp/            # AudioNoise DSP library
│   │   │   │   ├── audio-engine.ts
│   │   │   │   ├── lfo.ts
│   │   │   │   ├── biquad.ts
│   │   │   │   ├── delay-line.ts
│   │   │   │   └── effects/
│   │   │   └── utils.ts
│   │   └── pages/              # Page components
│   └── index.html
├── server/                     # Express backend
├── shared/                     # Shared types and schemas
└── reference/                  # Original AudioNoise C code
    └── audionoise-c/
```

---

## How to Contribute

### 🐛 Bug Reports

Found a bug? Please open an issue with:

1. **Clear title** describing the bug
2. **Steps to reproduce** the issue
3. **Expected behavior** vs **actual behavior**
4. **Browser and OS** information
5. **Console errors** if any

### 💡 Feature Requests

Have an idea? Open an issue with:

1. **Clear description** of the feature
2. **Use case** — Why is this useful?
3. **Possible implementation** (optional)

### 🔧 Code Contributions

#### Good First Issues

Look for issues labeled `good first issue` — these are great starting points:

- Documentation improvements
- UI polish and accessibility
- Simple bug fixes
- Test coverage

#### Intermediate Contributions

- New visualization modes
- UI/UX improvements
- Performance optimizations
- Mobile responsiveness

#### Advanced Contributions

- New DSP effects (see guidelines below)
- AudioWorklet implementations
- AI integration improvements
- Architecture improvements

---

## DSP Development Guidelines

The AudioNoise DSP library is the heart of SonicVision's audio processing. Contributing to it requires special care.

### Porting Effects from C

We have reference C code in `/reference/audionoise-c/`. When porting:

1. **Understand the algorithm** — Read the C code thoroughly
2. **Preserve the math** — Keep the same coefficients and calculations
3. **Test with known inputs** — Verify output matches original
4. **Document differences** — Note any Web Audio API adaptations

### DSP Code Standards

```typescript
// ✅ Good: Clear, documented DSP code
/**
 * Applies biquad filter to a single sample
 * Uses Direct Form II Transposed for numerical stability
 */
export function processSample(input: number, state: BiquadState): number {
  const output = state.b0 * input + state.z1;
  state.z1 = state.b1 * input - state.a1 * output + state.z2;
  state.z2 = state.b2 * input - state.a2 * output;
  return output;
}

// ❌ Bad: Unclear, undocumented
export function proc(x: number, s: any): number {
  const y = s.b0 * x + s.z1;
  s.z1 = s.b1 * x - s.a1 * y + s.z2;
  s.z2 = s.b2 * x - s.a2 * y;
  return y;
}
```

### Web Audio API Best Practices

1. **Avoid allocations in audio callbacks** — Pre-allocate buffers
2. **Use AudioWorklet for custom processing** — Not ScriptProcessorNode
3. **Handle context state** — Suspended, running, closed
4. **Clean up resources** — Disconnect nodes when done

### Testing DSP Code

```typescript
// Test with known signal
const testSignal = new Float32Array(1024);
for (let i = 0; i < testSignal.length; i++) {
  testSignal[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
}

// Verify filter response
const filtered = applyFilter(testSignal, lowpassFilter);
// Check magnitude at specific frequencies
```

---

## Pull Request Process

### Before Submitting

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, atomic commits:
   ```bash
   git commit -m "feat: add reverb effect to DSP library"
   git commit -m "test: add unit tests for reverb"
   git commit -m "docs: document reverb parameters"
   ```

3. **Test your changes** thoroughly

4. **Update documentation** if needed

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Code style (formatting, etc.)
- `refactor` — Code refactoring
- `perf` — Performance improvement
- `test` — Tests
- `chore` — Maintenance

Examples:
```
feat(dsp): add reverb effect with adjustable room size
fix(visualizer): prevent canvas flickering on resize
docs(readme): add DSP architecture diagram
```

### Submitting

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request with:
   - Clear title and description
   - Reference any related issues
   - Screenshots/videos for UI changes
   - Before/after for DSP changes

3. Request review from maintainers

4. Address feedback and iterate

---

## Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Document public APIs with JSDoc

### React

- Functional components with hooks
- Use `useCallback` and `useMemo` appropriately
- Keep components focused and composable
- Follow shadcn/ui patterns for UI components

### CSS

- Use Tailwind CSS utilities
- Follow the existing color scheme (cyan/purple gradient)
- Ensure dark mode compatibility
- Mobile-first responsive design

### File Naming

- Components: `PascalCase.tsx` (e.g., `EffectsRack.tsx`)
- Hooks: `use-kebab-case.ts` (e.g., `use-audio-dsp.ts`)
- Utils: `kebab-case.ts` (e.g., `delay-line.ts`)
- Types: `kebab-case.ts` or co-located

---

## Recognition

Contributors are recognized in:

- README acknowledgments section
- Release notes for significant contributions
- GitHub contributors page

---

## Questions?

- Open a [Discussion](https://github.com/yourusername/sonicvision/discussions)
- Check existing issues and PRs
- Reach out to maintainers

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

<p align="center">
  <strong>Thank you for helping make SonicVision better! 🎵</strong>
</p>
