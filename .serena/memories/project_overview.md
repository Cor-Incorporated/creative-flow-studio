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

## Current Development Progress (Updated 2025-11-13)

### ✅ Completed Phases

#### Phase 2: Environment Setup ✅
- Next.js 14, Prisma ORM, ESLint, Prettier, Vitest, Playwright
- Tailwind CSS v4 with PostCSS configuration

#### Phase 3: Authentication Foundation ✅
- NextAuth.js 4.24.13 with Prisma Adapter
- Google OAuth provider
- Server-side session strategy

#### Gemini API Integration ✅
- Type system (`types/app.ts`)
- API Routes: `/api/gemini/chat`, `/api/gemini/image`, `/api/gemini/video`
- UI components: `ChatMessage`, `ChatInput`
- Main interface: `app/page.tsx`

#### Phase 4: Conversation Persistence ✅ (2025-11-13)
- **Zod Validators**: `createConversationSchema`, `updateConversationSchema`, `createMessageSchema`
- **Phase 1 API**: POST/GET conversations, POST messages
- **Phase 2 API**: GET list (pagination), PATCH title, DELETE conversation
- **Frontend Integration**: SessionProvider, auto-save conversations, sidebar UI
- **Testing**: 33 Vitest tests (100% endpoint coverage)

**Files Created:**
- `lib/validators.ts` - Conversation API schemas
- `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`
- `app/api/conversations/[id]/messages/route.ts`
- `app/providers.tsx` - SessionProvider wrapper
- `__tests__/api/conversations/*.test.ts` (3 test files, 33 tests)

#### Phase 5: Stripe Integration ✅ (2025-11-13)
- **Step 1 - Checkout Session**: Stripe SDK, checkout API, pricing page
- **Step 2 - Webhook Handlers**: 5 event handlers (checkout.session.completed, invoice.*, subscription.*)
- **Step 3 - Dashboard UI**: Subscription utilities, dashboard page, Customer Portal
- **Step 4 - Usage Limits**: Integrated with all Gemini APIs (auth, limits, logging)
- **Testing**: 55 Vitest tests (37 Stripe + 18 Gemini APIs)

**Plan Restrictions:**
- FREE: Chat/Search only, 100 req/month
- PRO: Chat/Pro/Search/Image, 1000 req/month
- ENTERPRISE: All features + Video, unlimited

**Files Created:**
- `lib/stripe.ts`, `lib/subscription.ts`
- `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`
- `app/api/stripe/subscription/route.ts`, `app/api/stripe/portal/route.ts`
- `app/pricing/page.tsx`, `app/dashboard/page.tsx`
- `__tests__/lib/subscription.test.ts`, `__tests__/api/stripe/*.test.ts`
- `__tests__/api/gemini/*.test.ts` (3 test files)

#### Phase 6 Step 1: Admin Dashboard RBAC ✅ (2025-11-13)
- **Middleware**: Role-Based Access Control for `/admin` routes
- **Admin Layout**: Navigation, shared layout
- **Overview Dashboard**: Key metrics, subscription stats, quick actions

**Files Created:**
- `middleware.ts` - RBAC middleware
- `app/admin/layout.tsx`, `app/admin/page.tsx`

### 🔄 Next Steps

#### Phase 6 Step 2: Admin API Routes (PENDING)
- GET /api/admin/users - List all users with stats
- GET /api/admin/usage - Usage logs with filtering
- PATCH /api/admin/users/[id] - Update user role
- Add Vitest tests

#### Phase 6 Step 3: Admin Pages (PENDING)
- /admin/users - User management UI
- /admin/usage - Usage monitoring dashboard
- /admin/subscriptions - Subscription management

#### Manual Testing (RECOMMENDED)
- Stripe webhooks (Stripe CLI)
- Usage limits (curl commands)
- Admin dashboard (ADMIN role user)

#### Code Review (Codex)
- Security review for Phase 5 & 6
- RBAC validation
- Prisma query performance

## Architecture Pattern

### Next.js App Router Structure
- `app/` - App Router pages and layouts
- `app/api/` - API Route Handlers (server-side only)
- `components/` - React components (mostly client components)
- `lib/` - Utility functions and service layers
- `types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations

### API Security Pattern
- ALL Gemini API calls are server-side only
- `GEMINI_API_KEY` is NEVER exposed to client
- Video downloads use `/api/gemini/video/download` proxy endpoint
- Authentication required for all conversation APIs
- Authorization via userId checks

## Data Models

**User** → **Conversation** → **Message**

- User authenticated via NextAuth.js (Google OAuth)
- Each conversation has a mode (CHAT, PRO, SEARCH, IMAGE, VIDEO)
- Messages have role (USER, MODEL, SYSTEM) and JSON content
- Subscription model supports FREE, PRO, ENTERPRISE plans
- Usage tracking via UsageLog and AuditLog

## Test Status

**Total Tests**: 88 (All passing ✅)

| Category | Tests | Status |
|----------|-------|--------|
| Conversation APIs | 33 | ✅ |
| Stripe Utilities | 23 | ✅ |
| Stripe APIs | 14 | ✅ |
| Gemini APIs | 18 | ✅ |

**Type Check**: ✅ Passing (0 errors)

## Key Files

- `CLAUDE.md` - Comprehensive developer documentation (UPDATED - Phase 6)
- `docs/implementation-plan.md` - Full SaaS migration plan
- `docs/api-design-conversation.md` - Conversation API specification
- `docs/testing-plan.md` - Manual validation guide (NEW - Phases 4 & 5)
- `docs/interface-spec.md` - App ⇔ Infra interface
- `infra/envs/dev/` - Terraform infrastructure code (Codex territory)
- `alpha/` - Old React+Vite app (reference only, DO NOT modify)
- `.serena/memories/` - Serena MCP tool memory files (NEW)
