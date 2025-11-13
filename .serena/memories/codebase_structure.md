# Codebase Structure

## Top-Level Directory Structure

```
/
├── app/                    # Next.js App Router (pages, layouts, API routes)
├── components/             # React components
├── lib/                    # Utility functions and service layers
├── types/                  # TypeScript type definitions
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
├── docs/                   # Documentation
├── infra/                  # Terraform infrastructure code (Codex territory)
├── __tests__/              # Unit tests
├── e2e/                    # E2E tests
├── alpha/                  # Old React+Vite app (DO NOT MODIFY, reference only)
├── .serena/                # Serena MCP tool data
├── .claude/                # Claude Code configuration
└── [config files]          # Various configuration files
```

## App Directory (Next.js App Router)

```
app/
├── layout.tsx                     # Root layout with SessionProvider
├── providers.tsx                  # Client wrapper for SessionProvider (NEW - Phase 4)
├── globals.css                    # Global styles (Tailwind)
├── page.tsx                       # Main chat interface with conversation persistence
├── pricing/
│   └── page.tsx                   # Pricing page with 3 tiers (NEW - Phase 5)
├── dashboard/
│   └── page.tsx                   # User dashboard with subscription & usage (NEW - Phase 5)
├── admin/                         # Admin section (NEW - Phase 6)
│   ├── layout.tsx                 # Admin layout with RBAC navigation
│   └── page.tsx                   # Admin overview dashboard (Server Component)
└── api/                           # API Route Handlers (server-side only)
    ├── auth/
    │   └── [...nextauth]/
    │       └── route.ts           # NextAuth.js authentication
    ├── conversations/             # Conversation APIs (NEW - Phase 4)
    │   ├── route.ts               # POST (create), GET (list)
    │   └── [id]/
    │       ├── route.ts           # GET (read), PATCH (update), DELETE (delete)
    │       └── messages/
    │           └── route.ts       # POST (add message)
    ├── stripe/                    # Stripe APIs (NEW - Phase 5)
    │   ├── checkout/
    │   │   └── route.ts           # POST - Create Checkout Session
    │   ├── webhook/
    │   │   └── route.ts           # POST - Handle Stripe webhooks
    │   ├── subscription/
    │   │   └── route.ts           # GET - Get subscription data
    │   └── portal/
    │       └── route.ts           # POST - Create Customer Portal session
    └── gemini/
        ├── chat/
        │   └── route.ts           # Chat/Pro/Search (with usage limits - Phase 5)
        ├── image/
        │   └── route.ts           # Image generation/editing (with usage limits)
        └── video/
            ├── route.ts           # Video generation (ENTERPRISE only)
            ├── status/
            │   └── route.ts       # Video polling endpoint
            └── download/
                └── route.ts       # Secure video download proxy
```

### API Routes Summary

All API routes are server-side only and use Next.js Route Handlers pattern.

- **POST /api/auth/[...nextauth]** - NextAuth.js authentication (Google OAuth)
- **POST /api/gemini/chat** - Text generation (Chat/Pro/Search modes)
- **POST /api/gemini/image** - Image generation/editing (Imagen 4.0)
- **POST /api/gemini/video** - Video generation (Veo 3.1)
- **POST /api/gemini/video/status** - Video operation status polling
- **GET /api/gemini/video/download** - Secure video download proxy

### Conversation API Routes (Phase 4 - COMPLETED)

- **POST /api/conversations** - Create new conversation (requires auth)
- **GET /api/conversations** - List user's conversations (with pagination, mode filtering)
- **GET /api/conversations/[id]** - Get conversation with messages (requires ownership)
- **PATCH /api/conversations/[id]** - Update conversation title (requires ownership)
- **DELETE /api/conversations/[id]** - Delete conversation (cascade delete messages)
- **POST /api/conversations/[id]/messages** - Add message to conversation (requires ownership)

### Stripe API Routes (Phase 5 - COMPLETED)

- **POST /api/stripe/checkout** - Create Checkout Session for subscription
- **POST /api/stripe/webhook** - Handle Stripe webhook events (signature verification)
- **GET /api/stripe/subscription** - Get user's subscription data with usage stats
- **POST /api/stripe/portal** - Create Customer Portal session

### Admin API Routes (Phase 6 - IN PROGRESS)

- **GET /api/admin** - Admin overview dashboard (Server Component, not API)
- Future routes (Step 2):
  - GET /api/admin/users - List all users with subscription/usage stats
  - GET /api/admin/usage - Usage logs with filtering
  - PATCH /api/admin/users/[id] - Update user role

## Components Directory

```
components/
├── ChatMessage.tsx         # Message display component
│                           # - Handles text, images, videos, sources
│                           # - Image editing UI
│                           # - Loading states
├── ChatInput.tsx           # Input area component
│                           # - Mode selector (Chat/Pro/Search/Image/Video)
│                           # - DJ Shacho Mode toggle
│                           # - File upload (image/video validation)
│                           # - Textarea with auto-resize
└── icons.tsx               # SVG icon components
                            # - VideoIcon, ImageIcon, SearchIcon, etc.
```

### Component Pattern

All components follow this structure:
1. Client directive (`'use client'`) if needed
2. Imports (React, Next.js, types, utilities)
3. Props interface definition
4. Component function with:
   - Hooks and refs
   - State
   - Effects
   - Event handlers
   - Render helpers
   - JSX return

## Lib Directory (Service Layer)

```
lib/
├── auth.ts                  # NextAuth.js configuration
│                            # - authOptions with Prisma adapter
│                            # - Google OAuth provider
│                            # - Session strategy
├── prisma.ts                # Prisma Client singleton
│                            # - Prevents multiple instances in dev mode
├── gemini.ts                # Gemini API service wrapper
│                            # - Server-side only
│                            # - Wrapper for @google/genai SDK
│                            # - Error handling
├── stripe.ts                # Stripe service utilities (NEW - Phase 5)
│                            # - Stripe client singleton
│                            # - getOrCreateStripeCustomer()
│                            # - getPlanIdFromStripeSubscription()
│                            # - isEventProcessed() - Idempotency check
├── subscription.ts          # Subscription management utilities (NEW - Phase 5)
│                            # - getUserSubscription() - Get subscription with plan
│                            # - hasActiveSubscription() - Check active status
│                            # - getMonthlyUsageCount() - Get current month's usage
│                            # - checkSubscriptionLimits() - Validate action against limits
│                            # - formatBillingPeriod(), getDaysUntilBilling(), etc.
├── constants.ts             # App-wide constants
│                            # - GEMINI_MODELS
│                            # - DJ_SHACHO_SYSTEM_PROMPT
│                            # - ASPECT_RATIOS
├── validators.ts            # Zod schemas (UPDATED - Phase 4)
│                            # - Prisma JSON field schemas (PlanFeaturesSchema, etc.)
│                            # - Conversation API schemas (NEW):
│                            #   - createConversationSchema
│                            #   - updateConversationSchema
│                            #   - createMessageSchema
└── fileUtils.ts             # File/base64 utilities
                             # - File type detection
                             # - Base64 conversion helpers
```

### Important Notes

- **lib/auth.ts**: Contains `authOptions` for NextAuth.js, used in API routes
- **lib/gemini.ts**: All Gemini API calls MUST go through this service (server-side only)
- **lib/validators.ts**: Currently validates Prisma JSON fields, NOT API request/response
  - Need to add conversation API validators separately

## Types Directory

```
types/
└── app.ts                  # Core application types
                            # - Message, ContentPart
                            # - Media, GroundingSource
                            # - GenerationMode, Role, AspectRatio
                            # - Request/Response types for Gemini APIs
```

### Type System

- **Message**: Core message structure with role and parts
- **ContentPart**: Union type for text, image, video, sources
- **Media**: Image/video media objects
- **GenerationMode**: 'chat' | 'pro' | 'search' | 'image' | 'video'
- **Role**: 'user' | 'model' (aligned with Gemini API)

## Prisma Directory

```
prisma/
└── schema.prisma           # Database schema
                            # - User, Account, Session (NextAuth.js)
                            # - Conversation, Message
                            # - Plan, Subscription, PaymentEvent
                            # - UsageLog, AuditLog
```

### Database Models

**Authentication**:
- User → Account (OAuth)
- User → Session (NextAuth.js)

**Content**:
- User → Conversation → Message
- Conversation has GenerationMode enum
- Message has MessageRole enum and JSON content

**Billing**:
- User → Subscription → Plan
- Subscription → PaymentEvent (Stripe webhooks)

**Tracking**:
- User → UsageLog (API usage)
- AuditLog (admin actions)

## Public Directory

```
public/
└── DJ_Shacho_400x400.jpg   # DJ Shacho avatar image
```

## Docs Directory

```
docs/
├── implementation-plan.md           # Full SaaS migration plan
├── api-design-conversation.md       # Conversation API specification
├── interface-spec.md                # App ⇔ Infra interface
└── handoff-2025-11-13.md            # Latest handoff notes
```

## Infrastructure Directory (Codex Territory)

```
infra/
└── envs/
    └── dev/
        ├── main.tf                  # Terraform main configuration
        ├── variables.tf             # Variable definitions
        ├── terraform.tfvars         # Variable values
        ├── outputs.tf               # Output definitions
        └── dev.plan                 # Latest Terraform plan
```

**IMPORTANT**: Claude Code should NOT modify infra/ directory. This is Codex's responsibility.

## Middleware (Phase 6 - RBAC)

```
middleware.ts                # Role-Based Access Control (NEW - Phase 6)
                             # - Protects /admin routes
                             # - Redirects to login if no session
                             # - Returns 403 if role !== 'ADMIN'
```

## Tests Directory (NEW - Phase 4 & 5)

```
__tests__/
├── api/
│   ├── conversations/              # Conversation API tests (33 tests)
│   │   ├── list.test.ts            # GET/POST /api/conversations (9 tests)
│   │   ├── conversation-id.test.ts # GET/PATCH/DELETE /api/conversations/[id] (13 tests)
│   │   └── messages.test.ts        # POST /api/conversations/[id]/messages (8 tests)
│   ├── stripe/                     # Stripe API tests (14 tests)
│   │   ├── subscription.test.ts    # GET /api/stripe/subscription (6 tests)
│   │   └── portal.test.ts          # POST /api/stripe/portal (8 tests)
│   └── gemini/                     # Gemini API tests (18 tests)
│       ├── chat.test.ts            # POST /api/gemini/chat (6 tests)
│       ├── image.test.ts           # POST /api/gemini/image (6 tests)
│       └── video.test.ts           # POST /api/gemini/video (6 tests)
└── lib/
    └── subscription.test.ts        # Subscription utilities tests (23 tests)
```

**Test Strategy:**
- Direct Route Handler imports (Next.js 14 App Router pattern)
- Mock Prisma for isolated, fast tests
- Mock NextAuth sessions for authentication tests
- Mock Stripe SDK for webhook and API tests
- 88 total tests, all passing ✅

## Configuration Files

### TypeScript
- **tsconfig.json**: TypeScript compiler config
  - Strict mode enabled
  - Path alias: `@/*` → project root
  - Excludes: node_modules, alpha

### Linting & Formatting
- **.eslintrc.json**: ESLint configuration
  - Next.js + TypeScript + Prettier
  - 4-space indentation, single quotes, semicolons
- **.prettierrc**: Prettier configuration
  - 4 spaces, single quotes, 100 char width

### Next.js
- **next.config.js**: Next.js configuration
  - ESLint disabled during builds (ESLint 9 compatibility)
  - Future configuration for image domains, etc.

### Tailwind CSS
- **tailwind.config.js**: Tailwind CSS v4 configuration
- **postcss.config.js**: PostCSS configuration with Tailwind plugin

### Testing
- **vitest.config.ts**: Vitest unit test configuration
- **vitest.setup.ts**: Test setup file
- **playwright.config.ts**: Playwright E2E test configuration

### Docker & CI/CD
- **Dockerfile**: Multi-stage Docker build for Cloud Run
- **cloudbuild.yaml**: Cloud Build CI/CD pipeline

### Environment
- **.env.example**: Example environment variables
- **.env.local**: Local environment variables (gitignored)

### Git
- **.gitignore**: Git ignore rules
  - node_modules, .next, .env.local
  - Terraform state files (*.tfstate)

## Key Design Patterns

### API Route Pattern
1. Authentication check (`getServerSession`)
2. Input validation (Zod)
3. Authorization check (userId ownership)
4. Business logic
5. Error handling with try-catch
6. JSON response

### State Management Pattern
- React useState for UI state
- useRef for avoiding race conditions
- useEffect for side effects (blob cleanup, auto-scroll)
- No global state management (yet)

### Security Pattern
- Server-side API key usage only
- NextAuth.js session verification
- userId-based resource ownership
- Zod validation for all inputs

### Testing Pattern
- Unit tests in `__tests__/` directory
- E2E tests in `e2e/` directory
- Test file naming: `*.test.ts` or `*.spec.ts`
