# Creative Flow Studio - Project Overview

## Purpose

Creative Flow Studio is a multimodal AI SaaS application that integrates multiple Google Gemini AI capabilities into a single chat interface. It provides:

- **Text generation**: Chat, Pro mode (with thinking budget), Search-grounded responses
- **Image generation/editing**: Imagen 4.0
- **Video generation**: Veo 3.1
- **Multimodal interactions**: File upload support for images and videos
- **DJ Shacho Mode**: Unique persona mode applying high-energy Kyushu dialect style

## Tech Stack

### Frontend & Backend
- **Framework**: Next.js 14.2.33 (App Router)
- **Language**: TypeScript 5.9.3
- **UI**: React 18.3.1 with Tailwind CSS 4.1.17
- **Styling**: PostCSS + Tailwind CSS v4

### Database & ORM
- **Database**: PostgreSQL (Cloud SQL on GCP)
- **ORM**: Prisma 6.19.0 with Prisma Client

### Authentication
- **Auth**: NextAuth.js 4.24.13 with Prisma Adapter
- **Provider**: Google OAuth
- **Strategy**: Server-side session with database persistence

### AI Integration
- **SDK**: @google/genai 1.29.0
- **Models**:
  - `gemini-2.5-flash` - Fast text responses
  - `gemini-2.5-pro` - Pro mode with thinking
  - `gemini-2.5-flash-image` - Image editing
  - `imagen-4.0` - Image generation
  - `veo-3.1-fast` - Video generation

### Validation & Testing
- **Validation**: Zod 4.1.12
- **Unit Tests**: Vitest 4.0.8 + Testing Library
- **E2E Tests**: Playwright 1.56.1

### Infrastructure (GCP)
- **Project ID**: dataanalyticsclinic
- **Region**: asia-northeast1
- **Compute**: Cloud Run (auto-scaling 0-5 instances)
- **Network**: VPC with Serverless VPC Connector
- **Secrets**: Secret Manager
- **CI/CD**: Cloud Build + Artifact Registry
- **IaC**: Terraform

## Current Branch Status

- **main**: Alpha version (React + Vite frontend-only), deployed to Vercel
- **dev**: Next.js 14 full-stack SaaS (CURRENT DEVELOPMENT BRANCH)

**You are working on the `dev` branch.**

## Current Development Progress (Updated 2025-11-28)

### ✅ All Phases Completed

#### Phase 2: Environment Setup ✅
- Next.js 14, Prisma ORM, ESLint, Prettier, Vitest, Playwright
- Tailwind CSS v4 with PostCSS configuration

#### Phase 3: Authentication Foundation ✅
- NextAuth.js 4.24.13 with Prisma Adapter
- Google OAuth provider
- Server-side session strategy

#### Gemini API Integration ✅
- API Routes: `/api/gemini/chat`, `/api/gemini/image`, `/api/gemini/video`
- Video polling: `/api/gemini/video/status`
- Secure download: `/api/gemini/video/download`
- UI components: `ChatMessage`, `ChatInput`, `LandingPage`
- Main interface: `app/page.tsx`

#### Phase 4: Conversation Persistence ✅ (2025-11-13)
- **Zod Validators**: conversation and message schemas
- **Full CRUD API**: POST/GET/PATCH/DELETE conversations
- **Message API**: POST /api/conversations/[id]/messages
- **Frontend**: SessionProvider, auto-save, sidebar UI
- **Testing**: 33 Vitest tests (100% coverage)

#### Phase 5: Stripe Integration ✅ (2025-11-13)
- **Checkout Session**: `POST /api/stripe/checkout`
- **Webhook Handlers**: 5 events with idempotency
- **Dashboard UI**: `app/dashboard/page.tsx`
- **Usage Limits**: Integrated with all Gemini APIs
- **Testing**: 55 Vitest tests

**Plan Restrictions:**
- FREE: Chat/Search only, 100 req/month
- PRO: Chat/Pro/Search/Image, 1000 req/month
- ENTERPRISE: All features + Video, unlimited

#### Phase 6: Admin Dashboard ✅ (2025-11-13)
- **RBAC Middleware**: Role-based access control
- **Admin APIs**: users, usage, stats endpoints
- **Admin Pages**: User management, usage monitoring
- **Testing**: 48 Vitest tests

#### Landing Page & Auth UX ✅ (2025-11-17)
- **Landing Page**: `components/LandingPage.tsx`
- **Toast System**: `components/Toast.tsx`
- **Tailwind v4**: Migration completed
- **Favicon**: `app/icon.svg`

### 🔄 Pending (Infrastructure)

- NextAuth environment variables on Cloud Run
- Google OAuth redirect URI registration
- N+1 query optimization in admin API

## Test Status

**Total Tests**: 136 (All passing ✅)

| Category | Tests | Status |
|----------|-------|--------|
| Conversation APIs | 33 | ✅ |
| Stripe Integration | 55 | ✅ |
| Gemini APIs | 18 | ✅ |
| Admin APIs | 22 | ✅ |
| Admin UI | 26 | ✅ |
| Example | 3 | ✅ |

**Type Check**: ✅ Passing (16 non-blocking errors in test files)

## Key Files

- `CLAUDE.md` - Comprehensive developer documentation
- `docs/implementation-plan.md` - Implementation status
- `docs/onboarding.md` - Quick start guide
- `docs/testing-plan.md` - Manual validation guide
- `docs/interface-spec.md` - App ⇔ Infra interface
- `infra/envs/dev/` - Terraform infrastructure code
- `alpha/` - Old React+Vite app (reference only)
