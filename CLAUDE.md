# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

BulnaAI is a multimodal AI SaaS application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions. The app features an Influencer Mode that allows selecting different AI personas (DJ Shacho, etc.) to customize text responses.

## Branch Strategy

- **main**: Alpha version (React + Vite frontend-only), deployed to Vercel
- **dev**: Next.js 14 full-stack SaaS (CURRENT DEVELOPMENT BRANCH)
- **feature/admin-dashboard-final**: Current working branch

**IMPORTANT:** You are currently working on the `dev` branch. This document describes the Next.js implementation.

---

## Current Status (2025-12-17)

### ✅ Completed Features

| Feature                                                      | Status | Tests |
|--------------------------------------------------------------|--------|-------|
| Environment Setup (Next.js 14, Prisma, Tailwind v4)          | ✅      | -     |
| Authentication (NextAuth.js + Google OAuth + Email/Password) | ✅      | -     |
| Gemini API (Chat/Pro/Search/Image/Video)                     | ✅      | 18    |
| Conversation Persistence (CRUD + Messages)                   | ✅      | 33    |
| Stripe Integration (Checkout/Portal/Webhooks)                | ✅      | 37    |
| Subscription Utilities                                       | ✅      | 23    |
| Admin Dashboard (RBAC + Users/Usage)                         | ✅      | 48    |
| Shared API Utilities                                         | ✅      | 14    |
| Validators                                                   | ✅      | 9     |
| Landing Page & Auth UX (Toast notifications)                 | ✅      | -     |
| Influencer Mode (DJ Shacho)                            | ✅      | -     |
| Chat Sidebar (New chat, History, Delete)                     | ✅      | -     |
| Password Visibility Toggle                                   | ✅      | -     |
| Mobile Responsive Design                                     | ✅      | -     |
| Mode Switching (Chat/Pro/Search/Image/Video)                 | ✅      | 360   |

**Total Tests**: 519 passing ✅

### 🔄 Pending (Infrastructure - Cursor)

1. **Cloud Run Auth Setup**: NextAuth environment variables not configured
2. **Google OAuth**: Redirect URI not registered
3. **N+1 Query**: Admin users API optimization needed

---

## Architecture

### Tech Stack

- **Framework**: Next.js 14.2.33 (App Router)
- **Language**: TypeScript 5.9.3
- **Database**: PostgreSQL via Prisma 6.19.0
- **Authentication**: NextAuth.js 4.24.13 + Prisma Adapter
- **AI SDK**: @google/genai 1.29.0
- **Payments**: Stripe SDK v19.3.1
- **Styling**: Tailwind CSS 4.1.17
- **Validation**: Zod 4.1.12
- **Testing**: Vitest 4.0.8 + Playwright 1.56.1

### File Structure

```
/
├── app/                           # Next.js App Router
│   ├── page.tsx                   # Main chat + LandingPage
│   ├── layout.tsx                 # Root layout with SessionProvider
│   ├── globals.css                # Tailwind v4 styles
│   ├── icon.svg                   # SVG favicon
│   ├── providers.tsx              # SessionProvider wrapper
│   ├── pricing/page.tsx           # Pricing tiers
│   ├── dashboard/page.tsx         # User dashboard
│   ├── auth/                      # Authentication pages
│   │   ├── signin/page.tsx        # Login/Register page
│   │   └── error/page.tsx         # Auth error page
│   ├── admin/                     # Admin dashboard (RBAC protected)
│   │   ├── layout.tsx             # Admin layout
│   │   ├── page.tsx               # Overview dashboard
│   │   ├── users/page.tsx         # User management
│   │   └── usage/page.tsx         # Usage monitoring
│   └── api/
│       ├── auth/[...nextauth]/    # NextAuth.js
│       ├── conversations/         # CRUD + messages
│       ├── stripe/                # Checkout, portal, webhook, subscription
│       ├── gemini/                # Chat, image, video (+ status, download)
│       └── admin/                 # Users, usage, stats
├── components/
│   ├── LandingPage.tsx            # Landing page for unauthenticated users
│   ├── Toast.tsx                  # Toast notification system
│   ├── ChatMessage.tsx            # Message display
│   ├── ChatInput.tsx              # Input controls
│   └── icons.tsx                  # SVG icons
├── lib/
│   ├── auth.ts                    # NextAuth configuration (Google + Credentials)
│   ├── password.ts                # Password hashing utilities (PBKDF2)
│   ├── prisma.ts                  # Prisma client singleton
│   ├── gemini.ts                  # Gemini API service
│   ├── stripe.ts                  # Stripe utilities
│   ├── subscription.ts            # Subscription management
│   ├── validators.ts              # Zod schemas
│   ├── api-utils.ts               # Shared API utilities (auth, errors)
│   ├── constants.ts               # App-wide constants + Influencer configs
│   └── fileUtils.ts               # File utilities
├── types/app.ts                   # TypeScript types
├── prisma/schema.prisma           # Database schema
├── middleware.ts                  # RBAC middleware
├── __tests__/                     # Unit tests (185 tests)
├── e2e/                           # E2E tests
├── docs/                          # Documentation
└── infra/                         # Terraform (Codex territory)
```

### API Routes

| Route                              | Method             | Description               |
|------------------------------------|--------------------|---------------------------|
| `/api/auth/*`                      | *                  | NextAuth.js               |
| `/api/conversations`               | GET, POST          | List/Create conversations |
| `/api/conversations/[id]`          | GET, PATCH, DELETE | Conversation CRUD         |
| `/api/conversations/[id]/messages` | POST               | Add message               |
| `/api/stripe/checkout`             | POST               | Create checkout session   |
| `/api/stripe/portal`               | POST               | Customer portal           |
| `/api/stripe/webhook`              | POST               | Stripe webhooks           |
| `/api/stripe/subscription`         | GET                | Subscription data         |
| `/api/gemini/chat`                 | POST               | Chat/Pro/Search           |
| `/api/gemini/image`                | POST               | Image generation/editing  |
| `/api/gemini/video`                | POST               | Video generation          |
| `/api/gemini/video/status`         | POST               | Polling                   |
| `/api/gemini/video/download`       | GET                | Secure download           |
| `/api/admin/users`                 | GET                | List users (ADMIN)        |
| `/api/admin/users/[id]`            | PATCH              | Update role (ADMIN)       |
| `/api/admin/usage`                 | GET                | Usage logs (ADMIN)        |
| `/api/admin/stats`                 | GET                | System stats (ADMIN)      |

---

## Security

### Critical Rules

1. **API Key Handling**: ALL Gemini API calls are server-side only. `GEMINI_API_KEY` is NEVER exposed to client.
2. **Video Downloads**: Use `/api/gemini/video/download` proxy endpoint.
3. **Authentication**: NextAuth.js session required for all protected APIs.
4. **Authorization**: Users can only access their own conversations (userId check).
5. **Admin Routes**: Protected by RBAC middleware (ADMIN role required).

### Usage Limits

| Plan       | Features              | Limit          |
|------------|-----------------------|----------------|
| FREE       | Chat/Search           | 100 req/month  |
| PRO        | Chat/Pro/Search/Image | 1000 req/month |
| ENTERPRISE | All + Video           | Unlimited      |

HTTP Status Codes:
- 401 Unauthorized - No session
- 403 Forbidden - Feature not in plan
- 429 Too Many Requests - Monthly limit exceeded

---

## UX / Error Handling Conventions (Must-follow)

### Auth Errors (NextAuth)

- **Where**: NextAuth errors are routed to `/auth/error?error=<CODE>`.
- **Display**: The UI must show a **user-friendly Japanese message** for each `error` code.
- **Important**: We do **not** auto-link OAuth accounts to existing credentials users unless we have a **verified email** flow for credentials (pre-hijacking risk). This is why `allowDangerousEmailAccountLinking` is disabled.

### API Errors (App Routes)

- **Contract**: API routes should return structured JSON errors using `jsonError()` from `lib/api-utils.ts`.
- **Required fields**:
  - `error`: user-facing short message (Japanese where applicable)
  - `code`: stable error code (e.g. `UNAUTHORIZED`, `VALIDATION_ERROR`, `FORBIDDEN_PLAN`, `RATE_LIMIT_EXCEEDED`, `UPSTREAM_ERROR`)
  - `requestId`: support/debug identifier
  - Response header `X-Request-Id` must match `requestId`
- **Frontend behavior**:
  - Show errors via **Toast** and/or inline message.
  - Include `requestId` as a **“サポートID”** in the user-facing message when present.
  - For actionable errors, include a CTA:
    - `UNAUTHORIZED` → login CTA
    - `FORBIDDEN_PLAN` / `RATE_LIMIT_EXCEEDED` → pricing CTA

---

## Development

### Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm run type-check       # TypeScript check
npm test                 # Vitest
npm run test:e2e         # Playwright
npm run lint             # ESLint
npm run format           # Prettier
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Prisma Studio
```

### Environment Variables

**Server-Side (NEVER expose):**

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GEMINI_API_KEY="..."
CRON_SECRET="..."  # Required in production for cron endpoints
```

**Client-Side:**

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPPORT_EMAIL="support@creative-flow.studio"  # Support contact email
```

### Model IDs

```typescript
export const GEMINI_MODELS = {
    FLASH: 'gemini-2.5-flash',
    PRO: 'gemini-2.5-pro',
    FLASH_IMAGE: 'gemini-2.5-flash-image',
    IMAGEN: 'imagen-4.0',
    VEO: 'veo-3.1-fast',
};
```

---

## Development Tools

### Claude Code (This Tool)

- Next.js frontend/backend implementation
- API Routes development
- React components
- Testing (Vitest/Playwright)
- Documentation

### Cursor

- Cloud infrastructure (GCP, Terraform)
- Secret Manager / environment setup
- Cloud Run deployments
- Backend performance optimization

### Codex

- Code review (security, architecture)
- Requirements validation
- No external access (review only)

---

## Influencer Mode

Selectable AI persona mode that applies different influencer speaking styles.

**Available Personas:**

| ID          | Name      | Description                              |
|-------------|-----------|------------------------------------------|
| `dj_shacho` | DJ社長    | Repezen Foxx leader, 九州弁, high-energy |

| `none`      | OFF       | Default AI assistant                     |

**Implementation:**
- Dropdown selector in `ChatInput` component
- `INFLUENCERS` config object in `lib/constants.ts`
- `getInfluencerConfig(id)` helper function
- Error messages styled to match selected influencer
- Initial greeting changes based on selection

**Adding New Influencers:**
1. Add new config to `INFLUENCERS` in `lib/constants.ts`
2. Define `systemPrompt`, `initialMessage`, `temperature`
3. Add avatar image to `/public/` if needed
4. Update `ChatMessage.tsx` avatar logic

---

## GCP Setup

**Project**: `dataanalyticsclinic`
**Region**: `asia-northeast1`
**Cloud Run URL**: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`

**Service Accounts:**
- `cloud-run-runtime@...` - Cloud Run execution
- `terraform@...` - Terraform management

**Terraform State**: `gs://dataanalyticsclinic-terraform-state`

---

## Common Issues

### ESLint 9 Errors

ESLint disabled during builds (`next.config.js`). Run `npm run lint` separately.

### Prisma (Cloud Run) で会話詳細が500になる（ネスト include の回避）

Cloud Run（Postgres）環境で、Prismaの **ネストした `include`** が環境依存のSQLを生成し、`42809 WITHIN GROUP is required...` のようなエラーで **500** になることがあります。

- **推奨パターン（Cloud Run）**: `include` で関連をネスト取得しない  
  - 例: `Conversation` を `select` で取得 → `Message` を `findMany` で別クエリ取得（`orderBy createdAt asc`）
- **一覧系エンドポイント**（例: `/api/conversations`）は **明示 `select`** と `_count` を使う（安易に `include` を多用しない）
- **備考**: 本対応は PR #33（`feature/fix-conversation-detail-500`）で適用済み

### Prisma Client Not Found

Run `npm run prisma:generate` or `npm run build`.

### NextAuth Session Null

1. Check `.env.local` has all auth variables
2. Verify `NEXTAUTH_URL` matches current URL
3. Ensure database connection works

### Video Download Fails

Use `/api/gemini/video/download` proxy, NOT direct URI.

---

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Stripe Documentation](https://stripe.com/docs)

---

## Session Notes

**Last Updated**: 2025-12-17
**Current Focus**: Mode switching bug fixes and comprehensive test coverage

**Recent Changes (This Session):**

### Mode Switching Bug Fixes (2025-12-17)

Fixed critical bugs in mode switching functionality to ensure proper conversation history and mode persistence:

1. **BUG-1 & BUG-5: saveMessage mode parameter** - Fixed `saveMessage` calls to pass explicit mode parameter instead of relying on state, preventing mode mismatch in database
   - Updated `app/page.tsx` in all generation handlers (handleSend, handleImageGeneration, handleVideoGeneration)
   - Ensures saved messages always reflect the actual mode used for generation

2. **BUG-2: History filtering** - Added filtering to exclude image/video-only messages from chat history
   - Created `getChatHistory()` helper function that filters by mode
   - Prevents image/video content from interfering with text-only chat context
   - Only includes messages with mode 'chat', 'pro', or 'search'

3. **BUG-3: Video generation race condition** - Fixed async polling race condition by capturing mode value before async operations
   - Stored `currentMode` in local variable before `pollVideoStatus` call
   - Prevents mode from changing during video generation polling
   - Ensures video completion uses correct mode for saving

4. **BUG-4: Auto mode switch for image uploads** - Added automatic mode switch to 'search' when images are uploaded
   - Updated `ChatInput.tsx` to detect image uploads and switch mode
   - Provides better UX by automatically enabling multimodal analysis
   - Includes toast notification to inform users of the mode switch

### New Test Files Added

- `__tests__/app/page-mode-handling.test.ts` - Mode switching and conversation history tests (21 tests)
- `__tests__/scenarios/multi-mode-flow.test.ts` - Multi-mode conversation flow integration tests (57 tests)
- `e2e/mode-switching.spec.ts` - End-to-end mode switching tests (3 tests)

**Test Status**: 519/519 passing ✅ (increased from 185)

---

### Previous Session (2025-12-01)

- Fixed Tailwind v4 CSS issues - added `@source` directives for `lib` and `types` directories
- Added Email/Password authentication with CredentialsProvider
  - New `lib/password.ts` for PBKDF2 password hashing
  - New `/app/auth/signin/page.tsx` and `/app/auth/error/page.tsx`
  - Updated NextAuth config to JWT session strategy
  - Added `password` field to User model in Prisma schema
- Refactored DJ Shacho Mode to Influencer Mode
  - New `INFLUENCERS` config object in `lib/constants.ts`
  - Dropdown selector instead of toggle
  - Updated ChatInput, ChatMessage, and page.tsx components
- Added Admin Dashboard documentation (`docs/admin-dashboard.md`)
- Updated CLAUDE.md with new features
- Added password visibility toggle (EyeIcon/EyeSlashIcon in signin page)
- Improved mobile responsive design across all pages
- Added iOS zoom prevention (font-size: 16px)
- Added safe-area-inset support for notched devices
- Enhanced ChatInput with auto-resize functionality
- Updated pricing plans based on Google Gemini API costs:
  - FREE: ¥0/month, 50 requests/month
  - PRO: ¥3,000/month, 500 requests/month
  - ENTERPRISE: ¥30,000/month, 3,000 requests/month + 50 videos/month
- Added "Back to Chat" button on pricing page
- Updated prisma/seed.sql with new plan data

**Pending for Cursor:**

1. Setup NextAuth environment variables on Cloud Run
2. Register Google OAuth redirect URI
3. Optimize N+1 query in admin users API
4. Run `prisma migrate dev` to add password field to users table

**Migration Required:**
```bash
npm run prisma:migrate
# Creates migration for new `password` field on User model
```
