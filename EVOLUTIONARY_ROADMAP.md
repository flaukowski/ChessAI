# AudioNoise Web - Evolutionary Roadmap

**Generated:** January 17, 2026
**Application:** AudioNoise Web - Professional-grade Real-time Audio DSP Application

---

## Executive Summary

AudioNoise Web is a sophisticated browser-based audio effects workstation that ports professional DSP algorithms to the web platform. This roadmap outlines a strategic evolution path across five key dimensions:

1. **Feature Expansion** - New audio effects, integrations, and AI capabilities
2. **Security Hardening** - Critical vulnerabilities and defense-in-depth
3. **Performance Optimization** - Audio latency, frontend efficiency, and scalability
4. **Extensibility** - Plugin architecture, API design, and maintainability
5. **Infrastructure** - Testing, CI/CD, deployment, and documentation

---

## Current State Assessment

| Dimension | Score | Status |
|-----------|-------|--------|
| Feature Completeness | 7/10 | Good foundation, missing reverb/key effects |
| Security Posture | 6/10 | Strong ZKP auth, critical gaps in token storage |
| Performance | 7/10 | AudioWorklet excellent, memory leaks present |
| Extensibility | 5/10 | Hardcoded effects, no plugin system |
| Infrastructure | 4/10 | No tests, no CI/CD, minimal docs |

---

## Phase 1: Critical Foundations (Weeks 1-2)

### 1.1 Security - CRITICAL FIXES

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Remove hardcoded default user (`info@spacechild.love` with password 'password') | CRITICAL | Low | Prevents unauthorized access |
| Migrate tokens from localStorage to HttpOnly cookies | CRITICAL | Medium | Prevents XSS token theft |
| Encrypt API keys in database (userAISettings.apiKey) | CRITICAL | Medium | Protects user credentials |
| Implement CSRF protection with tokens | HIGH | Medium | Prevents cross-site attacks |
| Add security headers (CSP, HSTS, X-Frame-Options) via Helmet | HIGH | Low | Defense in depth |
| Configure explicit CORS policy | HIGH | Low | Prevents unauthorized access |
| Add request size limits (express.json limit) | HIGH | Low | Prevents DoS attacks |

**Implementation:**
```typescript
// Add to server/index.ts
import helmet from 'helmet';
import csrf from 'csurf';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

app.use(express.json({ limit: '1mb' }));
app.use(csrf({ cookie: false }));
```

### 1.2 Infrastructure - Testing Setup

| Task | Priority | Effort |
|------|----------|--------|
| Install Vitest and configure for TypeScript | CRITICAL | Low |
| Create audio context mocks for testing | CRITICAL | Medium |
| Write unit tests for DSP algorithms (biquad, echo, flanger) | CRITICAL | Medium |
| Write unit tests for preset serialization | HIGH | Low |
| Add coverage reporting | MEDIUM | Low |

**Test Structure:**
```
client/src/__tests__/
├── setup.ts
├── dsp/
│   ├── biquad.test.ts
│   ├── echo.test.ts
│   ├── flanger.test.ts
│   └── pedalboard-engine.test.ts
├── lib/
│   └── preset-manager.test.ts
└── mocks/
    └── audio-context.mock.ts
```

### 1.3 Configuration Management

| Task | Priority | Effort |
|------|----------|--------|
| Create centralized config module | HIGH | Medium |
| Extract magic numbers to configuration | HIGH | Low |
| Add Zod validation for environment variables | MEDIUM | Low |
| Create `.env.example` with documented variables | MEDIUM | Low |

**Configuration to Extract:**
- Sample rate (currently hardcoded: 48000)
- Token expiry times (15 min access, 7 day refresh)
- Rate limiting thresholds (10 req/min)
- Worklet paths (/worklets/effect-processor.js)
- Polling intervals (2000ms)

---

## Phase 2: Security Hardening (Weeks 3-4)

### 2.1 Session & Token Management

| Task | Priority | Impact |
|------|----------|--------|
| Set SameSite=Strict on session cookies | HIGH | Prevents CSRF |
| Replace in-memory token store with Redis/DB | HIGH | Enables horizontal scaling |
| Invalidate all sessions on password reset | MEDIUM | Security hygiene |
| Add absolute session timeout (24h) | MEDIUM | Limits exposure window |
| Implement token rotation on refresh | MEDIUM | Reduces token reuse risk |

### 2.2 Input Validation & Database Security

| Task | Priority | Impact |
|------|----------|--------|
| Add server-side email validation | HIGH | Prevents bad data |
| Extend Zod schemas for all user input | MEDIUM | Type-safe validation |
| Sanitize firstName/lastName on storage | MEDIUM | Prevents XSS |
| Hash IP addresses in login_attempts | MEDIUM | GDPR/privacy compliance |
| Implement audit logging table | MEDIUM | Security monitoring |

### 2.3 Rate Limiting Enhancement

| Task | Priority | Impact |
|------|----------|--------|
| Add per-email rate limits (5 failed/24h) | HIGH | Prevents credential stuffing |
| Implement graduated backoff | MEDIUM | Deters automated attacks |
| Rate limit verification endpoints | MEDIUM | Prevents spam |
| Add global rate limiting across auth endpoints | MEDIUM | Defense in depth |

---

## Phase 3: Performance Optimization (Weeks 5-6)

### 3.1 Audio Processing - HIGH IMPACT

| Task | Priority | Impact |
|------|----------|--------|
| Implement incremental audio graph updates (not full rebuild) | HIGH | Eliminates audio glitches |
| Add sample rate detection and pass to worklets | MEDIUM | Flexibility |
| Cache frequency pre-warping calculations | MEDIUM | Reduces CPU |
| Add latency reporting and display | MEDIUM | User feedback |

**Current Issue:** `rebuildAudioGraph()` in pedalboard-engine.ts disconnects and reconnects entire chain on every effect change, causing audible pops.

**Solution:** Implement hot-swap bypass routing instead of full graph rebuild.

### 3.2 Frontend Performance

| Task | Priority | Impact |
|------|----------|--------|
| Add React.memo to effect panel components | MEDIUM | Reduces re-renders |
| Fix spectrogram circular buffer (memory leak) | MEDIUM | Prevents memory bloat |
| Implement React.lazy for Studio page | MEDIUM | Faster initial load |
| Cache canvas gradients in visualizer | LOW | Reduces GC pressure |

**Memory Leak Fix (audio-visualizer.tsx):**
```typescript
// Current: spectrogramDataRef grows unbounded
// Fix: Implement proper circular buffer with max size
if (spectrogramDataRef.current.length > maxHistory) {
  spectrogramDataRef.current = spectrogramDataRef.current.slice(-maxHistory);
}
```

### 3.3 Backend Performance

| Task | Priority | Impact |
|------|----------|--------|
| Add gzip/brotli compression middleware | HIGH | 60-80% response size reduction |
| Implement query result caching (Redis) | MEDIUM | Reduces DB load |
| Add database connection pooling warmup | LOW | Faster cold starts |

### 3.4 PWA Performance

| Task | Priority | Impact |
|------|----------|--------|
| Fix cache versioning (use build hash, not timestamp) | HIGH | Consistent caching |
| Implement storage quota checking with LRU eviction | MEDIUM | Prevents storage overflow |
| Increase update check interval (60s → 5-10 min) | MEDIUM | Battery savings |

---

## Phase 4: Feature Expansion (Weeks 7-10)

### 4.1 Audio Effects - HIGH PRIORITY

| Effect | Priority | Effort | Notes |
|--------|----------|--------|-------|
| **Reverb** (Convolution-based) | HIGH | High | Critical gap - 80% of chains use reverb |
| **Gate/Expander** | HIGH | Medium | Essential for live recording |
| **Multi-band Compressor** | HIGH | Medium | Professional dynamics control |
| **Graphic EQ** (10-band) | MEDIUM | Medium | Visual frequency control |
| **Overdrive/Boost** | MEDIUM | Low | Distinct from distortion |
| **Pitch Shift** | MEDIUM | High | Popular effect |
| **Ring Modulator** | LOW | Low | Experimental/metallic sounds |
| **Bitcrusher** | LOW | Low | Lo-fi aesthetic |

### 4.2 User Experience

| Feature | Priority | Impact |
|---------|----------|--------|
| Undo/Redo system for parameter changes | HIGH | Core workflow |
| Signal flow visualization | HIGH | Debugging complex chains |
| Preset tagging and search | MEDIUM | Discoverability |
| Keyboard shortcuts (bypass, copy, paste) | MEDIUM | Productivity |
| A/B comparison mode | MEDIUM | Effect evaluation |
| MIDI CC learning | HIGH | Hardware controller support |

### 4.3 Integrations

| Integration | Priority | Impact |
|-------------|----------|--------|
| Web MIDI API for controller support | HIGH | Hardware integration |
| Cloud preset sync (Supabase/Firebase) | HIGH | Multi-device experience |
| Audio export to cloud storage | MEDIUM | Workflow convenience |
| BLE MIDI support | MEDIUM | Wireless controllers |

### 4.4 AI/ML Features

| Feature | Priority | Impact |
|---------|----------|--------|
| Beat/tempo detection | MEDIUM | Auto-sync delay times |
| Adaptive EQ suggestions | MEDIUM | Intelligent processing |
| Vocal/instrument classification | LOW | Targeted effect suggestions |
| Real-time noise reduction (DeepFilterNet) | LOW | Recording quality |

### 4.5 Mobile Enhancements

| Feature | Priority | Impact |
|---------|----------|--------|
| Gesture controls (swipe, pinch, tap) | HIGH | Mobile UX |
| Home screen preset shortcuts | MEDIUM | Quick access |
| External audio interface support | MEDIUM | Mobile recording |
| Haptic feedback | LOW | Tactile response |

---

## Phase 5: Extensibility & Architecture (Weeks 11-14)

### 5.1 Effect Plugin System

**Goal:** Allow third-party effect development without modifying core code.

| Task | Priority | Effort |
|------|----------|--------|
| Create abstract BaseEffect class with lifecycle hooks | HIGH | Medium |
| Build effect registry with dynamic loading | HIGH | Medium |
| Split monolithic effect-processor.js into modules | HIGH | High |
| Define effect manifest/descriptor format | MEDIUM | Low |
| Add effect versioning for compatibility | MEDIUM | Low |

**Plugin Interface:**
```typescript
interface EffectPlugin {
  id: string;
  name: string;
  version: string;
  category: 'modulation' | 'dynamics' | 'saturation' | 'time' | 'filter';
  parameters: ParameterDefinition[];
  workletUrl: string;
  create(context: AudioContext): EffectNode;
}
```

### 5.2 API Expansion

| Endpoint | Priority | Purpose |
|----------|----------|---------|
| `GET /api/v1/presets` | HIGH | List user presets |
| `POST /api/v1/presets` | HIGH | Create preset |
| `PUT /api/v1/presets/:id` | HIGH | Update preset |
| `DELETE /api/v1/presets/:id` | HIGH | Delete preset |
| `POST /api/v1/presets/:id/share` | MEDIUM | Generate shareable link |
| `GET /api/v1/effects` | MEDIUM | List available effects |
| `GET /api/v1/effects/:type/parameters` | MEDIUM | Effect parameter schema |
| `POST /api/v1/audio/analyze` | LOW | Audio analysis for AI |

### 5.3 Code Architecture

| Task | Priority | Effort |
|------|----------|--------|
| Create service layer abstraction (audio, effects, presets) | HIGH | High |
| Implement audio pipeline pattern | MEDIUM | Medium |
| Define domain models (effect, preset, audio-source) | MEDIUM | Low |
| Add dependency injection container | LOW | Medium |

### 5.4 Documentation

| Document | Priority | Effort |
|----------|----------|--------|
| API documentation (OpenAPI/Swagger) | HIGH | Medium |
| DSP algorithm explanations | MEDIUM | Medium |
| AudioWorklet development guide | MEDIUM | Medium |
| Deployment runbook | HIGH | Low |
| Architecture Decision Records (ADRs) | MEDIUM | Low |
| Troubleshooting guide | LOW | Low |

---

## Phase 6: Infrastructure & DevOps (Weeks 15-16)

### 6.1 CI/CD Pipeline

| Task | Priority | Effort |
|------|----------|--------|
| Create GitHub Actions workflow | HIGH | Medium |
| Add ESLint + Prettier linting | MEDIUM | Low |
| Implement automated testing in CI | HIGH | Low |
| Add bundle size monitoring | MEDIUM | Low |
| Implement automated deployment | MEDIUM | Medium |

**GitHub Actions Workflow:**
```yaml
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    - Lint (ESLint)
    - Type check (tsc)
    - Unit tests (Vitest)
    - Coverage report
  build:
    - Build client (Vite)
    - Build server (ESBuild)
    - Bundle analysis
  deploy:
    - Deploy to staging (on PR)
    - Deploy to production (on main)
```

### 6.2 Containerization

| Task | Priority | Effort |
|------|----------|--------|
| Create multi-stage Dockerfile | HIGH | Medium |
| Add docker-compose.yml for local dev | MEDIUM | Low |
| Configure health checks in container | MEDIUM | Low |
| Add Kubernetes manifests (optional) | LOW | Medium |

### 6.3 Monitoring & Observability

| Task | Priority | Effort |
|------|----------|--------|
| Implement Web Vitals tracking (LCP, FID, CLS) | HIGH | Low |
| Add audio performance metrics (latency, dropouts) | HIGH | Medium |
| Integrate error tracking (Sentry) | MEDIUM | Low |
| Add structured logging for production | MEDIUM | Low |
| Create performance dashboard | LOW | Medium |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Token theft via XSS | High | Critical | Move to HttpOnly cookies (Phase 1) |
| Memory exhaustion (spectrogram leak) | Medium | High | Fix circular buffer (Phase 3) |
| Audio glitches on effect changes | High | Medium | Implement hot-swap (Phase 3) |
| No test coverage for DSP | High | High | Add testing infrastructure (Phase 1) |
| Plugin system complexity | Medium | Medium | Start with internal refactor first |
| Breaking API changes | Low | Medium | Implement API versioning early |

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Security score | 6/10 | 9/10 | Week 4 |
| Test coverage | 0% | 80% (critical paths) | Week 6 |
| Audio latency (effect change) | ~50ms glitch | <5ms seamless | Week 6 |
| Initial load time | Unknown | <3s (3G) | Week 8 |
| Core Web Vitals (LCP) | Unknown | <2.5s | Week 8 |
| Available effects | 10 | 15+ | Week 10 |
| API endpoints | 3 | 15+ | Week 12 |

---

## Resource Requirements

### Development Team
- **1 Senior Full-Stack Developer** - Security, API, architecture
- **1 DSP/Audio Engineer** - Effects implementation, audio performance
- **1 Frontend Developer** - React optimization, UX features
- **0.5 DevOps Engineer** - CI/CD, containerization, monitoring

### Infrastructure
- Redis instance (for token/session caching)
- CI/CD platform (GitHub Actions - free for public repos)
- Error tracking service (Sentry - free tier available)
- CDN for static assets (optional, Replit provides)

### External Dependencies
- Impulse response library (for reverb) - Open source available
- Web MIDI polyfill (if needed)
- Argon2 library (for enhanced key derivation)

---

## Appendix A: File Reference

| Category | Key Files |
|----------|-----------|
| **Audio Engine** | `client/src/lib/dsp/pedalboard-engine.ts` (612 lines) |
| **Effects** | `client/src/lib/dsp/worklet-effects.ts` (621 lines) |
| **Worklet Processor** | `public/worklets/effect-processor.js` |
| **Authentication** | `server/auth.ts` (866 lines) |
| **Database** | `shared/schema.ts`, `server/storage.ts` (458 lines) |
| **Configuration** | `vite.config.ts`, `server/index.ts` |
| **PWA** | `public/sw.js`, `client/src/lib/space-child-pwa.ts` |

---

## Appendix B: Quick Wins Summary

These can be implemented in <1 day each with high impact:

1. Add Helmet security headers
2. Set SameSite=Strict on cookies
3. Add request size limits
4. Remove hardcoded default user
5. Add response compression
6. Fix PWA cache versioning
7. Cache canvas gradients in visualizer
8. Add keyboard shortcuts for common actions
9. Create `.env.example` file
10. Add basic health check expansion

---

## Appendix C: Security Hardening Checklist

### CRITICAL (Week 1)
- [ ] Remove `info@spacechild.love` default user from auth.ts
- [ ] Migrate localStorage tokens to HttpOnly cookies
- [ ] Encrypt `userAISettings.apiKey` in database
- [ ] Add CSRF protection

### HIGH (Week 2-3)
- [ ] Add Helmet security headers
- [ ] Configure explicit CORS
- [ ] Set SameSite=Strict
- [ ] Add request size limits
- [ ] Replace custom ZKP with battle-tested library

### MEDIUM (Week 4+)
- [ ] Enhance rate limiting per-email
- [ ] Add audit logging
- [ ] Sanitize user inputs
- [ ] Hash IPs in login_attempts
- [ ] Implement CSP header

---

*This roadmap is a living document. Review and update quarterly based on user feedback, security advisories, and business priorities.*
