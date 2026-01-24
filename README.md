<p align="center">
  <img src="https://img.shields.io/badge/AudioNoise%20Web-Real--Time%20DSP-gradient?style=for-the-badge&labelColor=0d1117&color=06b6d4" alt="AudioNoise Web" />
</p>

<h1 align="center">
  <br>
  🎛️ AudioNoise Web
  <br>
  <sub>Professional Audio DSP Platform</sub>
</h1>

<p align="center">
  <strong>Real-time audio processing with team collaboration, subscriptions, and social features</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#subscriptions">Subscriptions</a> •
  <a href="#api">API</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Web%20Audio%20API-FF6B6B?style=flat-square&logo=webaudio&logoColor=white" alt="Web Audio API" />
  <img src="https://img.shields.io/badge/Stripe-008CDD?style=flat-square&logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## ✨ Overview

**AudioNoise Web** is a professional-grade browser-based audio effects platform with:

- **10 DSP Effects** — Ported from Linus Torvalds' AudioNoise C algorithms
- **Team Workspaces** — Collaborate with RBAC permissions
- **Subscription Tiers** — Free, Pro, and Studio plans
- **Social Features** — Profiles, follows, likes, comments
- **AI Suggestions** — Intelligent effect recommendations
- **GDPR Compliant** — Full data export and deletion

---

## 🚀 Features

### 🎛️ DSP Effects Engine

| Effect | Description |
|--------|-------------|
| **Echo** | Delay with feedback and LFO modulation |
| **Flanger** | Classic modulated delay sweeping |
| **Phaser** | 4-stage allpass cascade with LFO |
| **Low Pass** | Warm tone shaping biquad filter |
| **High Pass** | Clean up muddy frequencies |
| **Band Pass** | Isolate frequency ranges |
| **Notch** | Surgical frequency removal |
| **All Pass** | Phase shifting |
| **Distortion** | Soft/hard clipping saturation |
| **Growling Bass** | Subharmonic generator with harmonics |

### 💼 Team Workspaces

- Create team workspaces for collaboration
- Role-based access control (Admin, Editor, Viewer)
- Invite members via email
- Share recordings within workspaces

### 💳 Subscription Tiers

| Feature | Free | Pro ($9.99/mo) | Studio ($19.99/mo) |
|---------|------|----------------|-------------------|
| Effects in chain | 3 | 10 | Unlimited |
| Recordings | 5 | 50 | Unlimited |
| Storage | 100MB | 2GB | 20GB |
| AI suggestions | 10/mo | 100/mo | Unlimited |
| Export formats | WAV | WAV, MP3, OGG | WAV, MP3, OGG, FLAC |
| Team workspaces | ❌ | ❌ | ✅ |
| API access | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

### 👥 Social Features

- **User Profiles** — Bio, avatar, social links
- **Follow System** — Follow your favorite creators
- **Likes & Comments** — Engage with public recordings
- **Notifications** — Stay updated on activity

### 🤖 AI Effect Suggestions

- Bring your own API key (OpenAI, Anthropic, Ollama)
- Encrypted API key storage (AES-256-GCM)
- Real-time audio analysis
- One-click effect application

### 🔒 Security & Compliance

- **ZKP Authentication** — Zero-knowledge proof login
- **AES-256-GCM Encryption** — For sensitive data
- **GDPR Compliant** — Data export and deletion
- **Audit Logging** — Full activity tracking

---

## 🏃 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/audionoise-web.git
cd audionoise-web

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/audionoise

# Authentication
JWT_SECRET=your-secret-key

# Encryption (64 hex characters = 32 bytes)
ENCRYPTION_MASTER_KEY=0123456789abcdef...

# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_STUDIO=price_...

# Admin
ADMIN_USER_IDS=user-id-1,user-id-2
```

---

## 💳 Subscriptions

AudioNoise Web uses Stripe for subscription management.

### Setting Up Stripe

1. Create products and prices in Stripe Dashboard
2. Set up webhook endpoint: `/api/v1/billing/webhook`
3. Configure environment variables

### Webhook Events Handled

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## 🔌 API

### Authentication

```bash
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### Recordings

```bash
GET    /api/v1/recordings
POST   /api/v1/recordings
GET    /api/v1/recordings/:id
PUT    /api/v1/recordings/:id
DELETE /api/v1/recordings/:id
GET    /api/v1/recordings/public
```

### Billing

```bash
GET  /api/v1/billing/subscription
POST /api/v1/billing/checkout
POST /api/v1/billing/portal
GET  /api/v1/billing/usage
POST /api/v1/billing/cancel
```

### Workspaces

```bash
GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/:id
PUT    /api/v1/workspaces/:id
DELETE /api/v1/workspaces/:id
POST   /api/v1/workspaces/:id/invite
GET    /api/v1/workspaces/:id/members
```

### Social

```bash
GET  /api/v1/social/profile
PUT  /api/v1/social/profile
GET  /api/v1/social/users/:username
POST /api/v1/social/follow/:userId
GET  /api/v1/social/recordings/:id/likes
POST /api/v1/social/recordings/:id/comments
GET  /api/v1/social/notifications
```

### GDPR

```bash
GET  /api/v1/gdpr/consent
POST /api/v1/gdpr/consent
POST /api/v1/gdpr/export
POST /api/v1/gdpr/delete
```

---

## 🏗️ Architecture

```
audionoise-web/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # UI components
│   │   │   ├── ui/             # shadcn/ui primitives
│   │   │   ├── pedalboard.tsx  # Effect chain UI
│   │   │   ├── error-boundary.tsx
│   │   │   └── ...
│   │   ├── hooks/              # React hooks
│   │   ├── lib/
│   │   │   └── dsp/            # AudioNoise DSP library
│   │   └── pages/
│   └── public/
│       └── worklets/           # AudioWorklet processors
├── server/                     # Express backend
│   ├── auth.ts                 # Authentication
│   ├── stripe.ts               # Billing
│   ├── workspaces.ts           # Team workspaces
│   ├── social.ts               # Social features
│   ├── analytics.ts            # Event tracking
│   ├── gdpr.ts                 # GDPR compliance
│   ├── encryption.ts           # AES-256-GCM
│   └── middleware/
│       └── tier-gating.ts      # Feature limits
├── shared/                     # Shared code
│   ├── schema.ts               # Database schema (Drizzle)
│   └── tiers.ts                # Subscription definitions
└── .github/workflows/          # CI/CD (local only)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui, Radix Primitives |
| **Audio** | Web Audio API, AudioWorklet |
| **Backend** | Express, Node.js |
| **Database** | PostgreSQL, Drizzle ORM |
| **Payments** | Stripe |
| **Auth** | JWT, ZKP |
| **Build** | Vite |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Areas we'd love help with:**
- 🎸 New DSP effects (reverb, compressor, EQ)
- 🧪 Test coverage improvements
- 📱 Mobile experience
- 🌍 Internationalization
- 📚 Documentation

---

## 📜 License

This project is licensed under the **GNU General Public License v2** — see [LICENSE](LICENSE).

---

## 🙏 Acknowledgments

- **AudioNoise** — Original C DSP algorithms
- **Linus Torvalds** — DSP algorithm design
- **shadcn/ui** — Beautiful component primitives
- **Stripe** — Payment infrastructure

---

<p align="center">
  <strong>Built with 💜 for audio professionals</strong>
</p>
