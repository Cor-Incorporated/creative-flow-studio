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
├── providers.tsx                  # Client wrapper for SessionProvider
├── globals.css                    # Global styles (Tailwind v4)
├── icon.svg                       # SVG favicon (Next.js 14)
├── page.tsx                       # Main chat interface + LandingPage
├── pricing/
│   └── page.tsx                   # Pricing page (FREE/PRO/ENTERPRISE)
├── dashboard/
│   └── page.tsx                   # User dashboard (subscription, usage)
├── admin/                         # Admin section (RBAC protected)
│   ├── layout.tsx                 # Admin layout with navigation
│   ├── page.tsx                   # Overview dashboard
│   ├── users/
│   │   └── page.tsx               # User management UI
│   └── usage/
│       └── page.tsx               # Usage monitoring dashboard
└── api/                           # API Route Handlers
    ├── auth/
    │   └── [...nextauth]/route.ts # NextAuth.js authentication
    ├── conversations/
    │   ├── route.ts               # POST (create), GET (list)
    │   └── [id]/
    │       ├── route.ts           # GET, PATCH, DELETE
    │       └── messages/route.ts  # POST (add message)
    ├── stripe/
    │   ├── checkout/route.ts      # POST - Checkout Session
    │   ├── webhook/route.ts       # POST - Webhook handler
    │   ├── subscription/route.ts  # GET - Subscription data
    │   └── portal/route.ts        # POST - Customer Portal
    ├── gemini/
    │   ├── chat/route.ts          # Chat/Pro/Search modes
    │   ├── image/route.ts         # Image generation/editing
    │   └── video/
    │       ├── route.ts           # Video generation
    │       ├── status/route.ts    # Polling endpoint
    │       └── download/route.ts  # Secure download proxy
    ├── admin/
    │   ├── users/
    │   │   ├── route.ts           # GET - List users
    │   │   └── [id]/route.ts      # PATCH - Update role
    │   ├── usage/route.ts         # GET - Usage logs
    │   └── stats/route.ts         # GET - System stats
    └── debug/
        └── env/route.ts           # Debug endpoint
```

## Components Directory

```
components/
├── ChatMessage.tsx         # Message display (text, images, videos, sources)
├── ChatInput.tsx           # Input controls (mode selector, DJ Shacho toggle, file upload)
├── icons.tsx               # SVG icon components
├── LandingPage.tsx         # Landing page for unauthenticated users
└── Toast.tsx               # Toast notification system with useToast hook
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

## Tests Directory

```
__tests__/
├── example.test.ts                 # Example tests (3 tests)
├── app/
│   └── admin/
│       ├── users.test.tsx          # Admin users page tests (13 tests)
│       └── usage.test.tsx          # Admin usage page tests (13 tests)
├── utils/
│   └── test-helpers.ts             # Test data factories
├── lib/
│   └── subscription.test.ts        # Subscription utilities (23 tests)
└── api/
    ├── conversations/
    │   ├── list.test.ts            # GET/POST /api/conversations (9 tests)
    │   ├── conversation-id.test.ts # GET/PATCH/DELETE (13 tests)
    │   └── messages.test.ts        # POST messages (8 tests)
    ├── stripe/
    │   ├── subscription.test.ts    # GET subscription (6 tests)
    │   └── portal.test.ts          # POST portal (8 tests)
    ├── gemini/
    │   ├── chat.test.ts            # Chat API (6 tests)
    │   ├── image.test.ts           # Image API (6 tests)
    │   └── video.test.ts           # Video API (6 tests)
    └── admin/
        ├── users.test.ts           # Users API (7 tests)
        ├── users-update.test.ts    # Role update (5 tests)
        ├── usage.test.ts           # Usage API (6 tests)
        └── stats.test.ts           # Stats API (5 tests)
```

**Test Strategy:**
- Direct Route Handler imports (Next.js 14 App Router pattern)
- Mock Prisma for isolated, fast tests
- Mock NextAuth sessions for authentication tests
- Mock Stripe SDK for webhook and API tests
- 136 total tests, all passing ✅

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
