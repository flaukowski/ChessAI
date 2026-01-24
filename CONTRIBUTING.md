# Contributing to AudioNoise Web

First off, thank you for considering contributing to AudioNoise Web!

This project is a professional-grade browser-based audio effects platform with real-time DSP processing, team collaboration, subscriptions, and social features. We're excited to have you join us in pushing the boundaries of what's possible in browser-based audio.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [DSP Development Guidelines](#dsp-development-guidelines)
- [Backend Development](#backend-development)
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
- **PostgreSQL** 14+
- Basic understanding of:
  - TypeScript
  - React
  - Web Audio API (for DSP contributions)
  - Express.js (for backend contributions)
  - Drizzle ORM (for database contributions)

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/audionoise-web.git
cd audionoise-web

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and other settings

# Push database schema
npm run db:push

# Start the development server
npm run dev

# Run tests
npm test
```

The app will be available at `http://localhost:5000`.

---

## Project Structure

```
audionoise-web/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/             # shadcn/ui primitives
│   │   │   ├── pedalboard.tsx  # Effect chain UI
│   │   │   ├── audio-visualizer.tsx
│   │   │   ├── error-boundary.tsx
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
│   │   │   │   ├── effect-registry.ts
│   │   │   │   └── effects/
│   │   │   └── utils.ts
│   │   └── pages/              # Page components
│   └── public/
│       └── worklets/           # AudioWorklet processors
├── server/                     # Express backend
│   ├── auth.ts                 # Authentication (ZKP)
│   ├── stripe.ts               # Billing & subscriptions
│   ├── workspaces.ts           # Team workspaces
│   ├── social.ts               # Social features
│   ├── analytics.ts            # Event tracking
│   ├── gdpr.ts                 # GDPR compliance
│   ├── encryption.ts           # AES-256-GCM utilities
│   └── middleware/
│       └── tier-gating.ts      # Subscription feature limits
├── shared/                     # Shared code
│   ├── schema.ts               # Database schema (Drizzle)
│   └── tiers.ts                # Subscription tier definitions
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
- Internationalization (i18n)

#### Intermediate Contributions

- New visualization modes
- UI/UX improvements
- Performance optimizations
- Mobile responsiveness
- Social feature enhancements
- Workspace UI improvements

#### Advanced Contributions

- New DSP effects (see guidelines below)
- AudioWorklet implementations
- AI integration improvements
- Architecture improvements
- Billing/Stripe integration
- Analytics and reporting
- Security hardening

---

## DSP Development Guidelines

The AudioNoise DSP library is the heart of AudioNoise Web's audio processing. Contributing to it requires special care.

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

## Backend Development

### Server Architecture

The backend uses Express.js with TypeScript and follows a modular architecture:

- **Route handlers** — Separate files for each domain (auth, billing, workspaces, social)
- **Middleware** — Authentication, tier gating, rate limiting
- **Storage** — Drizzle ORM with PostgreSQL
- **Encryption** — AES-256-GCM for sensitive data

### Adding New API Endpoints

1. **Define schema** — Add tables to `shared/schema.ts`
2. **Create route handler** — Add new file in `server/` (e.g., `server/my-feature.ts`)
3. **Register routes** — Add to `server/routes.ts`
4. **Add middleware** — Use `requireAuth` for protected routes

```typescript
// Example route handler structure
import { Router } from 'express';
import { requireAuth } from './auth';
import { db } from './db';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  // ... implementation
  res.json({ data });
});

export default router;
```

### Database Migrations

We use Drizzle ORM for database management:

```bash
# Push schema changes to database
npm run db:push

# Generate migration (if using migrations)
npm run db:generate
```

### Stripe Integration

For billing contributions, familiarize yourself with:

- `server/stripe.ts` — Checkout, webhooks, billing portal
- `shared/tiers.ts` — Subscription tier limits
- `server/middleware/tier-gating.ts` — Feature enforcement

### Testing Backend Code

```typescript
// server/__tests__/my-feature.test.ts
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should handle valid request', async () => {
    // ... test implementation
  });
});
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

- Open a [Discussion](https://github.com/yourusername/audionoise-web/discussions)
- Check existing issues and PRs
- Reach out to maintainers

---

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v2.

---

<p align="center">
  <strong>Thank you for helping make AudioNoise Web better!</strong>
</p>
