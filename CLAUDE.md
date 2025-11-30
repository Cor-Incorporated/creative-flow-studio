# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Creative Flow Studio is a multimodal AI SaaS application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions. The app features a DJ Shacho Mode that applies a unique persona (high-energy, Kyushu dialect speaking entrepreneur) to text responses.

## Branch Strategy

- **main**: Alpha version (React + Vite frontend-only), deployed to Vercel
- **dev**: Next.js 14 full-stack SaaS (CURRENT DEVELOPMENT BRANCH)
- **feature/admin-dashboard-final**: Current working branch

**IMPORTANT:** You are currently working on the `dev` branch. This document describes the Next.js implementation.

---

## Current Status (2025-11-30)

### ✅ Completed Features

| Feature | Status | Tests |
|---------|--------|-------|
| Environment Setup (Next.js 14, Prisma, Tailwind v4) | ✅ | - |
| Authentication (NextAuth.js + Google OAuth) | ✅ | - |
| Gemini API (Chat/Pro/Search/Image/Video) | ✅ | 18 |
| Conversation Persistence (CRUD + Messages) | ✅ | 33 |
| Stripe Integration (Checkout/Portal/Webhooks) | ✅ | 37 |
| Subscription Utilities | ✅ | 23 |
| Admin Dashboard (RBAC + Users/Usage) | ✅ | 48 |
| Shared API Utilities | ✅ | 14 |
| Validators | ✅ | 9 |
| Landing Page & Auth UX (Toast notifications) | ✅ | - |

**Total Tests**: 185 passing ✅

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
│   ├── auth.ts                    # NextAuth configuration
│   ├── prisma.ts                  # Prisma client singleton
│   ├── gemini.ts                  # Gemini API service
│   ├── stripe.ts                  # Stripe utilities
│   ├── subscription.ts            # Subscription management
│   ├── validators.ts              # Zod schemas
│   ├── api-utils.ts               # Shared API utilities (auth, errors)
│   ├── constants.ts               # App-wide constants
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

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/*` | * | NextAuth.js |
| `/api/conversations` | GET, POST | List/Create conversations |
| `/api/conversations/[id]` | GET, PATCH, DELETE | Conversation CRUD |
| `/api/conversations/[id]/messages` | POST | Add message |
| `/api/stripe/checkout` | POST | Create checkout session |
| `/api/stripe/portal` | POST | Customer portal |
| `/api/stripe/webhook` | POST | Stripe webhooks |
| `/api/stripe/subscription` | GET | Subscription data |
| `/api/gemini/chat` | POST | Chat/Pro/Search |
| `/api/gemini/image` | POST | Image generation/editing |
| `/api/gemini/video` | POST | Video generation |
| `/api/gemini/video/status` | POST | Polling |
| `/api/gemini/video/download` | GET | Secure download |
| `/api/admin/users` | GET | List users (ADMIN) |
| `/api/admin/users/[id]` | PATCH | Update role (ADMIN) |
| `/api/admin/usage` | GET | Usage logs (ADMIN) |
| `/api/admin/stats` | GET | System stats (ADMIN) |

---

## Security

### Critical Rules

1. **API Key Handling**: ALL Gemini API calls are server-side only. `GEMINI_API_KEY` is NEVER exposed to client.
2. **Video Downloads**: Use `/api/gemini/video/download` proxy endpoint.
3. **Authentication**: NextAuth.js session required for all protected APIs.
4. **Authorization**: Users can only access their own conversations (userId check).
5. **Admin Routes**: Protected by RBAC middleware (ADMIN role required).

### Usage Limits

| Plan | Features | Limit |
|------|----------|-------|
| FREE | Chat/Search | 100 req/month |
| PRO | Chat/Pro/Search/Image | 1000 req/month |
| ENTERPRISE | All + Video | Unlimited |

HTTP Status Codes:
- 401 Unauthorized - No session
- 403 Forbidden - Feature not in plan
- 429 Too Many Requests - Monthly limit exceeded

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
```

**Client-Side:**

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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

## DJ Shacho Mode

Special persona mode applying DJ Shacho (Shunsuke Kimoto) speaking style.

**Characteristics:**
- High-energy, enthusiastic tone
- Kyushu dialect (博多弁)
- First-person: 「俺」

**Implementation:**
- Toggle in `ChatInput` component
- `DJ_SHACHO_SYSTEM_PROMPT` in `lib/constants.ts`
- Error messages converted to DJ Shacho style

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

**Last Updated**: 2025-11-30
**Current Focus**: Documentation update and codebase improvements

**Recent Changes:**

- Added `lib/api-utils.ts` with shared API utilities (requireAuth, requireAdmin, errorResponse, handleValidationError, handleSubscriptionLimitError)
- Added tests for api-utils.ts (14 tests) and validators.ts (9 tests)
- Test count increased from 136 to 185

**Pending for Cursor:**

1. Setup NextAuth environment variables on Cloud Run
2. Register Google OAuth redirect URI
3. Optimize N+1 query in admin users API

**Test Status**: 185/185 passing ✅
