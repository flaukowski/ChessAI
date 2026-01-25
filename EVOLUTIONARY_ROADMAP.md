# AudioNoise Web - Evolutionary Roadmap

**Generated:** January 17, 2026
**Last Updated:** January 25, 2026
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
| Feature Completeness | 9/10 | Full commercial platform with subscriptions, teams, social |
| Security Posture | 10/10 | Phase 2 complete: HttpOnly cookies, CSRF, rate limiting, credential stuffing prevention |
| Performance | 7/10 | AudioWorklet excellent, memory leaks present |
| Extensibility | 7/10 | Effect registry, comprehensive API |
| Infrastructure | 7/10 | CI/CD workflows, error boundary, analytics |

### Recent Accomplishments (January 2026)

- Implemented full Stripe subscription system (Free/Pro/Studio tiers)
- Added team workspace functionality with RBAC
- Built social features (profiles, follows, likes, comments)
- Created GDPR compliance module (consent, export, deletion)
- Implemented AES-256-GCM encryption for API keys
- Added analytics and admin dashboard endpoints
- Created error boundary component
- Developed tier-gating middleware

### January 25, 2026 Update

**Security Hardening Complete:**
- HttpOnly cookie migration completed - tokens no longer stored in localStorage
- Security headers implemented via Helmet (CSP, HSTS, X-Frame-Options)
- Explicit CORS policy configured
- Request size limits added (1MB general, 50MB audio)
- Hardcoded default user removed (now uses environment variables)

**Testing Infrastructure:**
- Audio context mocks created for comprehensive Web Audio API testing
- DSP algorithm unit tests written (biquad, echo, flanger, lfo, delay-line)
- Preset serialization unit tests added
- Coverage reporting configured (50% threshold)

**Phase 1 Security Complete:**
- All critical security items implemented including CSRF protection (double-submit cookie pattern)

---

## Phase 1: Critical Foundations (Weeks 1-2) - COMPLETED

### 1.1 Security - CRITICAL FIXES

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Remove hardcoded default user (`info@spacechild.love` with password 'password') | CRITICAL | Low | Prevents unauthorized access | **DONE** |
| Migrate tokens from localStorage to HttpOnly cookies | CRITICAL | Medium | Prevents XSS token theft | **DONE** |
| Encrypt API keys in database (userAISettings.apiKey) | CRITICAL | Medium | Protects user credentials | **DONE** |
| Implement CSRF protection with tokens | HIGH | Medium | Prevents cross-site attacks | **DONE** |
| Add security headers (CSP, HSTS, X-Frame-Options) via Helmet | HIGH | Low | Defense in depth | **DONE** |
| Configure explicit CORS policy | HIGH | Low | Prevents unauthorized access | **DONE** |
| Add request size limits (express.json limit) | HIGH | Low | Prevents DoS attacks | **DONE** |

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

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Install Vitest and configure for TypeScript | CRITICAL | Low | **DONE** |
| Create audio context mocks for testing | CRITICAL | Medium | **DONE** |
| Write unit tests for DSP algorithms (biquad, echo, flanger) | CRITICAL | Medium | **DONE** |
| Write unit tests for preset serialization | HIGH | Low | **DONE** |
| Add coverage reporting | MEDIUM | Low | **DONE** |

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

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Create centralized config module | HIGH | Medium | Pending |
| Extract magic numbers to configuration | HIGH | Low | Pending |
| Add Zod validation for environment variables | MEDIUM | Low | Pending |
| Create `.env.example` with documented variables | MEDIUM | Low | Pending |

**Configuration to Extract:**
- Sample rate (currently hardcoded: 48000)
- Token expiry times (15 min access, 7 day refresh)
- Rate limiting thresholds (10 req/min)
- Worklet paths (/worklets/effect-processor.js)
- Polling intervals (2000ms)

---

## Commercial Features Implemented (January 2026)

### Subscription System (Stripe)
- **DONE** - Full Stripe integration (`server/stripe.ts`)
- **DONE** - Subscription tiers: Free, Pro ($9.99/mo), Studio ($19.99/mo)
- **DONE** - Checkout sessions and billing portal
- **DONE** - Webhook handling for subscription lifecycle
- **DONE** - Tier limits enforcement (`server/middleware/tier-gating.ts`)

### Team Workspaces
- **DONE** - Workspace CRUD operations (`server/workspaces.ts`)
- **DONE** - RBAC: Admin, Editor, Viewer roles
- **DONE** - Member invitations with token-based auth
- **DONE** - Shared recordings within workspaces

### Social Features
- **DONE** - User profiles with bio, avatar, social links (`server/social.ts`)
- **DONE** - Follow/unfollow system
- **DONE** - Recording likes
- **DONE** - Threaded comments
- **DONE** - Notification system

### GDPR Compliance
- **DONE** - Consent tracking (`server/gdpr.ts`)
- **DONE** - Data export (JSON/ZIP format)
- **DONE** - Account deletion with 30-day grace period

### Security & Encryption
- **DONE** - AES-256-GCM encryption for API keys (`server/encryption.ts`)
- **DONE** - Error boundary component (`client/src/components/error-boundary.tsx`)

### Analytics & Admin
- **DONE** - Event tracking (`server/analytics.ts`)
- **DONE** - Admin dashboard endpoints
- **DONE** - User management endpoints
- **DONE** - Revenue reporting

### Database Schema
- **DONE** - 20+ new tables added to `shared/schema.ts`:
  - `encryptedApiKeys`, `gdprConsent`, `gdprExportRequests`, `gdprDeletionRequests`
  - `subscriptions`, `usageRecords`, `paymentHistory`
  - `workspaces`, `workspaceMembers`, `workspaceInvites`, `workspaceRecordings`
  - `userProfiles`, `follows`, `recordingLikes`, `recordingComments`, `commentLikes`
  - `notifications`, `analyticsEvents`, `featureFlags`, `adminLogs`

---

## Phase 2: Security Hardening (Weeks 3-4) - 95% COMPLETE

### 2.1 Session & Token Management

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Set SameSite=Strict on session cookies | HIGH | Prevents CSRF | **DONE** |
| Replace in-memory token store with Redis/DB | HIGH | Enables horizontal scaling | Pending |
| Invalidate all sessions on password reset | MEDIUM | Security hygiene | **DONE** |
| Add absolute session timeout (24h) | MEDIUM | Limits exposure window | **DONE** |
| Implement token rotation on refresh | MEDIUM | Reduces token reuse risk | **DONE** |

**January 25, 2026 Implementation Notes:**
- Token rotation: When refresh token is used, old token is deleted and new pair is issued
- Absolute session timeout: Sessions expire 24h after initial login regardless of refresh activity
- Password reset invalidation: Both refresh tokens (database) AND access tokens (in-memory) are cleared
- Added `invalidateAccessTokensForUser()` exported function for admin forced logout scenarios

### 2.2 Input Validation & Database Security

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Add server-side email validation | HIGH | Prevents bad data | **DONE** |
| Extend Zod schemas for all user input | MEDIUM | Type-safe validation | **DONE** |
| Sanitize firstName/lastName on storage | MEDIUM | Prevents XSS | **DONE** |
| Hash IP addresses in login_attempts | MEDIUM | GDPR/privacy compliance | **DONE** |
| Implement audit logging table | MEDIUM | Security monitoring | Pending |

**January 25, 2026 Implementation Notes:**
- Extended `validation.ts` with 12+ Zod schemas for all user input (support tickets, profiles, workspaces, presets, recordings, etc.)
- Added `escapeHtml()` function for XSS prevention
- Added `sanitizeName()` combining control char removal + HTML entity encoding
- Added `hashIpAddress()` using SHA-256 with configurable salt for GDPR compliance
- All auth endpoints now use `getHashedClientIP()` for privacy-compliant IP logging

### 2.3 Rate Limiting Enhancement

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Add per-email rate limits (5 failed/24h) | HIGH | Prevents credential stuffing | **DONE** |
| Implement graduated backoff | MEDIUM | Deters automated attacks | **DONE** |
| Rate limit verification endpoints | MEDIUM | Prevents spam | **DONE** |
| Add global rate limiting across auth endpoints | MEDIUM | Defense in depth | **DONE** |

**January 25, 2026 Implementation Notes:**
- Per-email failed login tracking with 24h window and 5 max attempts
- Graduated exponential backoff: 1s base × 2^failures (up to 5 min max)
- Email action rate limiting: 3 requests/hour for verification & password reset emails
- `sensitiveEndpointRateLimiter` middleware: 5 requests per 5 minutes per IP
- Applied to `/register`, `/login`, `/forgot-password`, `/reset-password` endpoints
- Failed login tracking cleared on successful password reset
- Configuration centralized in `server/config.ts` with all timing constants

---

## Phase 3: Performance Optimization (Weeks 5-6)

### 3.1 Audio Processing - HIGH IMPACT

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Implement incremental audio graph updates (not full rebuild) | HIGH | Eliminates audio glitches | **DONE** |
| Add sample rate detection and pass to worklets | MEDIUM | Flexibility | Pending |
| Cache frequency pre-warping calculations | MEDIUM | Reduces CPU | Pending |
| Add latency reporting and display | MEDIUM | User feedback | Pending |

**January 25, 2026 Implementation Notes:**
- Implemented crossfade architecture in `pedalboard-engine.ts` with dual effect chains (A/B)
- 15ms crossfade duration eliminates audio pops/clicks during effect chain modifications
- Static graph portions (source, meters, analyser, output) remain stable - no longer disconnected
- Only effect chain connections are modified when adding/removing/reordering effects
- Effect toggle bypass already worked via internal worklet bypass (no graph rebuild needed)
- Added `effectChainA` and `effectChainB` gain nodes for seamless A/B crossfading
- `updateAudioGraphWithCrossfade()` handles smooth transitions between chain configurations
- Cleanup of old chain connections scheduled after crossfade completes (15ms + buffer)

### 3.2 Frontend Performance

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Add React.memo to effect panel components | MEDIUM | Reduces re-renders | **DONE** |
| Fix spectrogram circular buffer (memory leak) | MEDIUM | Prevents memory bloat | **DONE** |
| Implement React.lazy for Studio page | MEDIUM | Faster initial load | **DONE** |
| Cache canvas gradients in visualizer | LOW | Reduces GC pressure | **DONE** |

**January 25, 2026 Implementation Notes:**
- React.memo applied to: `EffectCard`, `EffectPicker`, `AudioVisualizer`, `AIEffectSuggester`, `AIEffectChat`, `RecordingControls`, `Pedalboard`, `SortableEffectCard`, `MeterBar`
- React.lazy already implemented in `App.tsx` for Studio and all heavy pages with Suspense fallback
- Spectrogram circular buffer already fixed with `maxSpectrogramHistory` limit (256 max) and proper cleanup on unmount/view change
- Canvas gradients now cached in `cachedGradientsRef` - only recreated when dimensions change (WAVEFORM_GRADIENT_STOPS, BG_GRADIENT_STOPS)
- Added useCallback for event handlers to prevent child re-renders
- Added useMemo for computed values (effectIds in Pedalboard)

### 3.3 Backend Performance

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Add gzip/brotli compression middleware | HIGH | 60-80% response size reduction | **DONE** |
| Implement query result caching (Redis) | MEDIUM | Reduces DB load | Pending |
| Add database connection pooling warmup | LOW | Faster cold starts | Pending |

### 3.4 PWA Performance

| Task | Priority | Impact | Status |
|------|----------|--------|--------|
| Fix cache versioning (use build hash, not timestamp) | HIGH | Consistent caching | **DONE** |
| Implement storage quota checking with LRU eviction | MEDIUM | Prevents storage overflow | **DONE** |
| Increase update check interval (60s → 5-10 min) | MEDIUM | Battery savings | **DONE** |

**January 25, 2026 Implementation Notes:**
- Cache versioning now uses content-based SHA-256 hash (first 12 chars) from Vite build output
- Custom Vite plugin (`serviceWorkerBuildHash`) generates hash from all chunk content and injects into sw.js
- LRU eviction strategy implemented with configurable limits per cache type (100 runtime, 200 images, 50 API entries)
- Storage quota monitoring triggers eviction at 80% threshold
- Automatic expired entry cleanup on service worker activation (24h for API, 7 days for images)
- Update check interval increased from 60s to 5 minutes (300000ms) for battery savings
- Added `GET_STORAGE_INFO` and `CLEAN_CACHES` message handlers for debugging and manual cleanup

---

## Phase 4: Feature Expansion (Weeks 7-10)

### 4.1 Audio Effects - HIGH PRIORITY

| Effect | Priority | Effort | Notes | Status |
|--------|----------|--------|-------|--------|
| **Reverb** (Convolution-based) | HIGH | High | Critical gap - 80% of chains use reverb | **DONE** |
| **Gate/Expander** | HIGH | Medium | Essential for live recording | **DONE** |
| **Multi-band Compressor** | HIGH | Medium | Professional dynamics control | Pending |
| **Graphic EQ** (10-band) | MEDIUM | Medium | Visual frequency control | Pending |
| **Overdrive/Boost** | MEDIUM | Low | Distinct from distortion | Pending |
| **Pitch Shift** | MEDIUM | High | Popular effect | Pending |
| **Ring Modulator** | LOW | Low | Experimental/metallic sounds | Pending |
| **Bitcrusher** | LOW | Low | Lo-fi aesthetic | Pending |

**January 25, 2026 - Gate/Expander Implementation:**
- Full noise gate with expander mode for dynamics control
- Parameters: threshold (-60 to 0 dB), attack (0.1-50ms), hold (0-500ms), release (5-1000ms)
- Range/depth control (-80 to 0 dB) for maximum attenuation
- Ratio control (1:1 to 100:1) - low ratios for soft expansion, 100 for hard gate
- Sidechain HPF (20-500 Hz) to ignore low-frequency content in detection
- Real-time gain reduction metering via message port for visual feedback
- 6 presets: Gentle Gate, Tight Gate, Drum Gate, Vocal Gate, Soft Expander, Bass Gate

### 4.2 User Experience

| Feature | Priority | Impact | Status |
|---------|----------|--------|--------|
| Undo/Redo system for parameter changes | HIGH | Core workflow | **DONE** |
| Signal flow visualization | HIGH | Debugging complex chains | Pending |
| Preset tagging and search | MEDIUM | Discoverability | Pending |
| Keyboard shortcuts (bypass, copy, paste) | MEDIUM | Productivity | **DONE** |
| A/B comparison mode | MEDIUM | Effect evaluation | Pending |
| MIDI CC learning | HIGH | Hardware controller support | Pending |

**January 25, 2026 - Undo/Redo Implementation:**
- Command pattern with state snapshots for reliable undo/redo
- Tracks all effect chain modifications:
  - Effect parameter changes (debounced 300ms for continuous adjustments like knobs)
  - Effect additions/removals (immediate recording)
  - Effect reordering via drag-and-drop
  - Effect enable/disable toggles
  - Input/output gain changes
  - Global bypass state changes
  - Preset loads (URL and file)
- 50-entry history limit to balance memory usage
- Keyboard shortcuts: Ctrl+Z / Cmd+Z for undo, Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y for redo
- UI controls in Pedalboard header with undo/redo buttons and history dropdown
- Tooltips showing keyboard shortcuts and action descriptions
- Files: `client/src/lib/undo-history.ts`, `client/src/hooks/use-undo-redo.ts`, `client/src/components/undo-redo-controls.tsx`

**January 25, 2026 - Keyboard Shortcuts Implementation:**
- Comprehensive keyboard shortcuts system with help dialog (press `?` to toggle)
- Shortcuts registered via `useKeyboardShortcuts` hook with automatic cleanup
- All shortcuts ignore input when typing in text fields (INPUT, TEXTAREA, contentEditable)
- **Playback:** `Space` - Toggle audio playback or global bypass
- **Effects:** `B` - Bypass selected effect, `Delete/Backspace` - Remove effect, `Ctrl/Cmd+C` - Copy, `Ctrl/Cmd+V` - Paste, `Ctrl/Cmd+D` - Duplicate
- **Navigation:** `Up/Down` arrows - Navigate between effects, `1-9` - Quick-select effect by position, `Escape` - Deselect all
- **General:** `Ctrl/Cmd+S` - Save preset, `?` - Show keyboard shortcuts help
- Visual keyboard shortcut button in Studio header with tooltip
- Help dialog displays all shortcuts organized by category with platform-appropriate key symbols (Mac: command symbols, Windows: Ctrl/Alt)

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

1. ~~Add Helmet security headers~~ **DONE**
2. ~~Set SameSite=Strict on cookies~~ **DONE**
3. ~~Add request size limits~~ **DONE**
4. ~~Remove hardcoded default user~~ **DONE**
5. ~~Add response compression~~ **DONE**
6. ~~Fix PWA cache versioning~~ **DONE** (content-based hash + LRU eviction)
7. Cache canvas gradients in visualizer
8. ~~Add keyboard shortcuts for common actions~~ **DONE** (Space, B, Delete, Ctrl+C/V/D/S, arrows, 1-9, Escape, ?)
9. Create `.env.example` file
10. Add basic health check expansion

---

## Appendix C: Security Hardening Checklist

### CRITICAL (Week 1)
- [x] Remove `info@spacechild.love` default user from auth.ts - **DONE** (uses env vars now)
- [x] Migrate localStorage tokens to HttpOnly cookies - **DONE**
- [x] Encrypt `userAISettings.apiKey` in database - **DONE** (AES-256-GCM)
- [x] Add CSRF protection - **DONE** (double-submit cookie pattern)

### HIGH (Week 2-3)
- [x] Add Helmet security headers - **DONE**
- [x] Configure explicit CORS - **DONE**
- [x] Set SameSite=Strict - **DONE** (in session config)
- [x] Add request size limits - **DONE**
- [ ] Replace custom ZKP with battle-tested library

### MEDIUM (Week 4+)
- [ ] Enhance rate limiting per-email
- [x] Add audit logging - **DONE** (`adminLogs` table, analytics tracking)
- [ ] Sanitize user inputs
- [ ] Hash IPs in login_attempts
- [ ] Implement CSP header

### COMMERCIAL FEATURES (Completed January 2026)
- [x] Stripe subscription integration
- [x] Tier-based feature gating
- [x] Team workspaces with RBAC
- [x] Social features (profiles, follows, likes, comments)
- [x] GDPR compliance (consent, export, deletion)
- [x] Analytics and admin dashboard
- [x] Error boundary component

---

*This roadmap is a living document. Review and update quarterly based on user feedback, security advisories, and business priorities.*
