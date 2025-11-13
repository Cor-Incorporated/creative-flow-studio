# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Creative Flow Studio is a multimodal AI SaaS application that integrates multiple Google Gemini AI capabilities into a single chat interface. It supports text generation (chat, pro mode with thinking, search-grounded), image generation/editing (Imagen 4.0), video generation (Veo 3.1), and multimodal interactions. The app features a DJ Shacho Mode that applies a unique persona (high-energy, Kyushu dialect speaking entrepreneur) to text responses.

## Branch Strategy

- **main**: Alpha version (React + Vite frontend-only), deployed to Vercel
- **dev**: Next.js 14 full-stack SaaS (CURRENT DEVELOPMENT BRANCH)

**IMPORTANT:** You are currently working on the `dev` branch. This document describes the Next.js implementation, not the alpha version.

---

## Current Status (dev branch - 2025-11-13)

### What's Been Completed

#### ✅ Phase 2: Environment Setup (COMPLETED)

- Next.js 14 (App Router) project initialized with TypeScript
- Prisma ORM configured with PostgreSQL schema
- Development tools: ESLint, Prettier, Vitest, Playwright
- Tailwind CSS v4 with PostCSS configuration
- Path aliases configured (`@/` → project root)

#### ✅ Phase 3: Authentication Foundation (COMPLETED)

- NextAuth.js 4.24.13 installed with Prisma Adapter
- Google OAuth provider configured
- Server-side session strategy with database persistence
- Environment variable validation in `lib/auth.ts`
- Custom pages removed (will be implemented when needed)

#### ✅ Gemini API Integration (COMPLETED)

**Type System:**

- `types/app.ts`: Complete type definitions for messages, media, content parts
- Zod schemas for API request/response validation
- Role types: 'user' | 'model'
- Generation modes: 'chat' | 'pro' | 'search' | 'image' | 'video'

**API Routes (Server-Side):**

- `/api/gemini/chat` - Chat/Pro/Search modes with conversation history
- `/api/gemini/image` - Image generation and editing (Imagen 4.0)
- `/api/gemini/video` - Video generation (Veo 3.1)
- `/api/gemini/video/status` - Video polling endpoint
- `/api/gemini/video/download` - Secure video proxy (no API key exposure)

**Gemini Service Layer:**

- `lib/gemini.ts`: Server-side wrapper for @google/genai SDK
- All API calls use server-side `GEMINI_API_KEY`
- Correct model IDs: `gemini-2.5-flash`, `gemini-2.5-pro`

#### ✅ UI Components Migration (COMPLETED)

- `components/ChatMessage.tsx`: Message display with image/video/text/sources
- `components/ChatInput.tsx`: Mode selector, DJ Shacho toggle, file upload
- `components/icons.tsx`: SVG icon components
- `app/page.tsx`: Main chat interface with full state management

**Main Features in app/page.tsx:**

- Message history with auto-scroll
- DJ Shacho Mode with dynamic greeting messages
- All 5 generation modes (Chat/Pro/Search/Image/Video)
- Video polling with progress and timeout protection
- Image editing workflow
- Blob URL memory management
- Error handling with DJ Shacho style conversion

#### ✅ Security & Compatibility Fixes (COMPLETED)

- Removed `NEXT_PUBLIC_GEMINI_API_KEY` client-side exposure
- Video downloads now use `/api/gemini/video/download` proxy
- ESLint 9 compatibility with `ignoreDuringBuilds: true`
- Gemini API security guidelines compliant

#### ✅ API Design Documentation (COMPLETED)

- `docs/api-design-conversation.md`: Full conversation persistence API spec
- Defined CRUD endpoints for Conversation and Message
- Authentication/authorization requirements documented
- 3-phase implementation plan outlined

#### ✅ Phase 4: Conversation Persistence - Phase 1 (COMPLETED - 2025-11-13)

**Step 1: Validation Schemas** ✅

- ✅ Created Zod schemas in `lib/validators.ts`:
    - `createConversationSchema`
    - `updateConversationSchema` (for Phase 2)
    - `createMessageSchema`

**Step 2: Phase 1 API Implementation (Minimum Viable)** ✅

- ✅ `POST /api/conversations` - Create new conversation
- ✅ `GET /api/conversations/[id]` - Get conversation with messages
- ✅ `POST /api/conversations/[id]/messages` - Add message to conversation
- ✅ All endpoints require NextAuth session authentication
- ✅ User ownership verification (userId check)
- ✅ Proper error handling with Zod validation

**Step 3: Frontend Integration** ✅

- ✅ Added SessionProvider to `app/layout.tsx`
- ✅ Modified `app/page.tsx` to auto-save conversations
- ✅ Create new conversation on first message
- ✅ Save user and model messages for all modes (chat/pro/search/image/video)
- ✅ Best-effort approach: doesn't disrupt UX if save fails

**Files Modified:**
- `lib/validators.ts` - Added conversation API schemas
- `app/api/conversations/route.ts` - POST endpoint
- `app/api/conversations/[id]/route.ts` - GET endpoint
- `app/api/conversations/[id]/messages/route.ts` - POST endpoint
- `app/providers.tsx` - SessionProvider wrapper (new)
- `app/layout.tsx` - Wrapped with Providers
- `app/page.tsx` - Integrated conversation persistence

#### ✅ Phase 4: Conversation Persistence - Phase 2 (COMPLETED - 2025-11-13)

**Step 4: Phase 2 API (Management)** ✅

- ✅ `GET /api/conversations` - List user's conversations with pagination
- ✅ `PATCH /api/conversations/[id]` - Update conversation title
- ✅ `DELETE /api/conversations/[id]` - Delete conversation (Cascade delete messages)
- ✅ All endpoints include proper authentication and authorization
- ✅ Query parameters support (limit, offset, mode filtering)

**Step 5: UI Enhancements** ✅

- ✅ Added sidebar with conversation history
- ✅ Implemented conversation switching (load previous conversations)
- ✅ Added "New Conversation" button
- ✅ Load existing conversations on mount (if authenticated)
- ✅ Delete conversation button with confirmation
- ✅ Mobile-responsive sidebar (hamburger menu)
- ✅ Visual indication of current conversation

**Files Modified:**
- `app/api/conversations/route.ts` - Added GET endpoint for list
- `app/api/conversations/[id]/route.ts` - Added PATCH and DELETE endpoints
- `app/page.tsx` - Integrated sidebar UI and conversation management logic

#### ✅ Phase 4: API Testing (COMPLETED - 2025-11-13)

**Unit Tests for Conversation APIs** ✅

- ✅ Created comprehensive Vitest tests for all Conversation APIs
- ✅ Test coverage: 33 tests passing (100% endpoint coverage)
- ✅ Enhanced `vitest.setup.ts` with environment variable mocks
- ✅ Next.js 14 App Router testing pattern (direct Route Handler imports)
- ✅ Mock Prisma strategy for fast, isolated tests

**Files Created:**
- `__tests__/api/conversations/list.test.ts` - GET/POST /api/conversations (9 tests)
- `__tests__/api/conversations/conversation-id.test.ts` - GET/PATCH/DELETE /api/conversations/[id] (13 tests)
- `__tests__/api/conversations/messages.test.ts` - POST /api/conversations/[id]/messages (8 tests)
- Enhanced `vitest.setup.ts` with environment mocks
- Fixed `lib/validators.ts` - Added `.min(1)` to message content array

### What's Next (Priority Order)

#### 🔄 Phase 5: Stripe Integration (IN PROGRESS - 2025-11-13)

**Step 1: Checkout Session (COMPLETED)** ✅

- ✅ Installed `stripe` SDK (v18.0.0+)
- ✅ Created `lib/stripe.ts` - Stripe client singleton with helper functions
- ✅ Implemented `POST /api/stripe/checkout` - Checkout Session creation
- ✅ Created `POST /api/stripe/webhook` skeleton with signature verification
- ✅ Created `app/pricing/page.tsx` - Pricing UI with 3 tiers (FREE/PRO/ENTERPRISE)
- ✅ Type-checked successfully

**Files Created:**
- `lib/stripe.ts` - Stripe service utility with getOrCreateStripeCustomer()
- `app/api/stripe/checkout/route.ts` - Checkout Session API
- `app/api/stripe/webhook/route.ts` - Webhook skeleton (signature verification only)
- `app/pricing/page.tsx` - Pricing page with Stripe Checkout integration

**Step 2: Webhook Event Handlers (COMPLETED)** ✅

- ✅ Implemented 5 webhook event handlers with full DB integration:
  - `checkout.session.completed` - Create Subscription + PaymentEvent
  - `invoice.paid` - Update subscription status & billing period
  - `invoice.payment_failed` - Mark subscription as PAST_DUE
  - `customer.subscription.updated` - Sync subscription status changes
  - `customer.subscription.deleted` - Mark subscription as CANCELED
- ✅ Added helper functions to `lib/stripe.ts`:
  - `getPlanIdFromStripeSubscription()` - Extract Plan ID from Stripe subscription
  - `isEventProcessed()` - Idempotency check via stripeEventId
- ✅ Idempotency implemented for all event handlers
- ✅ Type-checked successfully (0 errors)
- ✅ All existing tests pass (33/33)

**Files Updated:**
- `app/api/stripe/webhook/route.ts` - Full webhook implementation (~450 lines)
- `lib/stripe.ts` - Added webhook helper functions

**Step 3: Dashboard UI (COMPLETED)** ✅

- ✅ Fixed `apiVersion` in `lib/stripe.ts` to stable version `2024-11-20.acacia` with `@ts-ignore`
- ✅ Removed unnecessary `config.api.bodyParser` export from webhook route
- ✅ Created `lib/subscription.ts` - Subscription management utilities:
  - `getUserSubscription()` - Get user's subscription with plan details
  - `hasActiveSubscription()` - Check active subscription status
  - `getMonthlyUsageCount()` - Get current month's API usage
  - `checkSubscriptionLimits()` - Validate action against plan limits
  - `formatBillingPeriod()` - Format dates for display
  - `getDaysUntilBilling()` - Calculate days until next billing
  - `calculateUsagePercentage()` - Calculate usage percentage
- ✅ Created `GET /api/stripe/subscription` - Get subscription data with usage
- ✅ Created `POST /api/stripe/portal` - Customer Portal session creation
- ✅ Created `app/dashboard/page.tsx` - Full dashboard UI:
  - Current plan display with status badge
  - Billing period and next billing date
  - Usage meter with visual progress bar
  - "サブスクリプション管理" button (opens Customer Portal)
  - Plan features list
- ✅ Added comprehensive Vitest tests (37 new tests):
  - 23 tests for `lib/subscription.ts` utilities
  - 6 tests for `GET /api/stripe/subscription`
  - 8 tests for `POST /api/stripe/portal`
- ✅ All 70 tests passing (33 conversation + 37 stripe)
- ✅ Type-check passes

**Files Created:**
- `lib/subscription.ts` - Subscription utilities (~200 lines)
- `app/api/stripe/subscription/route.ts` - Get subscription API
- `app/api/stripe/portal/route.ts` - Customer Portal API
- `app/dashboard/page.tsx` - Dashboard UI (~450 lines)
- `__tests__/lib/subscription.test.ts` - Utility tests (23 tests)
- `__tests__/api/stripe/subscription.test.ts` - API tests (6 tests)
- `__tests__/api/stripe/portal.test.ts` - API tests (8 tests)

**Files Updated:**
- `lib/stripe.ts` - Fixed apiVersion to `2024-11-20.acacia`
- `app/api/stripe/webhook/route.ts` - Removed unused config export

**Step 4: Usage Limits Integration (COMPLETED)** ✅

- ✅ Integrated `checkSubscriptionLimits()` with all Gemini API routes:
  - `app/api/gemini/chat/route.ts` - Chat/Pro/Search modes
  - `app/api/gemini/image/route.ts` - Image generation/editing
  - `app/api/gemini/video/route.ts` - Video generation
- ✅ Added `logUsage()` calls after successful API responses
- ✅ Implemented proper HTTP status codes:
  - 401 Unauthorized - No session
  - 403 Forbidden - Feature not in plan
  - 429 Too Many Requests - Monthly limit exceeded (with `Retry-After` header)
- ✅ Added NextAuth session authentication to all Gemini endpoints
- ✅ Resource type tracking (gemini-2.5-flash, imagen-4.0, veo-3.1-fast, etc.)
- ✅ Added comprehensive Vitest tests (18 new tests):
  - 6 tests for Chat API (auth, limits, logging)
  - 6 tests for Image API (auth, limits, editing vs generation)
  - 6 tests for Video API (auth, ENTERPRISE-only restriction)
- ✅ All 88 tests passing (70 previous + 18 new)
- ✅ Type-check passes

**Files Updated:**
- `app/api/gemini/chat/route.ts` - Added auth + limits + logging
- `app/api/gemini/image/route.ts` - Added auth + limits + logging
- `app/api/gemini/video/route.ts` - Added auth + limits + logging

**Files Created:**
- `__tests__/api/gemini/chat.test.ts` - Chat API tests (6 tests)
- `__tests__/api/gemini/image.test.ts` - Image API tests (6 tests)
- `__tests__/api/gemini/video.test.ts` - Video API tests (6 tests)

**Plan Restrictions Enforced:**
- FREE Plan: Chat/Search only, 100 req/month
- PRO Plan: Chat/Pro/Search/Image, 1000 req/month
- ENTERPRISE Plan: All features + Video, unlimited requests

#### 🔄 Phase 6: Admin Dashboard (IN PROGRESS - 2025-11-13)

**Step 1: RBAC Infrastructure (COMPLETED)** ✅

- ✅ Created `middleware.ts` - Role-Based Access Control for `/admin` routes:
  - Uses `getToken()` from next-auth/jwt to inspect session
  - Redirects to login if no session
  - Returns 403 JSON if role !== 'ADMIN'
  - Protects all `/admin/*` routes before rendering
- ✅ Created `app/admin/layout.tsx` - Shared admin layout:
  - Admin header with navigation (Overview, Users, Usage, Subscriptions)
  - "Back to App" link
  - Footer with "ADMIN ACCESS ONLY" notice
- ✅ Created `app/admin/page.tsx` - Overview dashboard (Server Component):
  - Fetches stats via Prisma (total users, conversations, messages, subscriptions)
  - Displays 6 key metrics in card grid
  - Shows active subscriptions by plan (groupBy)
  - Quick action buttons to other admin pages

**Files Created:**
- `middleware.ts` - RBAC middleware (~70 lines)
- `app/admin/layout.tsx` - Admin layout (~90 lines)
- `app/admin/page.tsx` - Overview dashboard (~340 lines)

**Step 2: Admin API Routes (PENDING)**

- [ ] `GET /api/admin/users` - List all users with subscription status
- [ ] `GET /api/admin/usage` - Usage logs with filtering
- [ ] `PATCH /api/admin/users/[id]` - Update user role (promote to ADMIN)
- [ ] `GET /api/admin/stats` - Detailed system statistics

**Step 3: Admin Pages (PENDING)**

- [ ] `/admin/users` - User management UI
- [ ] `/admin/usage` - Usage monitoring dashboard
- [ ] `/admin/subscriptions` - Subscription management UI

#### ✅ Testing Documentation (COMPLETED - 2025-11-13)

**Updated `docs/testing-plan.md`:**

- ✅ Added **Phase 4: Stripe Webhook Manual Validation**:
  - Stripe CLI setup instructions
  - Manual test scenarios (subscription created, payment failed, subscription canceled)
- ✅ Added **Phase 5: Usage Limit Manual Validation**:
  - Test environment setup (test users, auth tokens)
  - Comprehensive test scenarios with curl commands:
    - 401 Authentication Required
    - 403 FREE Plan Restrictions (Pro Mode, Image, Video)
    - 403 PRO Plan Restrictions (Video ENTERPRISE-only)
    - 429 Monthly Limit Exceeded (with Retry-After header)
    - 200 Successful Usage Logging
  - Dashboard usage display validation
  - 30+ validation checklist items
- ✅ All test scenarios include expected HTTP status codes, response bodies, and database verification queries

---

## Development Tools and Roles

このプロジェクトでは、複数のAI開発ツールが役割分担して開発を進めています。

### Claude Code (フルスタック実装)

**担当領域:**
- Next.js アプリケーションのフロントエンド・バックエンド実装
- API Routes の開発とテスト
- React コンポーネントの作成
- データベーススキーマの設計と Prisma Client の利用
- Vitest / Playwright テストの作成
- ドキュメント更新

**特徴:**
- 外部接続可能（Web検索、API呼び出し可）
- コード生成・編集に最適化
- MCP (Model Context Protocol) サーバー統合により高度なコード解析が可能

**制約:**
- ローカル開発環境での作業のみ
- GCP / Terraform は Codex が管理

### Cursor (バックエンド・クラウド開発)

**担当領域:**
- バックエンドAPI の実装
- クラウドインフラ関連のコード
- 複雑なサーバーサイドロジック
- パフォーマンス最適化

**特徴:**
- IDE統合により高速なコード編集
- コンテキスト保持が優れている
- 大規模なコードベースでの作業が得意

**利用シーン:**
- Phase 6 以降のバックエンド重視の実装
- 既存コードの大幅なリファクタリング

### Codex (レビュー係・要件定義)

**担当領域:**
- 要件定義の矛盾チェック
- アーキテクチャレビュー
- セキュリティ監査
- コード品質レビュー
- Terraform / GCP インフラ管理

**特徴:**
- **外部接続不可**（Web検索、API呼び出しできない）
- 深い思考と論理的分析に特化
- 既存のドキュメントとコードから矛盾を検出

**制約:**
- 最新の外部情報（公式ドキュメント、ライブラリバージョン）にアクセスできない
- 実装よりもレビュー・検証に専念

**利用シーン:**
- 実装完了後のレビュー
- Phase 間の移行時の整合性チェック
- セキュリティ要件の検証

### 推奨される開発フロー

1. **設計フェーズ**: Claude Code または Cursor が初期実装を提案
2. **実装フェーズ**:
   - フロントエンド・API: Claude Code
   - バックエンド・インフラ: Cursor または Codex
3. **レビューフェーズ**: Codex が要件整合性とセキュリティをチェック
4. **テストフェーズ**: Claude Code がテストを作成・実行
5. **デプロイフェーズ**: Codex が Terraform でインフラ管理

---

## Important Technical Decisions

### Security

1. **API Key Handling**: ALL Gemini API calls are server-side only. `GEMINI_API_KEY` is NEVER exposed to client.
2. **Video Downloads**: Use `/api/gemini/video/download` proxy endpoint to avoid client-side API key exposure.
3. **Authentication**: NextAuth.js session required for all conversation APIs.
4. **Authorization**: Users can only access their own conversations (userId check in API routes).

### Architecture Patterns

1. **API Routes are Server-Side Only**: All Gemini API calls happen in `/app/api/*` Route Handlers.
2. **Client Components**: `app/page.tsx`, `ChatMessage`, `ChatInput` use `'use client'` directive.
3. **Type Safety**: Zod schemas validate all API inputs/outputs.
4. **Error Handling**: DJ Shacho Mode can convert errors to persona style.

### Model IDs (CRITICAL)

```typescript
// lib/constants.ts
export const GEMINI_MODELS = {
    FLASH: 'gemini-2.5-flash', // NOT gemini-2.0-flash-exp
    PRO: 'gemini-2.5-pro', // NOT gemini-2.0-flash-thinking-exp-01-21
    FLASH_IMAGE: 'gemini-2.5-flash-image',
    IMAGEN: 'imagen-4.0',
    VEO: 'veo-3.1-fast',
};
```

### ESLint 9 with Next.js 14

- ESLint 9.39.1 installed but not fully compatible with Next.js 14
- `next.config.js` has `eslint.ignoreDuringBuilds: true`
- Run `npm run lint` separately for linting
- Full ESLint 9 support expected in Next.js 15

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Testing
npm test              # Vitest
npm run test:e2e      # Playwright

# Prisma
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations (dev)
npm run prisma:studio    # Open Prisma Studio
npm run prisma:push      # Push schema to DB (no migration)
```

---

## Architecture (Next.js 14 App Router)

### Tech Stack

- **Framework**: Next.js 14.2.33 (App Router)
- **Language**: TypeScript 5.9.3
- **Database**: PostgreSQL via Prisma 6.19.0
- **Authentication**: NextAuth.js 4.24.13 + Prisma Adapter
- **AI SDK**: @google/genai 1.29.0
- **Styling**: Tailwind CSS 4.1.17
- **Validation**: Zod 4.1.12
- **Testing**: Vitest 4.0.8 + Playwright 1.56.1

### Environment Variables

**Server-Side Only (NEVER expose to client):**

```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
SUPABASE_SERVICE_ROLE_KEY="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GEMINI_API_KEY="..."  # Server-side only!
```

**Client-Side (Public):**

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

**IMPORTANT**: NEVER use `NEXT_PUBLIC_GEMINI_API_KEY`. All Gemini calls are server-side.

### File Structure

```
/
├── app/                           # Next.js App Router
│   ├── page.tsx                   # Main chat interface ('use client')
│   ├── layout.tsx                 # Root layout
│   ├── api/                       # API Routes (server-side)
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth.js
│   │   └── gemini/
│   │       ├── chat/route.ts      # Chat/Pro/Search modes
│   │       ├── image/route.ts     # Image generation/editing
│   │       ├── video/route.ts     # Video generation
│   │       └── video/
│   │           ├── status/route.ts    # Video polling
│   │           └── download/route.ts  # Video proxy (secure)
│   └── (future)
│       ├── conversations/[id]/page.tsx  # Conversation view
│       └── admin/                 # Admin dashboard
├── components/                    # React components
│   ├── ChatMessage.tsx            # Message display
│   ├── ChatInput.tsx              # Input area with controls
│   └── icons.tsx                  # SVG icons
├── lib/                           # Utilities & services
│   ├── auth.ts                    # NextAuth configuration
│   ├── prisma.ts                  # Prisma client singleton
│   ├── gemini.ts                  # Gemini API service wrapper
│   ├── fileUtils.ts               # File/base64 utilities
│   └── constants.ts               # App-wide constants
├── types/                         # TypeScript types
│   └── app.ts                     # Message, Media, ContentPart, etc.
├── prisma/
│   └── schema.prisma              # Database schema
├── docs/
│   ├── implementation-plan.md     # Full SaaS migration plan
│   ├── interface-spec.md          # App ⇔ Infra interface
│   └── api-design-conversation.md # Conversation API spec
├── infra/                         # Terraform IaC
│   └── envs/dev/                  # Dev environment
├── alpha/                         # Old React+Vite app (reference only)
├── public/
│   └── DJ_Shacho_400x400.jpg     # DJ Shacho avatar
├── .env.local                     # Local environment variables (gitignored)
├── next.config.js                 # Next.js configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration
└── tsconfig.json                  # TypeScript configuration
```

### Data Models (Prisma)

**User** → **Conversation** → **Message**

```prisma
model Conversation {
  id        String         @id @default(cuid())
  title     String?
  userId    String
  mode      GenerationMode @default(CHAT)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]
}

model Message {
  id             String      @id @default(cuid())
  conversationId String
  role           MessageRole
  content        Json        // ContentPart[] structure
  createdAt      DateTime    @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

### API Route Pattern

All API routes follow this pattern:

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Validate input
        const body = await request.json();
        const validated = someZodSchema.parse(body);

        // 3. Authorize (check user owns resource)
        const resource = await prisma.resource.findUnique({
            where: { id: validated.id },
        });
        if (resource.userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 4. Process
        const result = await doSomething(validated);

        // 5. Return
        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Error in /api/example:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

---

## DJ Shacho Mode

Special persona mode that applies DJ Shacho (Shunsuke Kimoto) speaking style to text responses.

**Characteristics:**

- High-energy, enthusiastic tone
- Kyushu dialect (博多弁)
- Positive, motivational messaging
- First-person: 「俺」

**Implementation:**

- Toggle in `ChatInput` component
- `DJ_SHACHO_SYSTEM_PROMPT` passed to text generation APIs
- `DJ_SHACHO_TEMPERATURE = 0.9` for creative responses
- Error messages also converted to DJ Shacho style
- Image/video prompts NOT modified (Gemini policy compliance)
- Initial greeting changes based on mode state

**Files:**

- `lib/constants.ts`: `DJ_SHACHO_SYSTEM_PROMPT`, `DJ_SHACHO_INITIAL_MESSAGE`
- `public/DJ_Shacho_400x400.jpg`: Avatar image
- `app/page.tsx`: `convertToDjShachoStyle()` function

---

## Important Implementation Notes

### Message State Management

```typescript
// app/page.tsx pattern
const [messages, setMessages] = useState<Message[]>([
    {
        id: 'init',
        role: 'model',
        parts: [{ text: 'クリエイティブフロースタジオへようこそ！...' }],
    },
]);

// Add message
const addMessage = (message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: Date.now().toString() }]);
};

// Update last message (for loading/progress)
const updateLastMessage = (updater: (lastMessage: Message) => Message) => {
    setMessages(prev => {
        if (prev.length === 0) return prev;
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = updater(newMessages[newMessages.length - 1]);
        return newMessages;
    });
};
```

### Video Generation Pattern

1. Call `POST /api/gemini/video` → get `operationName`
2. Poll `POST /api/gemini/video/status` with `operationName`
3. Update UI with progress percentage (0-100)
4. When `operation.done`, download via `/api/gemini/video/download?uri=...`
5. Create blob URL and track in `blobUrlsRef` for cleanup

### Image Editing Pattern

1. User hovers on generated image → edit button appears
2. User enters edit prompt
3. Call `POST /api/gemini/image` with `{ prompt, originalImage }`
4. Server uses `gemini-2.5-flash-image` model with IMAGE response modality
5. Return edited image as data URL

### Memory Management

```typescript
// Blob URLs must be cleaned up
const blobUrlsRef = useRef<Set<string>>(new Set());

useEffect(() => {
    return () => {
        blobUrlsRef.current.forEach(url => {
            URL.revokeObjectURL(url);
        });
        blobUrlsRef.current.clear();
    };
}, []);
```

### DJ Shacho Mode Ref Pattern

```typescript
// Avoid race conditions in async operations
const isDjShachoModeRef = useRef(isDjShachoMode);
isDjShachoModeRef.current = isDjShachoMode; // Update immediately during render

// Use in async context
const formatErrorMessage = async (errorMessage: string) => {
    if (isDjShachoModeRef.current) {
        return await convertToDjShachoStyle(errorMessage);
    }
    return errorMessage;
};
```

---

## Google Cloud Platform (GCP) Setup

**Project ID**: `dataanalyticsclinic`
**Primary Region**: `asia-northeast1`
**Cloud Run URL**: `https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app`

### Infrastructure (Terraform)

- **VPC**: `creative-flow-studio-vpc`
- **Cloud SQL**: PostgreSQL instance with Private IP
- **Cloud Run**: Next.js container (auto-scaling 0-5 instances)
- **Artifact Registry**: Docker images storage
- **Secret Manager**: Environment variables
- **Cloud Build**: CI/CD pipeline

### Service Accounts

- `cloud-run-runtime@...`: Cloud Run execution with cloudsql.client, secretmanager.secretAccessor
- `667780715339@cloudbuild.gserviceaccount.com`: Cloud Build with run.admin, artifactregistry.writer
- `terraform@...`: Terraform management

### Terraform State

- Bucket: `gs://dataanalyticsclinic-terraform-state`
- Location: `infra/envs/dev/`
- **IMPORTANT**: Codex manages Terraform, not Claude Code

For detailed GCP setup, see `docs/implementation-plan.md`.

---

## Testing Strategy

### Unit Tests (Vitest)

```bash
npm test
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui
```

### Manual Testing Checklist

- [ ] Chat mode with conversation history
- [ ] Pro mode with thinking budget
- [ ] Search mode with grounding sources
- [ ] Image generation (all aspect ratios)
- [ ] Image editing workflow
- [ ] Video generation with polling
- [ ] DJ Shacho Mode (on/off, error messages, initial greeting)
- [ ] File upload (image/video validation)
- [ ] Authentication flow (Google OAuth)
- [ ] Conversation persistence (CRUD operations)

---

## Common Issues & Solutions

### Issue: Build fails with ESLint 9 errors

**Solution**: ESLint is disabled during builds (`next.config.js`). Run `npm run lint` separately.

### Issue: Prisma Client not found

**Solution**: Run `npm run prisma:generate` or `npm run build` (includes generate step).

### Issue: Video download fails

**Solution**: Verify `/api/gemini/video/download` proxy is used, NOT direct URI with client-side API key.

### Issue: NextAuth session is null

**Solution**:

1. Check `.env.local` has all auth variables
2. Verify `NEXTAUTH_URL` matches current URL
3. Check `NEXTAUTH_SECRET` is set
4. Ensure database connection is working

---

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Zod Validation](https://zod.dev/)

---

## Conversation Summary for Next Session

**Last Updated**: 2025-11-13 (Session 3)
**Current Branch**: dev
**Latest Commit**: Pending (Phase 6 Step 1 - Admin Dashboard RBAC Infrastructure)

**What We Just Completed (This Session)**:

1. ✅ **Phase 6 Step 1: Admin Dashboard RBAC Infrastructure**
   - Created `middleware.ts` with role-based access control for `/admin` routes
   - Created `app/admin/layout.tsx` with navigation and shared layout
   - Created `app/admin/page.tsx` with overview dashboard (Server Component)
   - Fetches and displays key metrics: users, subscriptions, conversations, messages, API usage
   - Quick action buttons to admin subpages

2. ✅ **Testing Documentation Enhancement**
   - Updated `docs/testing-plan.md` with comprehensive manual validation steps
   - Added **Phase 4: Stripe Webhook Manual Validation** (Stripe CLI setup, test scenarios)
   - Added **Phase 5: Usage Limit Manual Validation** (curl commands, expected responses)
   - Includes 30+ validation checklist items for QA
   - All scenarios documented with HTTP status codes and database verification

**Previously Completed (Earlier Sessions)**:

1. ✅ Phase 4: Conversation Persistence (All steps) - 33 tests
2. ✅ Phase 5: Stripe Integration Steps 1-4 (COMPLETE) - 88 tests total
   - Checkout Session, Webhooks, Dashboard UI, Usage Limits Integration
3. ✅ All Gemini APIs secured with NextAuth + subscription limits

**Next Steps (Prioritized)**:

1. **Phase 6 Step 2: Admin API Routes** (Claude Code または Cursor)
   - `GET /api/admin/users` - List all users with subscription/usage stats
   - `GET /api/admin/usage` - Usage logs with filtering and pagination
   - `PATCH /api/admin/users/[id]` - Update user role (promote to ADMIN)
   - Add Vitest tests for admin APIs

2. **Phase 6 Step 3: Admin Pages** (Claude Code または Cursor)
   - `/admin/users` - User management UI (list, search, filter by plan)
   - `/admin/usage` - Usage monitoring dashboard (charts, filters)
   - `/admin/subscriptions` - Subscription overview

3. **Manual Testing & Validation** (推奨)
   - Follow `docs/testing-plan.md` Phase 4 (Stripe webhooks with Stripe CLI)
   - Follow `docs/testing-plan.md` Phase 5 (Usage limits with curl)
   - Test admin dashboard access with ADMIN role user

4. **Code Review** (Codex)
   - Phase 5 & 6 実装のセキュリティレビュー
   - RBAC実装の妥当性検証
   - Prisma クエリのパフォーマンス確認

**Key Files Modified This Session**:

- `middleware.ts` (NEW) - RBAC middleware
- `app/admin/layout.tsx` (NEW) - Admin layout
- `app/admin/page.tsx` (NEW) - Overview dashboard
- `docs/testing-plan.md` (UPDATED) - Added Phases 4 & 5 manual validation
- `CLAUDE.md` (UPDATED) - This file

**Development Tool Transition**:

- **Claude Code** ✅ Phase 5 & Phase 6 Step 1 完了
- **次のセッション**: Cursor (バックエンド実装) または Codex (レビュー) に交代
- **Codex の役割**: 外部接続不可だが、要件定義の矛盾チェックやセキュリティ監査が得意

**Test Status**:

- ✅ **88 tests passing** (Vitest)
  - 33 Conversation API tests
  - 37 Stripe integration tests (subscription utilities, APIs)
  - 18 Gemini API tests (usage limits, auth)
- ✅ **Type-check passing** (0 errors)

**Important Reminders**:

- All Gemini APIs require NextAuth session (401 if missing)
- Usage limits enforced: 403 (feature restricted), 429 (rate limited with Retry-After)
- Admin routes protected by middleware (ADMIN role required)
- Stripe `apiVersion` uses `2024-11-20.acacia` (stable version)
