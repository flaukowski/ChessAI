# AudioNoise Web - Feature Implementation Plan

> **STATUS: SUPERSEDED**
>
> This plan has been largely completed and superseded by the Commercial Product Transformation Plan.
> See `.claude-user/plans/magical-scribbling-dream.md` for the comprehensive 6-phase plan.
>
> **Completed Items:**
> - Database schema for recordings and support tickets
> - Recording API routes (`/api/v1/recordings`)
> - Support routes (`/api/v1/support`)
> - Legal pages (Privacy, Terms)
> - Recording controls in Studio
> - Community recordings browser
> - Recording library component
>
> **Additionally Implemented (Beyond Original Scope):**
> - Stripe subscription system (Free/Pro/Studio)
> - Team workspaces with RBAC
> - Social features (profiles, follows, likes, comments)
> - GDPR compliance module
> - AES-256-GCM encryption
> - Analytics and admin dashboard

---

## Original Overview (Historical Reference)
This plan covers the implementation of recording functionality, public/private recording sharing, legal pages, support system, and login performance fix.

## Phase 1: Database Schema Updates

### 1.1 Add Recordings Table
```sql
CREATE TABLE recordings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- in seconds
  file_size INTEGER NOT NULL, -- in bytes
  file_url TEXT NOT NULL, -- storage path/URL
  format VARCHAR(10) NOT NULL DEFAULT 'wav', -- wav, mp3, ogg
  sample_rate INTEGER DEFAULT 44100,
  channels INTEGER DEFAULT 2,
  effect_chain JSONB, -- snapshot of effects used during recording
  settings JSONB, -- input/output gain, etc.
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token VARCHAR UNIQUE, -- for sharing private recordings via link
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_is_public ON recordings(is_public);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);
```

### 1.2 Add Support Tickets Table
```sql
CREATE TABLE support_tickets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  email TEXT NOT NULL,
  name TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved, closed
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

## Phase 2: API Routes

### 2.1 Recording Routes (`/api/v1/recordings`)
- `POST /` - Create new recording (upload audio file)
- `GET /` - List user's recordings
- `GET /public` - List public recordings from all users
- `GET /:id` - Get recording details
- `PUT /:id` - Update recording (title, description, public/private)
- `DELETE /:id` - Delete recording
- `POST /:id/toggle-public` - Toggle public/private status
- `GET /share/:token` - Get recording by share token

### 2.2 Support Routes (`/api/v1/support`)
- `POST /contact` - Submit support request (sends email to nick@spacechild.love)

## Phase 3: Client Components

### 3.1 Recording Controls (Studio)
- Record button with visual feedback
- Recording timer
- Stop and save functionality
- Auto-capture effect chain snapshot

### 3.2 Recordings Library Component
- Grid/list view of user's recordings
- Play/pause controls
- Edit metadata (title, description)
- Toggle public/private
- Delete recording
- Share link generation

### 3.3 Community Recordings Browser
- Browse public recordings from other users
- Search/filter functionality
- Load into studio for processing
- Play preview

### 3.4 Legal Pages
- `/privacy` - Privacy Policy page
- `/terms` - Terms of Service page

### 3.5 Support Page
- `/support` - Contact form with email to nick@spacechild.love

## Phase 4: Login Performance Fix

### Analysis
The login delay appears to be caused by:
1. Lazy loading of Studio component
2. Audio context initialization
3. Multiple useEffect hooks running sequentially

### Fix Strategy
1. Add Suspense fallback with better loading state
2. Pre-initialize audio context after successful login
3. Add loading state management in Studio component
4. Consider preloading Studio component after landing page loads

## Implementation Order

1. **Database Schema** - Add recordings and support_tickets tables - **COMPLETED**
2. **API Routes** - Recording CRUD and support endpoints - **COMPLETED**
3. **Recording UI** - Record button, timer, save dialog - **COMPLETED**
4. **Recordings Library** - User's recordings management - **COMPLETED**
5. **Community Browser** - Public recordings discovery - **COMPLETED**
6. **Legal Pages** - Privacy, Terms, Support - **COMPLETED**
7. **Footer Links** - Update navigation - **COMPLETED**
8. **Login Fix** - Performance optimization - **COMPLETED**

## File Changes Required

### New Files
- `shared/schema.ts` - Add recordings, supportTickets tables
- `server/recordings.ts` - Recording routes
- `server/support.ts` - Support routes
- `client/src/pages/privacy.tsx` - Privacy Policy
- `client/src/pages/terms.tsx` - Terms of Service
- `client/src/pages/support.tsx` - Support/Contact
- `client/src/components/recording-controls.tsx` - Record button/timer
- `client/src/components/recordings-library.tsx` - User recordings
- `client/src/components/community-recordings.tsx` - Public recordings browser
- `client/src/hooks/use-audio-recorder.ts` - Recording hook

### Modified Files
- `client/src/App.tsx` - Add new routes
- `client/src/pages/landing.tsx` - Update footer links
- `client/src/pages/studio.tsx` - Add recording controls, fix loading
- `server/routes.ts` - Register new route handlers
- `client/src/components/audio-input.tsx` - Add load from recording option
